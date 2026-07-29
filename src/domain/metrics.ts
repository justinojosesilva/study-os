import { db } from "@/infra/db/client";
import { studySessions, topics } from "@/infra/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { toDateKey, addDays } from "@/lib/date";
import { PRACTICING_CREDIT } from "@/lib/progress";

/**
 * Everything here is DERIVED from the study_sessions event log and the topics
 * table — nothing is a stored counter. This is the core thesis of the model:
 * facts are append-only; metrics are computed on read.
 */

export { PRACTICING_CREDIT } from "@/lib/progress";

/** Total minutes studied since a given instant (e.g. start of the week). */
export async function minutesStudiedSince(ownerId: string, since: Date) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${studySessions.durationMin}), 0)` })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.ownerId, ownerId),
        gte(studySessions.startedAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * Current consecutive-day study streak, derived from the distinct local dates
 * that have at least one session. Pulls distinct days, then walks backwards
 * from today counting unbroken days.
 */
export async function currentStreak(ownerId: string): Promise<number> {
  const rows = await db
    .select({ startedAt: studySessions.startedAt })
    .from(studySessions)
    .where(eq(studySessions.ownerId, ownerId));

  // Bucketed in JS rather than SQL date(): the database session runs in UTC, so
  // date() files an evening session under the next day and silently breaks the
  // streak. Same approach — and the same personal-scale volume argument — as
  // dailyStudyMinutes below.
  const days = new Set(rows.map((r) => toDateKey(r.startedAt)));

  let streak = 0;
  let cursor = new Date();
  // Allow the streak to count today OR yesterday as the anchor.
  if (!days.has(toDateKey(cursor))) cursor = addDays(cursor, -1);
  while (days.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Weighted credit a topic contributes to its goal's progress: full for a
 * mastered topic, half while it is being practised. Practising is real
 * advancement, so a bar that ignored it would sit still through the longest
 * part of the work — but it isn't mastery either, which the exam decides.
 *
 * Written as SQL so the two callers (a single goal, and the dashboard's
 * grouped query) can't drift apart on what progress means.
 */
export const earnedWeightSql = sql<number>`coalesce(sum(
  case ${topics.status}
    when 'mastered' then ${topics.weight}::numeric
    when 'praticando' then ${topics.weight}::numeric * ${PRACTICING_CREDIT}
    else 0
  end
), 0)`;

/**
 * Goal progress as the weighted share of topics done, counting practice at
 * half credit. Returns 0..100. Derived, never stored.
 */
export async function goalProgressPct(goalId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${topics.weight}), 0)`,
      earned: earnedWeightSql,
    })
    .from(topics)
    .where(eq(topics.goalId, goalId));

  const total = Number(row?.total ?? 0);
  const earned = Number(row?.earned ?? 0);
  if (total === 0) return 0;
  return Math.round((earned / total) * 100);
}

/**
 * Minutes studied per local calendar day since `since`, keyed "YYYY-MM-DD".
 * Bucketed in JS (not SQL date()) so days align to the user's local timezone,
 * matching how the heatmap grid is built. Volume is personal-scale, so pulling
 * rows and summing here is cheap and timezone-correct.
 */
export async function dailyStudyMinutes(
  ownerId: string,
  since: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      startedAt: studySessions.startedAt,
      durationMin: studySessions.durationMin,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.ownerId, ownerId),
        gte(studySessions.startedAt, since),
      ),
    );

  const map = new Map<string, number>();
  for (const r of rows) {
    const key = toDateKey(r.startedAt);
    map.set(key, (map.get(key) ?? 0) + r.durationMin);
  }
  return map;
}
