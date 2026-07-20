"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import { createTopic, setTopicStatus, deleteTopic } from "@/domain/topics/repository";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATUSES = ["todo", "learning", "mastered"] as const;
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
  if (!STATUSES.includes(status)) return { ok: false, error: "Status inválido." };
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
