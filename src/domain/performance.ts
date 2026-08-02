import { db } from "@/infra/db/client";
import {
  exams,
  topics,
  goals,
  studySessions,
  flashcardReviews,
} from "@/infra/db/schema";
import { and, eq, sql, isNotNull, gte, inArray } from "drizzle-orm";
import { toDateKey, addDays } from "@/lib/date";

/**
 * Measurement, as opposed to the gamification on the same page: this is about
 * whether the studying is working, not about rewarding it.
 *
 * Everything here is derived on read from the event logs, like the rest of the
 * app — there is no stored score anywhere.
 */

/**
 * Ratings are 1=again, 2=hard, 3=good, 4=easy. Only "again" is a failure —
 * "hard" means the card WAS recalled, with effort. Counting it as a miss would
 * report 3% retention on data that is 88% "hard", which is both wrong and
 * demoralising. "Effortless" is tracked separately because the gap between the
 * two lines is the interesting part: recalling everything the hard way is a
 * real signal, just not a failure.
 */
const RECALLED = 2;
const EFFORTLESS = 3;

export type GoalPerformance = {
  goalId: string;
  title: string;
  category: "faculdade" | "profissional" | "certificacao";
  /** Goal-wide exams and topic quizzes are kept apart: different scopes, and
   *  averaging them together would hide doing well on parts while doing badly
   *  on the whole. */
  examAvg: number | null;
  examCount: number;
  quizAvg: number | null;
  quizCount: number;
  hours: number;
  progressPct: number;
};

export async function goalPerformance(ownerId: string): Promise<GoalPerformance[]> {
  const rows = await db
    .select({
      goalId: goals.id,
      title: goals.title,
      category: goals.category,
      examAvg: sql<number | null>`avg(${exams.scorePct}) filter (where ${exams.topicId} is null)`,
      examCount: sql<number>`count(${exams.id}) filter (where ${exams.topicId} is null)`,
      quizAvg: sql<number | null>`avg(${exams.scorePct}) filter (where ${exams.topicId} is not null)`,
      quizCount: sql<number>`count(${exams.id}) filter (where ${exams.topicId} is not null)`,
    })
    .from(goals)
    .leftJoin(
      exams,
      and(eq(exams.goalId, goals.id), isNotNull(exams.completedAt)),
    )
    .where(and(eq(goals.ownerId, ownerId), eq(goals.status, "active")))
    .groupBy(goals.id);

  // Hours and progress come from their own shapes; joining them into the query
  // above would multiply rows across sessions and topics.
  const [hourRows, topicRows] = await Promise.all([
    db
      .select({
        goalId: topics.goalId,
        minutes: sql<number>`coalesce(sum(${studySessions.durationMin}), 0)`,
      })
      .from(studySessions)
      .innerJoin(topics, eq(studySessions.topicId, topics.id))
      .where(eq(studySessions.ownerId, ownerId))
      .groupBy(topics.goalId),
    db
      .select({
        goalId: topics.goalId,
        total: sql<number>`coalesce(sum(${topics.weight}), 0)`,
        earned: sql<number>`coalesce(sum(case ${topics.status}
          when 'mastered' then ${topics.weight}::numeric
          when 'praticando' then ${topics.weight}::numeric * 0.5
          else 0 end), 0)`,
      })
      .from(topics)
      .where(eq(topics.ownerId, ownerId))
      .groupBy(topics.goalId),
  ]);

  const hoursBy = new Map(hourRows.map((r) => [r.goalId, Number(r.minutes) / 60]));
  const progressBy = new Map(
    topicRows.map((r) => [
      r.goalId,
      Number(r.total) === 0 ? 0 : Math.round((Number(r.earned) / Number(r.total)) * 100),
    ]),
  );

  return rows.map((r) => ({
    goalId: r.goalId,
    title: r.title,
    category: r.category,
    examAvg: r.examAvg === null ? null : Math.round(Number(r.examAvg)),
    examCount: Number(r.examCount),
    quizAvg: r.quizAvg === null ? null : Math.round(Number(r.quizAvg)),
    quizCount: Number(r.quizCount),
    hours: Math.round((hoursBy.get(r.goalId) ?? 0) * 10) / 10,
    progressPct: progressBy.get(r.goalId) ?? 0,
  }));
}

export type PhasePerformance = {
  goalId: string;
  goalTitle: string;
  phase: string;
  topics: number;
  /** Average quiz score across the phase's topics; null until one is taken. */
  avgScore: number | null;
  progressPct: number;
};

/**
 * Average per phase — the grouping the roadmap already thinks in.
 *
 * Two queries rather than one join: a topic can have several quizzes, and
 * joining them would repeat the topic's own weight once per attempt, inflating
 * the phase's progress. Same reason the goal query keeps hours separate.
 */
export async function phasePerformance(ownerId: string): Promise<PhasePerformance[]> {
  const [topicRows, scoreRows] = await Promise.all([
    db
      .select({
        goalId: goals.id,
        goalTitle: goals.title,
        phase: topics.phase,
        topicId: topics.id,
        status: topics.status,
        sortOrder: topics.sortOrder,
      })
      .from(topics)
      .innerJoin(goals, eq(topics.goalId, goals.id))
      .where(
        and(eq(topics.ownerId, ownerId), eq(goals.status, "active"), isNotNull(topics.phase)),
      )
      .orderBy(topics.sortOrder),
    db
      .select({
        topicId: exams.topicId,
        avg: sql<number>`avg(${exams.scorePct})`,
      })
      .from(exams)
      .where(
        and(
          eq(exams.ownerId, ownerId),
          isNotNull(exams.topicId),
          isNotNull(exams.completedAt),
        ),
      )
      .groupBy(exams.topicId),
  ]);

  const scoreBy = new Map(scoreRows.map((r) => [r.topicId!, Number(r.avg)]));

  // Insertion order follows sortOrder, so phases come out in roadmap order.
  const merged = new Map<
    string,
    PhasePerformance & { scoreSum: number; scoreN: number; earned: number }
  >();
  for (const t of topicRows) {
    const key = `${t.goalId}|${t.phase}`;
    const cur =
      merged.get(key) ??
      {
        goalId: t.goalId,
        goalTitle: t.goalTitle,
        phase: t.phase!,
        topics: 0,
        avgScore: null,
        progressPct: 0,
        scoreSum: 0,
        scoreN: 0,
        earned: 0,
      };
    cur.topics += 1;
    cur.earned += t.status === "mastered" ? 1 : t.status === "praticando" ? 0.5 : 0;
    const score = scoreBy.get(t.topicId);
    if (score !== undefined) {
      cur.scoreSum += score;
      cur.scoreN += 1;
    }
    merged.set(key, cur);
  }

  return [...merged.values()].map((m) => ({
    goalId: m.goalId,
    goalTitle: m.goalTitle,
    phase: m.phase,
    topics: m.topics,
    avgScore: m.scoreN === 0 ? null : Math.round(m.scoreSum / m.scoreN),
    progressPct: m.topics === 0 ? 0 : Math.round((m.earned / m.topics) * 100),
  }));
}

export type RetentionPoint = {
  label: string;
  /** Recalled at all (rating ≥ 2). */
  pct: number;
  /** Recalled without struggling (rating ≥ 3). */
  easyPct: number;
  reviews: number;
};

/**
 * Weekly hit rate across flashcard reviews — the learning curve that already
 * exists in the data and was never shown anywhere.
 *
 * Bucketed in JS rather than SQL `date_trunc`, matching the rest of the app:
 * the database session runs in UTC, so grouping there would file an evening
 * review under the next day.
 */
export async function retentionTrend(ownerId: string, weeks = 12): Promise<RetentionPoint[]> {
  const since = addDays(new Date(), -weeks * 7);
  const rows = await db
    .select({ reviewedAt: flashcardReviews.reviewedAt, rating: flashcardReviews.rating })
    .from(flashcardReviews)
    .where(
      and(eq(flashcardReviews.ownerId, ownerId), gte(flashcardReviews.reviewedAt, since)),
    );

  const buckets = new Map<string, { hit: number; easy: number; total: number }>();
  for (const r of rows) {
    // Monday-anchored week, so a point covers a whole study week.
    const d = new Date(r.reviewedAt);
    const dow = d.getDay();
    const monday = addDays(d, -(dow === 0 ? 6 : dow - 1));
    const key = toDateKey(monday);
    const b = buckets.get(key) ?? { hit: 0, easy: 0, total: 0 };
    b.total += 1;
    if (r.rating >= RECALLED) b.hit += 1;
    if (r.rating >= EFFORTLESS) b.easy += 1;
    buckets.set(key, b);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, b]) => {
      const [, m, d] = key.split("-");
      return {
        label: `${d}/${m}`,
        pct: Math.round((b.hit / b.total) * 100),
        easyPct: Math.round((b.easy / b.total) * 100),
        reviews: b.total,
      };
    });
}

export type Calibration = {
  topicId: string;
  topicTitle: string;
  goalTitle: string;
  /** Self-rating 1–10 from sessions, rescaled to 0–100 to sit beside the score. */
  declaredPct: number;
  verifiedPct: number;
  gap: number;
};

/**
 * Where self-assessment and measured result disagree.
 *
 * This is the exam's whole premise turned into a view: believing you know
 * something is not the same as showing it, and the useful cases are the topics
 * you rate highly and score badly on.
 */
export async function calibration(ownerId: string): Promise<Calibration[]> {
  const declared = await db
    .select({
      topicId: studySessions.topicId,
      avg: sql<number>`avg(${studySessions.comprehension})`,
    })
    .from(studySessions)
    .where(
      and(eq(studySessions.ownerId, ownerId), isNotNull(studySessions.comprehension)),
    )
    .groupBy(studySessions.topicId);

  const ids = declared.map((d) => d.topicId).filter((id): id is string => id !== null);
  if (ids.length === 0) return [];

  const verified = await db
    .select({
      topicId: exams.topicId,
      avg: sql<number>`avg(${exams.scorePct})`,
    })
    .from(exams)
    .where(
      and(
        eq(exams.ownerId, ownerId),
        isNotNull(exams.completedAt),
        inArray(exams.topicId, ids),
      ),
    )
    .groupBy(exams.topicId);

  const verifiedBy = new Map(verified.map((v) => [v.topicId!, Number(v.avg)]));

  const titles = await db
    .select({ id: topics.id, title: topics.title, goalTitle: goals.title })
    .from(topics)
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .where(inArray(topics.id, ids));
  const titleBy = new Map(titles.map((t) => [t.id, t]));

  const out: Calibration[] = [];
  for (const d of declared) {
    if (!d.topicId) continue;
    const v = verifiedBy.get(d.topicId);
    // Only topics with both halves can be compared at all.
    if (v === undefined) continue;
    const t = titleBy.get(d.topicId);
    if (!t) continue;
    const declaredPct = Math.round(Number(d.avg) * 10);
    const verifiedPct = Math.round(v);
    out.push({
      topicId: d.topicId,
      topicTitle: t.title,
      goalTitle: t.goalTitle,
      declaredPct,
      verifiedPct,
      gap: declaredPct - verifiedPct,
    });
  }
  // Biggest overconfidence first: that's the actionable end.
  return out.sort((a, b) => b.gap - a.gap);
}
