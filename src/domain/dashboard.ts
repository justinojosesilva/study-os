import { db } from "@/infra/db/client";
import { goals, topics } from "@/infra/db/schema";
import { and, eq, asc, sql } from "drizzle-orm";
import { minutesStudiedSince, streakDetail, earnedWeightSql } from "./metrics";
import { getWeeklyGoalHours } from "./user/repository";
import { startOfWeek } from "@/lib/date";

export type DashboardGoal = {
  id: string;
  title: string;
  category: "faculdade" | "profissional" | "certificacao";
  why: string | null;
  targetDate: Date | null;
  progressPct: number;
  masteredTopics: number;
  practicingTopics: number;
  totalTopics: number;
};

export type DashboardData = {
  weekHours: number;
  weekGoalHours: number;
  streak: number;
  /** Dias corridos e constância da corrente — explicam o número da sequência. */
  streakSpan: number;
  streakConstancia: number;
  activeGoals: number;
  masteredTopics: number;
  totalTopics: number;
  goals: DashboardGoal[];
};

/**
 * Single read for the whole dashboard. Goal progress comes from one grouped
 * join (no N+1); hours and streak come from the session event log.
 */
export async function getDashboardData(ownerId: string): Promise<DashboardData> {
  const [minutes, streak, goalRows, topicTotals, weekGoalHours] = await Promise.all([
    minutesStudiedSince(ownerId, startOfWeek()),
    streakDetail(ownerId),
    goalsWithProgress(ownerId),
    topicCounts(ownerId),
    getWeeklyGoalHours(ownerId),
  ]);

  return {
    weekHours: Math.round((minutes / 60) * 10) / 10,
    weekGoalHours,
    streak: streak.dias,
    streakSpan: streak.span,
    streakConstancia: streak.constancia,
    activeGoals: goalRows.length,
    masteredTopics: topicTotals.mastered,
    totalTopics: topicTotals.total,
    goals: goalRows,
  };
}

/** Active goals with derived progress. Shared by the dashboard and /goals. */
export async function goalsWithProgress(ownerId: string): Promise<DashboardGoal[]> {
  const rows = await db
    .select({
      id: goals.id,
      title: goals.title,
      category: goals.category,
      why: goals.why,
      targetDate: goals.targetDate,
      totalWeight: sql<number>`coalesce(sum(${topics.weight}), 0)`,
      // Shared with goalProgressPct so a goal's bar reads the same everywhere.
      earnedWeight: earnedWeightSql,
      totalTopics: sql<number>`count(${topics.id})`,
      masteredTopics: sql<number>`count(*) filter (where ${topics.status} = 'mastered')`,
      practicingTopics: sql<number>`count(*) filter (where ${topics.status} = 'praticando')`,
    })
    .from(goals)
    .leftJoin(topics, eq(topics.goalId, goals.id))
    .where(and(eq(goals.ownerId, ownerId), eq(goals.status, "active")))
    .groupBy(goals.id)
    .orderBy(asc(goals.createdAt));

  return rows.map((r) => {
    const total = Number(r.totalWeight);
    const earned = Number(r.earnedWeight);
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      why: r.why,
      targetDate: r.targetDate,
      progressPct: total === 0 ? 0 : Math.round((earned / total) * 100),
      masteredTopics: Number(r.masteredTopics),
      practicingTopics: Number(r.practicingTopics),
      totalTopics: Number(r.totalTopics),
    };
  });
}

async function topicCounts(ownerId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      mastered: sql<number>`count(*) filter (where ${topics.status} = 'mastered')`,
    })
    .from(topics)
    .where(eq(topics.ownerId, ownerId));
  return { total: Number(row?.total ?? 0), mastered: Number(row?.mastered ?? 0) };
}
