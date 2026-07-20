import { db } from "@/infra/db/client";
import { goals, topics, certifications, studySessions, type Goal } from "@/infra/db/schema";
import { and, eq, ne, desc, asc, sql } from "drizzle-orm";
import { currentStreak } from "@/domain/metrics";

type GoalCategory = Goal["category"];

/**
 * The résumé's substance, DERIVED live from the user's data (never duplicated
 * into resume_profiles): mastered topics become skills, passed certifications
 * become credentials, goals become focus areas, plus dedication stats.
 */
export type ResumeData = {
  skills: { goalTitle: string; category: GoalCategory; topics: string[] }[];
  certifications: {
    title: string;
    provider: string;
    obtainedDate: Date | null;
    credentialUrl: string | null;
  }[];
  focusAreas: { title: string; category: GoalCategory; masteredTopics: number; totalTopics: number }[];
  stats: { studyHours: number; masteredTopics: number; streak: number };
};

export async function getResumeData(ownerId: string): Promise<ResumeData> {
  const [skillRows, certRows, goalRows, statRow, streak] = await Promise.all([
    db
      .select({
        goalTitle: goals.title,
        category: goals.category,
        topicTitle: topics.title,
      })
      .from(topics)
      .innerJoin(goals, eq(topics.goalId, goals.id))
      .where(and(eq(topics.ownerId, ownerId), eq(topics.status, "mastered")))
      .orderBy(asc(goals.title), asc(topics.sortOrder)),
    db
      .select({
        title: certifications.title,
        provider: certifications.provider,
        obtainedDate: certifications.obtainedDate,
        credentialUrl: certifications.credentialUrl,
      })
      .from(certifications)
      .where(and(eq(certifications.ownerId, ownerId), eq(certifications.status, "passed")))
      .orderBy(desc(certifications.obtainedDate)),
    db
      .select({
        title: goals.title,
        category: goals.category,
        totalTopics: sql<number>`count(${topics.id})`,
        masteredTopics: sql<number>`count(*) filter (where ${topics.status} = 'mastered')`,
      })
      .from(goals)
      .leftJoin(topics, eq(topics.goalId, goals.id))
      .where(and(eq(goals.ownerId, ownerId), ne(goals.status, "archived")))
      .groupBy(goals.id)
      .orderBy(asc(goals.title)),
    db
      .select({
        minutes: sql<number>`coalesce(sum(${studySessions.durationMin}), 0)`,
      })
      .from(studySessions)
      .where(eq(studySessions.ownerId, ownerId)),
    currentStreak(ownerId),
  ]);

  // Group mastered topics by goal into skill clusters.
  const byGoal = new Map<string, { category: GoalCategory; topics: string[] }>();
  for (const r of skillRows) {
    const entry = byGoal.get(r.goalTitle) ?? { category: r.category, topics: [] };
    entry.topics.push(r.topicTitle);
    byGoal.set(r.goalTitle, entry);
  }
  const skills = [...byGoal.entries()].map(([goalTitle, v]) => ({
    goalTitle,
    category: v.category,
    topics: v.topics,
  }));

  const masteredTopics = skillRows.length;
  const minutes = Number(statRow[0]?.minutes ?? 0);

  return {
    skills,
    certifications: certRows,
    focusAreas: goalRows.map((g) => ({
      title: g.title,
      category: g.category,
      masteredTopics: Number(g.masteredTopics),
      totalTopics: Number(g.totalTopics),
    })),
    stats: {
      studyHours: Math.round(minutes / 60),
      masteredTopics,
      streak,
    },
  };
}
