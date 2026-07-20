import { db } from "@/infra/db/client";
import { topics, goals, type NewTopic, type Topic } from "@/infra/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";

export type PickerTopic = {
  id: string;
  title: string;
  goalTitle: string;
};

/** Flat list of the user's topics with their goal name, for a session picker. */
export async function listTopicsForPicker(ownerId: string): Promise<PickerTopic[]> {
  return db
    .select({
      id: topics.id,
      title: topics.title,
      goalTitle: goals.title,
    })
    .from(topics)
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .where(eq(topics.ownerId, ownerId))
    .orderBy(asc(goals.title), asc(topics.sortOrder));
}

export async function createTopic(input: NewTopic): Promise<Topic> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${topics.sortOrder}), -1) + 1` })
    .from(topics)
    .where(eq(topics.goalId, input.goalId));

  const [row] = await db
    .insert(topics)
    .values({ ...input, sortOrder: input.sortOrder ?? Number(next) })
    .returning();
  return row;
}

/** Status mutation, scoped by owner. Returns the goalId for revalidation. */
export async function setTopicStatus(
  ownerId: string,
  topicId: string,
  status: Topic["status"],
): Promise<string | null> {
  const [row] = await db
    .update(topics)
    .set({ status })
    .where(and(eq(topics.ownerId, ownerId), eq(topics.id, topicId)))
    .returning({ goalId: topics.goalId });
  return row?.goalId ?? null;
}

export async function deleteTopic(
  ownerId: string,
  topicId: string,
): Promise<string | null> {
  const [row] = await db
    .delete(topics)
    .where(and(eq(topics.ownerId, ownerId), eq(topics.id, topicId)))
    .returning({ goalId: topics.goalId });
  return row?.goalId ?? null;
}
