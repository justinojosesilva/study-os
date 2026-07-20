import { db } from "@/infra/db/client";
import { flashcardReviews, flashcards, topics, goals } from "@/infra/db/schema";
import { and, eq, gte, inArray, desc, sql } from "drizzle-orm";
import { startOfToday, addDays, toDateKey } from "@/lib/date";

export type ReviewStats = {
  totalCards: number;
  totalReviews: number;
  reviewedToday: number;
  retentionPct: number; // (reviews not rated "Esqueci") / total, all-time
  perDay: { date: Date; count: number }[]; // last 14 days
  ratingMix: { again: number; hard: number; good: number; easy: number }; // 30d
  forecast: { date: Date; count: number }[]; // next 7 days (day 0 = overdue + new + due today)
};

export async function getReviewStats(ownerId: string): Promise<ReviewStats> {
  const today = startOfToday();
  const perDayStart = addDays(today, -13);
  const ratingStart = addDays(today, -29);

  const [agg] = await db
    .select({
      total: sql<number>`count(*)`,
      again: sql<number>`count(*) filter (where ${flashcardReviews.rating} = 1)`,
      today: sql<number>`count(*) filter (where ${flashcardReviews.reviewedAt} >= ${today.toISOString()})`,
    })
    .from(flashcardReviews)
    .where(eq(flashcardReviews.ownerId, ownerId));

  const [cardAgg] = await db
    .select({ cards: sql<number>`count(*)` })
    .from(flashcards)
    .where(eq(flashcards.ownerId, ownerId));

  const perDayRows = await db
    .select({ reviewedAt: flashcardReviews.reviewedAt })
    .from(flashcardReviews)
    .where(
      and(
        eq(flashcardReviews.ownerId, ownerId),
        gte(flashcardReviews.reviewedAt, perDayStart),
      ),
    );
  const perDayMap = new Map<string, number>();
  for (const r of perDayRows) {
    const k = toDateKey(r.reviewedAt);
    perDayMap.set(k, (perDayMap.get(k) ?? 0) + 1);
  }
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(perDayStart, i);
    return { date: d, count: perDayMap.get(toDateKey(d)) ?? 0 };
  });

  const ratingRows = await db
    .select({ rating: flashcardReviews.rating, count: sql<number>`count(*)` })
    .from(flashcardReviews)
    .where(
      and(
        eq(flashcardReviews.ownerId, ownerId),
        gte(flashcardReviews.reviewedAt, ratingStart),
      ),
    )
    .groupBy(flashcardReviews.rating);
  const ratingMix = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const r of ratingRows) {
    const n = Number(r.count);
    if (r.rating === 1) ratingMix.again = n;
    else if (r.rating === 2) ratingMix.hard = n;
    else if (r.rating === 3) ratingMix.good = n;
    else if (r.rating === 4) ratingMix.easy = n;
  }

  const forecast = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(today, i),
    count: 0,
  }));
  const dueDates = await cardDueDates(ownerId);
  for (const due of dueDates) {
    if (due === null) {
      forecast[0].count += 1; // never reviewed = available now
      continue;
    }
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    const idx = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
    if (idx <= 0) forecast[0].count += 1;
    else if (idx < 7) forecast[idx].count += 1;
  }

  const total = Number(agg?.total ?? 0);
  const again = Number(agg?.again ?? 0);
  return {
    totalCards: Number(cardAgg?.cards ?? 0),
    totalReviews: total,
    reviewedToday: Number(agg?.today ?? 0),
    retentionPct: total > 0 ? Math.round(((total - again) / total) * 100) : 0,
    perDay,
    ratingMix,
    forecast,
  };
}

/** Latest-review due date per flashcard (null = never reviewed), active goals. */
async function cardDueDates(ownerId: string): Promise<(Date | null)[]> {
  const cards = await db
    .select({ id: flashcards.id })
    .from(flashcards)
    .innerJoin(topics, eq(flashcards.topicId, topics.id))
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .where(and(eq(flashcards.ownerId, ownerId), eq(goals.status, "active")));
  if (cards.length === 0) return [];

  const reviews = await db
    .select({ flashcardId: flashcardReviews.flashcardId, due: flashcardReviews.due })
    .from(flashcardReviews)
    .where(
      and(
        eq(flashcardReviews.ownerId, ownerId),
        inArray(
          flashcardReviews.flashcardId,
          cards.map((c) => c.id),
        ),
      ),
    )
    .orderBy(desc(flashcardReviews.reviewedAt));

  const latest = new Map<string, Date>();
  for (const r of reviews) if (!latest.has(r.flashcardId)) latest.set(r.flashcardId, r.due);
  return cards.map((c) => latest.get(c.id) ?? null);
}
