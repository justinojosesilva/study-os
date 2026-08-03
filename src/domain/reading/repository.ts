import { db } from "@/infra/db/client";
import { readingProgress, lessons, topics, goals } from "@/infra/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";

/**
 * Where the reader stopped, per lesson. Mutable state — one row per lesson,
 * updated in place — as opposed to `study_sessions`, which stays an event log.
 */

export type SavedPosition = { anchorSlug: string | null; percent: number };

export async function getProgress(
  ownerId: string,
  lessonId: string,
): Promise<SavedPosition | null> {
  const [row] = await db
    .select({ anchorSlug: readingProgress.anchorSlug, percent: readingProgress.percent })
    .from(readingProgress)
    .where(and(eq(readingProgress.ownerId, ownerId), eq(readingProgress.lessonId, lessonId)))
    .limit(1);
  return row ?? null;
}

/**
 * Upsert on (owner, lesson) — the unique index is what makes this one
 * statement instead of a read-then-write race.
 *
 * `percent` only ever grows. Scrolling back up to re-read a section is normal
 * and must not undo the furthest point reached; the anchor still follows the
 * reader, so "continue" lands where they actually are.
 */
export async function saveProgress(
  ownerId: string,
  lessonId: string,
  position: SavedPosition,
): Promise<void> {
  const percent = Math.max(0, Math.min(100, Math.round(position.percent)));
  await db
    .insert(readingProgress)
    .values({ ownerId, lessonId, anchorSlug: position.anchorSlug, percent })
    .onConflictDoUpdate({
      target: [readingProgress.ownerId, readingProgress.lessonId],
      set: {
        anchorSlug: position.anchorSlug,
        percent: sql`greatest(${readingProgress.percent}, ${percent})`,
        updatedAt: new Date(),
      },
    });
}

export type ContinueReading = {
  lessonId: string;
  lessonTitle: string;
  kind: "aula" | "lab";
  topicTitle: string;
  goalTitle: string;
  percent: number;
  anchorSlug: string | null;
  updatedAt: Date;
};

/**
 * The most recently read lessons that are neither finished nor complete —
 * the "continue reading" shortcut. A lesson marked done is dropped even at 60%,
 * because the checkbox is the reader's own statement that they are through.
 */
export async function continueReading(
  ownerId: string,
  limit = 3,
): Promise<ContinueReading[]> {
  return db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      kind: lessons.kind,
      topicTitle: topics.title,
      goalTitle: goals.title,
      percent: readingProgress.percent,
      anchorSlug: readingProgress.anchorSlug,
      updatedAt: readingProgress.updatedAt,
    })
    .from(readingProgress)
    .innerJoin(lessons, eq(readingProgress.lessonId, lessons.id))
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .where(
      and(
        eq(readingProgress.ownerId, ownerId),
        sql`${lessons.completedAt} is null`,
        sql`${readingProgress.percent} between 1 and 97`,
      ),
    )
    .orderBy(desc(readingProgress.updatedAt))
    .limit(limit);
}
