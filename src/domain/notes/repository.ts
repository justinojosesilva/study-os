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

export type NoteSearchHit = {
  id: string;
  title: string;
  topicTitle: string | null;
  goalTitle: string | null;
  updatedAt: Date;
  /**
   * The matching excerpt, already split into plain runs and matched runs, so
   * the page never has to inject HTML to show the highlight.
   */
  snippet: { text: string; hit: boolean }[];
};

// Postgres wraps matches in these; anything else would collide with real text.
const SEL_START = "␟";
const SEL_STOP = "␞";

/**
 * The excerpt comes out of the raw markdown, so a hit inside a table showed up
 * as `| --- | **injeção** |`. Stripped here rather than at index time: the
 * body must stay exactly as written, and the search still has to match the
 * word inside `**bold**`.
 *
 * Applied per run, after the split — the markers are single characters that no
 * rule below can touch.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\|?\s*:?-{2,}:?\s*(?=\||$)/gm, "") // table rule rows
    .replace(/[*_`>]/g, "")
    .replace(/\|/g, " ")
    .replace(/[ \t]{2,}/g, " ");
}

function splitHeadline(raw: string): { text: string; hit: boolean }[] {
  return raw
    .split(new RegExp(`(${SEL_START}[^${SEL_STOP}]*${SEL_STOP})`, "g"))
    .map((part) =>
      part.startsWith(SEL_START)
        ? { text: stripMarkdown(part.slice(1, -1)), hit: true }
        : { text: stripMarkdown(part), hit: false },
    )
    .filter((part) => part.text.length > 0);
}

/**
 * Full-text search over the user's notes.
 *
 * `websearch_to_tsquery` rather than `plainto_tsquery` so quoted phrases and
 * `or` work the way they do in a search box. `pt_unaccent` throughout — the
 * index expression uses the same name, and any other config would silently
 * fall back to a sequential scan.
 *
 * What this buys, measured rather than assumed: accent-insensitive typing and
 * regular inflection. It does NOT make "injeções" find "injeção" — the
 * Portuguese stemmer keeps those apart.
 */
export async function searchNotes(
  ownerId: string,
  query: string,
  limit = 40,
): Promise<NoteSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const vector = sql`to_tsvector('pt_unaccent', ${notes.title} || ' ' || ${notes.content})`;
  const tsquery = sql`websearch_to_tsquery('pt_unaccent', ${q})`;

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      topicTitle: topics.title,
      goalTitle: goals.title,
      updatedAt: notes.updatedAt,
      headline: sql<string>`ts_headline(
        'pt_unaccent',
        ${notes.content},
        ${tsquery},
        ${`StartSel=${SEL_START}, StopSel=${SEL_STOP}, MaxWords=28, MinWords=12, MaxFragments=2, FragmentDelimiter= … `}
      )`,
    })
    .from(notes)
    .leftJoin(topics, eq(notes.topicId, topics.id))
    .leftJoin(goals, eq(topics.goalId, goals.id))
    .where(and(eq(notes.ownerId, ownerId), sql`${vector} @@ ${tsquery}`))
    .orderBy(sql`ts_rank(${vector}, ${tsquery}) desc`)
    .limit(limit);

  // Ranking happens in ORDER BY; the score itself is never shown, so it does
  // not need to travel back.
  return rows.map(({ headline, ...r }) => ({
    ...r,
    snippet: splitHeadline(headline),
  }));
}

export type NoteBrowseItem = {
  id: string;
  title: string;
  topicTitle: string | null;
  goalTitle: string | null;
  nextStep: string | null;
  createdAt: Date;
  updatedAt: Date;
  length: number;
};

/** Every note, newest first — what the page shows before anything is typed. */
export async function listAllNotes(ownerId: string): Promise<NoteBrowseItem[]> {
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      topicTitle: topics.title,
      goalTitle: goals.title,
      nextStep: notes.nextStep,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      length: sql<number>`length(${notes.content})`,
    })
    .from(notes)
    .leftJoin(topics, eq(notes.topicId, topics.id))
    .leftJoin(goals, eq(topics.goalId, goals.id))
    .where(eq(notes.ownerId, ownerId))
    .orderBy(desc(notes.createdAt));
  return rows.map((r) => ({ ...r, length: Number(r.length) }));
}

/**
 * Bodies included — for the AI paths (tutor context, quiz material), which are
 * the only callers that need the text itself. Newest first, because a rewritten
 * synthesis supersedes the draft it came from and both rows survive.
 */
export async function listNotesForTopicWithContent(
  ownerId: string,
  topicId: string,
  limit = 6,
): Promise<{ title: string; content: string }[]> {
  return db
    .select({ title: notes.title, content: notes.content })
    .from(notes)
    .where(and(eq(notes.ownerId, ownerId), eq(notes.topicId, topicId)))
    .orderBy(desc(notes.updatedAt))
    .limit(limit);
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
