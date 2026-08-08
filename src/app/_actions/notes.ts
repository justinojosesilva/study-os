"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import {
  createNote,
  updateNote,
  deleteNote,
  deriveTitle,
} from "@/domain/notes/repository";
import { ownsTopic } from "@/domain/sessions/repository";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function parseFields(fd: FormData) {
  const content = String(fd.get("content") ?? "").trim();
  // The title is optional on purpose: the note usually opens with its own
  // heading, and asking for it twice is friction at the exact moment the user
  // is trying to dump what they just learned.
  const title = String(fd.get("title") ?? "").trim() || deriveTitle(content);
  return { title, content };
}

export async function createNoteAction(fd: FormData): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const topicId = String(fd.get("topicId") ?? "").trim();
    const goalId = String(fd.get("goalId") ?? "").trim();
    const sessionId = String(fd.get("sessionId") ?? "").trim() || null;
    const fields = parseFields(fd);
    if (!fields.content) return { ok: false, error: "Escreva alguma coisa antes de salvar." };
    if (!(await ownsTopic(ownerId, topicId))) {
      return { ok: false, error: "Tópico não encontrado." };
    }
    const row = await createNote({ ownerId, topicId, sessionId, ...fields });
    if (goalId) revalidatePath(`/goals/${goalId}`);
    revalidatePath("/agenda");
    return { ok: true, id: row.id };
  });
}

/**
 * A note written over a passage of a lesson.
 *
 * The quote goes into the body as a blockquote and into its own column: in the
 * body so the note reads on its own later, in the column so the reader can list
 * and jump to its annotations without parsing markdown back apart.
 */
export async function createAnchoredNoteAction(input: {
  lessonId: string;
  topicId: string;
  anchorSlug: string | null;
  quote: string;
  comment: string;
}): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const quote = input.quote.trim();
    const comment = input.comment.trim();
    if (!quote) return { ok: false, error: "Selecione um trecho." };
    if (!(await ownsTopic(ownerId, input.topicId))) {
      return { ok: false, error: "Tópico não encontrado." };
    }

    const quoted = quote
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
    const content = comment ? `${quoted}\n\n${comment}` : quoted;

    const row = await createNote({
      ownerId,
      topicId: input.topicId,
      lessonId: input.lessonId,
      anchorSlug: input.anchorSlug,
      quote,
      // The comment titles the note when there is one; otherwise the passage
      // does. A note titled with its own quote is still findable.
      title: deriveTitle(comment || quote),
      content,
    });

    revalidatePath(`/lessons/${input.lessonId}`);
    return { ok: true, id: row.id };
  });
}

export async function updateNoteAction(
  noteId: string,
  goalId: string,
  fd: FormData,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const fields = parseFields(fd);
    if (!fields.content) return { ok: false, error: "A anotação não pode ficar vazia." };
    const ok = await updateNote(ownerId, noteId, fields);
    if (!ok) return { ok: false, error: "Anotação não encontrada." };
    if (goalId) revalidatePath(`/goals/${goalId}`);
    revalidatePath(`/notes/${noteId}`);
    revalidatePath("/agenda");
    return { ok: true };
  });
}

export async function deleteNoteAction(noteId: string, goalId: string): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const ok = await deleteNote(ownerId, noteId);
    if (!ok) return { ok: false, error: "Anotação não encontrada." };
    if (goalId) revalidatePath(`/goals/${goalId}`);
    revalidatePath("/agenda");
    return { ok: true };
  });
}
