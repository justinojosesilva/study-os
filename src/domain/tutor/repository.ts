import { db } from "@/infra/db/client";
import { tutorAnswers } from "@/infra/db/schema";
import { and, eq, desc } from "drizzle-orm";

/**
 * The tutor's replies used to live only in the open dialog and vanish on close.
 * Keeping them turns a throwaway answer into study material the topic quiz can
 * draw on, and gives the topic a readable record of what was already asked.
 */
export async function saveTutorAnswer(input: {
  ownerId: string;
  topicId: string;
  mode: string;
  question: string | null;
  answer: string;
}) {
  const [row] = await db.insert(tutorAnswers).values(input).returning({ id: tutorAnswers.id });
  return row;
}

export async function listTutorAnswers(ownerId: string, topicId: string, limit = 20) {
  return db
    .select({
      id: tutorAnswers.id,
      mode: tutorAnswers.mode,
      question: tutorAnswers.question,
      answer: tutorAnswers.answer,
      createdAt: tutorAnswers.createdAt,
    })
    .from(tutorAnswers)
    .where(and(eq(tutorAnswers.ownerId, ownerId), eq(tutorAnswers.topicId, topicId)))
    .orderBy(desc(tutorAnswers.createdAt))
    .limit(limit);
}

export async function countTutorAnswers(ownerId: string, topicId: string) {
  const rows = await listTutorAnswers(ownerId, topicId, 100);
  return rows.length;
}
