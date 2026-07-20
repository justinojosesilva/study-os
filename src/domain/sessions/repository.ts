import { db } from "@/infra/db/client";
import { studySessions, topics, type NewStudySession } from "@/infra/db/schema";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";

export async function createSession(input: NewStudySession) {
  const [row] = await db.insert(studySessions).values(input).returning();
  return row;
}

export async function listRecentSessions(ownerId: string, limit = 8) {
  return db
    .select({
      id: studySessions.id,
      startedAt: studySessions.startedAt,
      durationMin: studySessions.durationMin,
      comprehension: studySessions.comprehension,
      notes: studySessions.notes,
      topicTitle: topics.title,
    })
    .from(studySessions)
    .leftJoin(topics, eq(topics.id, studySessions.topicId))
    .where(eq(studySessions.ownerId, ownerId))
    .orderBy(desc(studySessions.startedAt))
    .limit(limit);
}

/** Sessions in a [start, end) window with topic title — for the month calendar's
 *  past-day history. Ascending by time so a day's sessions read in order. */
export async function listSessionsBetween(ownerId: string, start: Date, end: Date) {
  return db
    .select({
      id: studySessions.id,
      startedAt: studySessions.startedAt,
      durationMin: studySessions.durationMin,
      comprehension: studySessions.comprehension,
      topicTitle: topics.title,
    })
    .from(studySessions)
    .leftJoin(topics, eq(topics.id, studySessions.topicId))
    .where(
      and(
        eq(studySessions.ownerId, ownerId),
        gte(studySessions.startedAt, start),
        lt(studySessions.startedAt, end),
      ),
    )
    .orderBy(asc(studySessions.startedAt));
}

/** Ownership guard for a topic id submitted from the client. */
export async function ownsTopic(ownerId: string, topicId: string) {
  const [row] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.ownerId, ownerId), eq(topics.id, topicId)))
    .limit(1);
  return Boolean(row);
}
