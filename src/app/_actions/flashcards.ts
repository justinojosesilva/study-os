"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import {
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
  goalIdForTopic,
} from "@/domain/flashcards/repository";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createFlashcardAction(formData: FormData): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const topicId = String(formData.get("topicId") ?? "");
    if (!topicId) return { ok: false, error: "Tópico ausente." };

    const front = String(formData.get("front") ?? "").trim();
    const back = String(formData.get("back") ?? "").trim();
    if (!front || !back) return { ok: false, error: "Preencha frente e verso." };

    const goalId = await goalIdForTopic(ownerId, topicId);
    if (!goalId) return { ok: false, error: "Tópico não encontrado." };

    await createFlashcard({ ownerId, topicId, front, back });
    revalidatePath(`/goals/${goalId}`);
    revalidatePath("/");
    return { ok: true };
  });
}

export async function updateFlashcardAction(
  flashcardId: string,
  goalId: string,
  front: string,
  back: string,
): Promise<ActionResult> {
  const f = front.trim();
  const b = back.trim();
  if (!f || !b) return { ok: false, error: "Preencha frente e verso." };

  return scoped(async (ownerId) => {
    const ok = await updateFlashcard(ownerId, flashcardId, { front: f, back: b });
    if (!ok) return { ok: false, error: "Card não encontrado." };

    revalidatePath(`/goals/${goalId}`);
    revalidatePath("/");
    return { ok: true };
  });
}

export async function deleteFlashcardAction(
  flashcardId: string,
  goalId: string,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const ok = await deleteFlashcard(ownerId, flashcardId);
    if (!ok) return { ok: false, error: "Card não encontrado." };

    revalidatePath(`/goals/${goalId}`);
    revalidatePath("/");
    return { ok: true };
  });
}
