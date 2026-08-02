"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import { createSession, ownsTopic } from "@/domain/sessions/repository";
import { createNote, deriveTitle } from "@/domain/notes/repository";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function logStudySession(formData: FormData): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const durationMin = Number(formData.get("durationMin"));
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      return { ok: false, error: "Duração inválida." };
    }

    const rawTopic = formData.get("topicId");
    const topicId = typeof rawTopic === "string" && rawTopic ? rawTopic : null;
    if (topicId && !(await ownsTopic(ownerId, topicId))) {
      return { ok: false, error: "Tópico não encontrado." };
    }

    const rawComp = Number(formData.get("comprehension"));
    const comprehension =
      Number.isFinite(rawComp) && rawComp >= 1 && rawComp <= 10 ? rawComp : null;

    const notesRaw = formData.get("notes");
    const written = typeof notesRaw === "string" ? notesRaw.trim() : "";

    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - durationMin * 60_000);

    const session = await createSession({
      ownerId,
      topicId,
      startedAt,
      endedAt,
      durationMin: Math.round(durationMin),
      comprehension,
    });

    // What was written becomes a note — a document that can be revised later —
    // while the session row stays a pure record of time. Same transaction, so
    // a failure here never leaves a session claiming a note that doesn't exist.
    if (written) {
      await createNote({
        ownerId,
        topicId,
        sessionId: session.id,
        title: deriveTitle(written),
        content: written,
      });
    }

    revalidatePath("/");
    revalidatePath("/agenda");
    return { ok: true };
  });
}
