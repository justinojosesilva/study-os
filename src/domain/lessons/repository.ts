import { db } from "@/infra/db/client";
import { lessons, topics, goals, type NewLesson } from "@/infra/db/schema";
import { and, eq, desc } from "drizzle-orm";

export type LessonListItem = {
  id: string;
  topicId: string;
  title: string;
  kind: "aula" | "lab";
  updatedAt: Date;
  completedAt: Date | null;
};

/** Lightweight list (no content) for a goal's topics — grouped in the UI. */
export async function listLessonsForGoal(
  ownerId: string,
  goalId: string,
): Promise<LessonListItem[]> {
  return db
    .select({
      id: lessons.id,
      topicId: lessons.topicId,
      title: lessons.title,
      kind: lessons.kind,
      updatedAt: lessons.updatedAt,
      completedAt: lessons.completedAt,
    })
    .from(lessons)
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .where(and(eq(lessons.ownerId, ownerId), eq(topics.goalId, goalId)))
    .orderBy(desc(lessons.updatedAt));
}

export type LessonRead = {
  id: string;
  title: string;
  content: string;
  topicId: string;
  topicTitle: string;
  goalId: string;
  goalTitle: string;
  completedAt: Date | null;
};

/** Full lesson + its topic/goal context, for the reading page. */
export async function getLessonForReading(
  ownerId: string,
  lessonId: string,
): Promise<LessonRead | null> {
  const [row] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      content: lessons.content,
      topicId: lessons.topicId,
      topicTitle: topics.title,
      goalId: goals.id,
      goalTitle: goals.title,
      completedAt: lessons.completedAt,
    })
    .from(lessons)
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .limit(1);
  return row ?? null;
}

export async function createLesson(input: NewLesson) {
  const [row] = await db.insert(lessons).values(input).returning({ id: lessons.id });
  return row;
}

export async function updateLesson(
  ownerId: string,
  lessonId: string,
  fields: { title: string; content: string },
) {
  const [row] = await db
    .update(lessons)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .returning({ id: lessons.id });
  return Boolean(row);
}

export async function deleteLesson(ownerId: string, lessonId: string) {
  const [row] = await db
    .delete(lessons)
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .returning({ id: lessons.id });
  return Boolean(row);
}

/**
 * Marks a lesson finished, or clears it. Toggling rather than setting a flag
 * once: material gets revisited, and being able to reopen it matters as much as
 * closing it.
 */
export async function setLessonCompleted(
  ownerId: string,
  lessonId: string,
  done: boolean,
): Promise<string | null> {
  const [row] = await db
    .update(lessons)
    .set({ completedAt: done ? new Date() : null })
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .returning({ topicId: lessons.topicId });
  return row?.topicId ?? null;
}
