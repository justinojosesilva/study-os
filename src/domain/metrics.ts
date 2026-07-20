import { db } from "@/infra/db/client";
import { studySessions, topics } from "@/infra/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { toDateKey } from "@/lib/date";

/**
 * Everything here is DERIVED from the study_sessions event log and the topics
 * table — nothing is a stored counter. This is the core thesis of the model:
 * facts are append-only; metrics are computed on read.
 */

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
    .select({
      day: sql<string>`date(${studySessions.startedAt})`,
    })
    .from(studySessions)
    .where(eq(studySessions.ownerId, ownerId))
    .groupBy(sql`date(${studySessions.startedAt})`)
    .orderBy(sql`date(${studySessions.startedAt}) desc`);

  const days = new Set(rows.map((r) => r.day));
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to count today OR yesterday as the anchor.
  if (!days.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Goal progress as the weighted share of mastered topics.
 * Returns 0..100. Derived, never stored.
 */
export async function goalProgressPct(goalId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${topics.weight}), 0)`,
      mastered: sql<number>`coalesce(sum(case when ${topics.status} = 'mastered' then ${topics.weight} else 0 end), 0)`,
    })
    .from(topics)
    .where(eq(topics.goalId, goalId));

  const total = Number(row?.total ?? 0);
  const mastered = Number(row?.mastered ?? 0);
  if (total === 0) return 0;
  return Math.round((mastered / total) * 100);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
