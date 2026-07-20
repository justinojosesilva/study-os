import { db } from "@/infra/db/client";
import { studySessions, topics, flashcardReviews, flashcards, certifications } from "@/infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { currentStreak } from "./metrics";

/**
 * Gamification — XP, level and achievements DERIVED from the event log. Nothing
 * is stored: XP is a pure function of study minutes, reviews and mastered
 * topics; the level is a function of XP; achievements are boolean conditions
 * over the same aggregates. Same philosophy as metrics/heatmap.
 */

const XP_PER_MINUTE = 1;
const XP_PER_REVIEW = 5;
const XP_PER_MASTERED = 50;
const XP_PER_CERT = 200;

export type Achievement = {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
};

export type Gamification = {
  totalXp: number;
  level: number;
  title: string;
  xpInLevel: number;
  xpForNext: number;
  progressPct: number;
  breakdown: { studyXp: number; reviewXp: number; masteryXp: number; certXp: number };
  stats: { minutes: number; reviews: number; mastered: number; flashcards: number; streak: number; certs: number };
  achievements: Achievement[];
};

/** XP needed to REACH level n (n>=1). Level 1 = 0 XP; curve is 50*(n-1)^2. */
function xpForLevel(n: number): number {
  return 50 * (n - 1) * (n - 1);
}

function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

function titleForLevel(level: number): string {
  if (level >= 15) return "Mestre";
  if (level >= 10) return "Especialista";
  if (level >= 7) return "Dedicado";
  if (level >= 5) return "Estudante consistente";
  if (level >= 3) return "Aprendiz";
  return "Iniciante";
}

export async function getGamification(ownerId: string): Promise<Gamification> {
  const [minutes, reviews, mastered, flashcardsCount, streak, certs] = await Promise.all([
    totalStudyMinutes(ownerId),
    reviewsCount(ownerId),
    masteredCount(ownerId),
    flashcardsCountFor(ownerId),
    currentStreak(ownerId),
    passedCertsCount(ownerId),
  ]);

  const studyXp = minutes * XP_PER_MINUTE;
  const reviewXp = reviews * XP_PER_REVIEW;
  const masteryXp = mastered * XP_PER_MASTERED;
  const certXp = certs * XP_PER_CERT;
  const totalXp = studyXp + reviewXp + masteryXp + certXp;

  const level = levelForXp(totalXp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const xpInLevel = totalXp - base;
  const xpForNext = next - base;

  return {
    totalXp,
    level,
    title: titleForLevel(level),
    xpInLevel,
    xpForNext,
    progressPct: xpForNext > 0 ? Math.round((xpInLevel / xpForNext) * 100) : 0,
    breakdown: { studyXp, reviewXp, masteryXp, certXp },
    stats: { minutes, reviews, mastered, flashcards: flashcardsCount, streak, certs },
    achievements: buildAchievements({ minutes, reviews, mastered, flashcards: flashcardsCount, streak, certs }),
  };
}

function buildAchievements(s: {
  minutes: number;
  reviews: number;
  mastered: number;
  flashcards: number;
  streak: number;
  certs: number;
}): Achievement[] {
  return [
    { id: "first_session", label: "Primeiro passo", description: "Registre sua primeira sessão de estudo", unlocked: s.minutes > 0 },
    { id: "streak_7", label: "Semana de fogo", description: "7 dias seguidos estudando", unlocked: s.streak >= 7 },
    { id: "streak_30", label: "Constância de ferro", description: "30 dias seguidos estudando", unlocked: s.streak >= 30 },
    { id: "hours_10", label: "Dez horas", description: "Acumule 10 horas de estudo", unlocked: s.minutes >= 600 },
    { id: "hours_50", label: "Maratonista", description: "Acumule 50 horas de estudo", unlocked: s.minutes >= 3000 },
    { id: "first_mastered", label: "Primeiro domínio", description: "Domine seu primeiro tópico", unlocked: s.mastered >= 1 },
    { id: "mastered_10", label: "Colecionador de skills", description: "Domine 10 tópicos", unlocked: s.mastered >= 10 },
    { id: "reviews_100", label: "Memória de elefante", description: "Faça 100 revisões", unlocked: s.reviews >= 100 },
    { id: "cards_20", label: "Baralho cheio", description: "Crie 20 flashcards", unlocked: s.flashcards >= 20 },
    { id: "first_cert", label: "Certificado!", description: "Conquiste sua primeira certificação", unlocked: s.certs >= 1 },
    { id: "certs_3", label: "Trio de credenciais", description: "Conquiste 3 certificações", unlocked: s.certs >= 3 },
  ];
}

async function totalStudyMinutes(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${studySessions.durationMin}), 0)` })
    .from(studySessions)
    .where(eq(studySessions.ownerId, ownerId));
  return Number(row?.total ?? 0);
}

async function reviewsCount(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(flashcardReviews)
    .where(eq(flashcardReviews.ownerId, ownerId));
  return Number(row?.n ?? 0);
}

async function masteredCount(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(topics)
    .where(and(eq(topics.ownerId, ownerId), eq(topics.status, "mastered")));
  return Number(row?.n ?? 0);
}

async function flashcardsCountFor(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(flashcards)
    .where(eq(flashcards.ownerId, ownerId));
  return Number(row?.n ?? 0);
}

async function passedCertsCount(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(certifications)
    .where(and(eq(certifications.ownerId, ownerId), eq(certifications.status, "passed")));
  return Number(row?.n ?? 0);
}
