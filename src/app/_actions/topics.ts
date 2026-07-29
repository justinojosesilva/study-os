"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import { createTopic, setTopicStatus, deleteTopic } from "@/domain/topics/repository";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Statuses a person can set by hand. `mastered` is absent on purpose: it is
 * awarded by passing the exam, so mastery stays evidence rather than a claim.
 * Moving a mastered topic back down is still allowed — only the promotion is
 * reserved for the exam.
 */
const STATUSES = ["todo", "learning", "praticando"] as const;
type Status = (typeof STATUSES)[number];

function revalidateGoal(goalId: string) {
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/");
}

export async function createTopicAction(formData: FormData): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const goalId = String(formData.get("goalId") ?? "");
    if (!goalId) return { ok: false, error: "Objetivo ausente." };

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Dê um título ao tópico." };

    const rawWeight = Number(formData.get("weight"));
    const weight = Number.isFinite(rawWeight) && rawWeight >= 1 ? Math.round(rawWeight) : 1;

    await createTopic({ ownerId, goalId, title, weight });
    revalidateGoal(goalId);
    return { ok: true };
  });
}

export async function setTopicStatusAction(
  topicId: string,
  status: Status,
): Promise<ActionResult> {
  if (!STATUSES.includes(status)) {
    return { ok: false, error: "Dominado é conquistado na prova, não marcado à mão." };
  }
  return scoped(async (ownerId) => {
    const goalId = await setTopicStatus(ownerId, topicId, status);
    if (!goalId) return { ok: false, error: "Tópico não encontrado." };
    revalidateGoal(goalId);
    return { ok: true };
  });
}

export async function deleteTopicAction(topicId: string): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const goalId = await deleteTopic(ownerId, topicId);
    if (!goalId) return { ok: false, error: "Tópico não encontrado." };
    revalidateGoal(goalId);
    return { ok: true };
  });
}
