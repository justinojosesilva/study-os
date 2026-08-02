import { db } from "@/infra/db/client";
import { notes, topics, goals, studySessions, type NewNote } from "@/infra/db/schema";
import { and, eq, desc, sql, inArray } from "drizzle-orm";

/**
 * Notes are what the user produced while studying — markdown documents about a
 * topic, revisable, as opposed to `lessons` (material to consume) and to
 * `study_sessions` (an immutable log of time).
 */

/** First meaningful line of the body, used when no title was given. */
export function deriveTitle(content: string): string {
  const line =
    content
      .split("\n")
      // Skip markdown heading marks and blank lines so "## A hierarquia"
      // becomes "A hierarquia" rather than a title starting with hashes.
      .map((l) => l.replace(/^#{1,6}\s*/, "").trim())
      .find((l) => l.length > 0) ?? "";
  return line.length > 80 ? `${line.slice(0, 79)}…` : line || "Sem título";
}

export type NoteListItem = {
  id: string;
  topicId: string | null;
  title: string;
  nextStep: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Characters in the body — the list shows how much is behind each entry. */
  length: number;
};

/**
 * The list never ships the body — notes run to thousands of characters and the
 * goal page loads every one of them. `length()` in SQL gives the size without
 * moving the text.
 */
const LIST_COLUMNS = {
  id: notes.id,
  topicId: notes.topicId,
  title: notes.title,
  nextStep: notes.nextStep,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt,
  length: sql<number>`length(${notes.content})`,
};

/** Lightweight list (no body) for a goal's topics — grouped in the UI. */
export async function listNotesForGoal(
  ownerId: string,
  goalId: string,
): Promise<NoteListItem[]> {
  const rows = await db
    .select(LIST_COLUMNS)
    .from(notes)
    .innerJoin(topics, eq(notes.topicId, topics.id))
    .where(and(eq(notes.ownerId, ownerId), eq(topics.goalId, goalId)))
    .orderBy(desc(notes.updatedAt));
  return rows.map((r) => ({ ...r, length: Number(r.length) }));
}

export async function listNotesForTopic(
  ownerId: string,
  topicId: string,
): Promise<NoteListItem[]> {
  const rows = await db
    .select(LIST_COLUMNS)
    .from(notes)
    .where(and(eq(notes.ownerId, ownerId), eq(notes.topicId, topicId)))
    .orderBy(desc(notes.updatedAt));
  return rows.map((r) => ({ ...r, length: Number(r.length) }));
}

export type NoteRead = {
  id: string;
  title: string;
  content: string;
  nextStep: string | null;
  createdAt: Date;
  updatedAt: Date;
  topicId: string | null;
  topicTitle: string | null;
  goalId: string | null;
  goalTitle: string | null;
  /** When the note was written during a timed block, how long it ran. */
  sessionMinutes: number | null;
  sessionStartedAt: Date | null;
};

/** Full note + its topic/goal context, for the reading and editing page. */
export async function getNote(ownerId: string, noteId: string): Promise<NoteRead | null> {
  const [row] = await db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      nextStep: notes.nextStep,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      topicId: notes.topicId,
      topicTitle: topics.title,
      goalId: goals.id,
      goalTitle: goals.title,
      sessionMinutes: studySessions.durationMin,
      sessionStartedAt: studySessions.startedAt,
    })
    .from(notes)
    // Left joins: a note written during "estudo livre" has no topic, and so no
    // goal either. The page falls back to a topic-less breadcrumb.
    .leftJoin(topics, eq(notes.topicId, topics.id))
    .leftJoin(goals, eq(topics.goalId, goals.id))
    .leftJoin(studySessions, eq(notes.sessionId, studySessions.id))
    .where(and(eq(notes.ownerId, ownerId), eq(notes.id, noteId)))
    .limit(1);
  return row ?? null;
}

/** The notes written during a set of sessions, for the agenda and calendar. */
export async function listNotesBySessions(
  ownerId: string,
  sessionIds: string[],
): Promise<Map<string, { id: string; title: string; content: string }>> {
  if (sessionIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: notes.id,
      sessionId: notes.sessionId,
      title: notes.title,
      content: notes.content,
    })
    .from(notes)
    .where(and(eq(notes.ownerId, ownerId), inArray(notes.sessionId, sessionIds)));
  const out = new Map<string, { id: string; title: string; content: string }>();
  for (const r of rows) {
    if (r.sessionId) out.set(r.sessionId, { id: r.id, title: r.title, content: r.content });
  }
  return out;
}

export async function createNote(input: NewNote) {
  const [row] = await db.insert(notes).values(input).returning({ id: notes.id });
  return row;
}

export async function updateNote(
  ownerId: string,
  noteId: string,
  fields: { title: string; content: string; nextStep: string | null },
) {
  const [row] = await db
    .update(notes)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(notes.ownerId, ownerId), eq(notes.id, noteId)))
    .returning({ id: notes.id });
  return Boolean(row);
}

export async function deleteNote(ownerId: string, noteId: string) {
  const [row] = await db
    .delete(notes)
    .where(and(eq(notes.ownerId, ownerId), eq(notes.id, noteId)))
    .returning({ id: notes.id });
  return Boolean(row);
}
