import { db } from "@/infra/db/client";
import { flashcards, topics, goals, type NewFlashcard } from "@/infra/db/schema";
import { and, eq, asc, inArray, sql } from "drizzle-orm";

export async function listFlashcardsForGoal(ownerId: string, goalId: string) {
  return db
    .select({
      id: flashcards.id,
      topicId: flashcards.topicId,
      front: flashcards.front,
      back: flashcards.back,
    })
    .from(flashcards)
    .innerJoin(topics, eq(flashcards.topicId, topics.id))
    .where(and(eq(flashcards.ownerId, ownerId), eq(topics.goalId, goalId)))
    .orderBy(asc(flashcards.createdAt));
}

/** Card counts per topic, for the topic rows on the goal page. */
export async function countCardsByTopic(
  ownerId: string,
  topicIds: string[],
): Promise<Map<string, number>> {
  if (topicIds.length === 0) return new Map();
  const rows = await db
    .select({
      topicId: flashcards.topicId,
      count: sql<number>`count(*)`,
    })
    .from(flashcards)
    .where(and(eq(flashcards.ownerId, ownerId), inArray(flashcards.topicId, topicIds)))
    .groupBy(flashcards.topicId);
  return new Map(rows.map((r) => [r.topicId, Number(r.count)]));
}

export async function createFlashcard(input: NewFlashcard) {
  const [row] = await db.insert(flashcards).values(input).returning();
  return row;
}

export async function updateFlashcard(
  ownerId: string,
  flashcardId: string,
  fields: { front: string; back: string },
) {
  const [row] = await db
    .update(flashcards)
    .set(fields)
    .where(and(eq(flashcards.ownerId, ownerId), eq(flashcards.id, flashcardId)))
    .returning({ id: flashcards.id });
  return Boolean(row);
}

export async function deleteFlashcard(ownerId: string, flashcardId: string) {
  const [row] = await db
    .delete(flashcards)
    .where(and(eq(flashcards.ownerId, ownerId), eq(flashcards.id, flashcardId)))
    .returning({ id: flashcards.id });
  return Boolean(row);
}

/** Ownership guard for review actions. */
export async function ownsFlashcard(ownerId: string, flashcardId: string) {
  const [row] = await db
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(and(eq(flashcards.ownerId, ownerId), eq(flashcards.id, flashcardId)))
    .limit(1);
  return Boolean(row);
}

/** Resolve the goal id a topic belongs to (for revalidation), owner-scoped. */
export async function goalIdForTopic(ownerId: string, topicId: string) {
  const [row] = await db
    .select({ goalId: topics.goalId })
    .from(topics)
    .where(and(eq(topics.ownerId, ownerId), eq(topics.id, topicId)))
    .limit(1);
  return row?.goalId ?? null;
}

/** Topic title + its goal title, owner-scoped — context for AI generation. */
export async function getTopicContext(ownerId: string, topicId: string) {
  const [row] = await db
    .select({ topicTitle: topics.title, goalTitle: goals.title })
    .from(topics)
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .where(and(eq(topics.ownerId, ownerId), eq(topics.id, topicId)))
    .limit(1);
  return row ?? null;
}
