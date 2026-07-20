import { db } from "@/infra/db/client";
import { topics, goals, certifications } from "@/infra/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { getAvailability } from "@/domain/user/repository";
import { getReviewStats } from "@/domain/reviews/stats";
import { startOfToday, addDays, daysUntil } from "@/lib/date";

/**
 * Deterministic weekly study planner. Given the user's per-weekday availability,
 * it lays out the next 7 days by:
 *   1. reserving a review slot when FSRS cards are due that day (they decay), then
 *   2. filling the rest with not-mastered topics ranked by deadline urgency
 *      (goal target date / linked cert exam date) × topic weight × status.
 * Nothing is stored — the plan is a pure function of current data, like metrics.
 */

const BLOCK_MIN = 30; // default study block length
const MIN_BLOCK = 20; // don't schedule slivers below this
const REVIEW_MIN_PER_CARD = 2;
const REVIEW_CAP = 60;

export type PlanBlock = {
  kind: "review" | "topic";
  label: string;
  minutes: number;
  topicId?: string;
  goalId?: string;
  goalTitle?: string;
};

export type PlanDay = {
  date: Date;
  availableMin: number;
  plannedMin: number;
  isToday: boolean;
  blocks: PlanBlock[];
};

export type WeekPlan = {
  days: PlanDay[];
  totalPlannedMin: number;
  totalAvailableMin: number;
  hasCandidates: boolean;
};

type Candidate = {
  id: string;
  title: string;
  weight: number;
  status: "todo" | "learning";
  goalId: string;
  goalTitle: string;
  deadline: Date | null;
  score: number;
  cap: number;
};

function urgencyMult(deadline: Date | null): number {
  if (!deadline) return 1;
  const d = daysUntil(deadline);
  if (d <= 7) return 4;
  if (d <= 14) return 3;
  if (d <= 30) return 2;
  if (d <= 60) return 1.5;
  return 1;
}

function earliest(dates: (Date | null)[]): Date | null {
  const valid = dates.filter((d): d is Date => d != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

async function loadCandidates(ownerId: string): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: topics.id,
      title: topics.title,
      weight: topics.weight,
      status: topics.status,
      goalId: topics.goalId,
      goalTitle: goals.title,
      targetDate: goals.targetDate,
    })
    .from(topics)
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .where(
      and(eq(topics.ownerId, ownerId), eq(goals.status, "active"), ne(topics.status, "mastered")),
    );

  // Soonest still-pending exam per goal → an extra deadline signal.
  const certRows = await db
    .select({
      goalId: certifications.goalId,
      examDate: sql<string>`min(${certifications.examDate})`,
    })
    .from(certifications)
    .where(
      and(
        eq(certifications.ownerId, ownerId),
        sql`${certifications.status} in ('planned', 'scheduled')`,
        sql`${certifications.examDate} is not null`,
        sql`${certifications.examDate} >= now()`,
      ),
    )
    .groupBy(certifications.goalId);

  const certDeadline = new Map<string, Date>();
  for (const c of certRows) {
    if (c.goalId && c.examDate) certDeadline.set(c.goalId, new Date(c.examDate));
  }

  const candidates = rows.map((r): Candidate => {
    const deadline = earliest([r.targetDate, certDeadline.get(r.goalId) ?? null]);
    const statusMult = r.status === "learning" ? 1.4 : 1;
    const score = urgencyMult(deadline) * statusMult * r.weight;
    return {
      id: r.id,
      title: r.title,
      weight: r.weight,
      status: r.status as "todo" | "learning",
      goalId: r.goalId,
      goalTitle: r.goalTitle,
      deadline,
      score,
      cap: Math.max(1, Math.min(4, r.weight)),
    };
  });

  // Stable, deterministic priority order.
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const g = a.goalTitle.localeCompare(b.goalTitle);
    return g !== 0 ? g : a.title.localeCompare(b.title);
  });
  return candidates;
}

export async function getWeekPlan(ownerId: string): Promise<WeekPlan> {
  const [availability, candidates, stats] = await Promise.all([
    getAvailability(ownerId),
    loadCandidates(ownerId),
    getReviewStats(ownerId),
  ]);

  const reviewByDay = stats.forecast.map((f) => f.count); // index 0=today..6
  const remainingCap = new Map(candidates.map((c) => [c.id, c.cap] as const));

  const today = startOfToday();
  const days: PlanDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const availableMin = availability[date.getDay()] ?? 0;
    const blocks: PlanBlock[] = [];
    let remaining = availableMin;

    // Reviews first — they decay if skipped.
    const cards = reviewByDay[i] ?? 0;
    if (cards > 0 && remaining >= MIN_BLOCK) {
      const rm = Math.min(
        Math.min(Math.max(REVIEW_MIN_PER_CARD * cards, 10), REVIEW_CAP),
        remaining,
      );
      blocks.push({ kind: "review", label: `Revisar ${cards} card${cards > 1 ? "s" : ""}`, minutes: rm });
      remaining -= rm;
    }

    // Then topics, highest-priority first, one block per topic per day.
    const usedToday = new Set<string>();
    while (remaining >= MIN_BLOCK) {
      const cand = candidates.find(
        (c) => (remainingCap.get(c.id) ?? 0) > 0 && !usedToday.has(c.id),
      );
      if (!cand) break;
      const minutes = Math.min(BLOCK_MIN, remaining);
      if (minutes < MIN_BLOCK) break;
      blocks.push({
        kind: "topic",
        label: cand.title,
        minutes,
        topicId: cand.id,
        goalId: cand.goalId,
        goalTitle: cand.goalTitle,
      });
      usedToday.add(cand.id);
      remainingCap.set(cand.id, (remainingCap.get(cand.id) ?? 0) - 1);
      remaining -= minutes;
    }

    days.push({
      date,
      availableMin,
      plannedMin: availableMin - remaining,
      isToday: i === 0,
      blocks,
    });
  }

  return {
    days,
    totalPlannedMin: days.reduce((s, d) => s + d.plannedMin, 0),
    totalAvailableMin: days.reduce((s, d) => s + d.availableMin, 0),
    hasCandidates: candidates.length > 0,
  };
}
