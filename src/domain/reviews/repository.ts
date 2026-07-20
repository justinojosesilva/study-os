import { db } from "@/infra/db/client";
import {
  flashcardReviews,
  flashcards,
  topics,
  goals,
  type NewFlashcardReview,
  type FlashcardReview,
} from "@/infra/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import type { StoredCard } from "./scheduler";

export type DueCard = {
  flashcardId: string;
  front: string;
  back: string;
  topicTitle: string;
  goalTitle: string;
  due: Date | null; // null = never reviewed (a fresh card)
};

export function reviewToStoredCard(r: FlashcardReview): StoredCard {
  return {
    state: r.state,
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    elapsedDays: r.elapsedDays,
    scheduledDays: r.scheduledDays,
    learningSteps: r.learningSteps,
    reps: r.reps,
    lapses: r.lapses,
    lastReview: r.lastReview,
  };
}

export async function getLatestReview(
  ownerId: string,
  flashcardId: string,
): Promise<FlashcardReview | null> {
  const [row] = await db
    .select()
    .from(flashcardReviews)
    .where(
      and(
        eq(flashcardReviews.ownerId, ownerId),
        eq(flashcardReviews.flashcardId, flashcardId),
      ),
    )
    .orderBy(desc(flashcardReviews.reviewedAt))
    .limit(1);
  return row ?? null;
}

export async function recordReview(input: NewFlashcardReview) {
  const [row] = await db.insert(flashcardReviews).values(input).returning();
  return row;
}

/**
 * The review queue: flashcards in an active goal that are due now or have never
 * been reviewed. New cards sort first, then by due. The card's current memory
 * state = its most recent flashcard_reviews row.
 */
export async function listDueCards(
  ownerId: string,
  now: Date = new Date(),
): Promise<DueCard[]> {
  const eligible = await db
    .select({
      id: flashcards.id,
      front: flashcards.front,
      back: flashcards.back,
      topicTitle: topics.title,
      goalTitle: goals.title,
    })
    .from(flashcards)
    .innerJoin(topics, eq(flashcards.topicId, topics.id))
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .where(and(eq(flashcards.ownerId, ownerId), eq(goals.status, "active")));

  if (eligible.length === 0) return [];

  const reviews = await db
    .select()
    .from(flashcardReviews)
    .where(
      and(
        eq(flashcardReviews.ownerId, ownerId),
        inArray(
          flashcardReviews.flashcardId,
          eligible.map((e) => e.id),
        ),
      ),
    )
    .orderBy(desc(flashcardReviews.reviewedAt));

  const latest = new Map<string, FlashcardReview>();
  for (const r of reviews) if (!latest.has(r.flashcardId)) latest.set(r.flashcardId, r);

  const due: DueCard[] = [];
  for (const c of eligible) {
    const r = latest.get(c.id);
    if (!r || r.due.getTime() <= now.getTime()) {
      due.push({
        flashcardId: c.id,
        front: c.front,
        back: c.back,
        topicTitle: c.topicTitle,
        goalTitle: c.goalTitle,
        due: r?.due ?? null,
      });
    }
  }

  due.sort((a, b) => {
    if (a.due === null) return b.due === null ? 0 : -1;
    if (b.due === null) return 1;
    return a.due.getTime() - b.due.getTime();
  });

  return due;
}

export async function countDueCards(
  ownerId: string,
  now: Date = new Date(),
): Promise<number> {
  return (await listDueCards(ownerId, now)).length;
}
