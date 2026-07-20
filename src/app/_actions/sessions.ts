"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import { createSession, ownsTopic } from "@/domain/sessions/repository";

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
    const notes = typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : null;

    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - durationMin * 60_000);

    await createSession({
      ownerId,
      topicId,
      startedAt,
      endedAt,
      durationMin: Math.round(durationMin),
      comprehension,
      notes,
    });

    revalidatePath("/");
    return { ok: true };
  });
}
