"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import {
  createTopic,
  setTopicStatus,
  setTopicPhase,
  reorderTopics,
  deleteTopic,
} from "@/domain/topics/repository";

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

export async function setTopicPhaseAction(
  topicId: string,
  phase: string | null,
): Promise<ActionResult> {
  const clean = phase?.trim() || null;
  if (clean && clean.length > 60) {
    return { ok: false, error: "Nome de fase muito longo." };
  }
  return scoped(async (ownerId) => {
    const goalId = await setTopicPhase(ownerId, topicId, clean);
    if (!goalId) return { ok: false, error: "Tópico não encontrado." };
    revalidateGoal(goalId);
    return { ok: true };
  });
}

/**
 * Grava a ordem manual do objetivo. Recebe a lista COMPLETA já ordenada —
 * ver o motivo em `reorderTopics`.
 *
 * O limite de 400 itens não é sobre o banco: é para uma requisição forjada não
 * conseguir pedir uma transação arbitrariamente longa. O maior objetivo real
 * tem 42 tópicos.
 */
export async function reorderTopicsAction(
  goalId: string,
  ordem: { id: string; phase: string | null }[],
): Promise<ActionResult> {
  if (!Array.isArray(ordem) || ordem.length === 0) {
    return { ok: false, error: "Nada para reordenar." };
  }
  if (ordem.length > 400) {
    return { ok: false, error: "Lista longa demais para reordenar de uma vez." };
  }
  if (ordem.some((o) => typeof o?.id !== "string")) {
    return { ok: false, error: "Ordem inválida." };
  }

  return scoped(async (ownerId) => {
    const ok = await reorderTopics(ownerId, goalId, ordem);
    // `false` aqui quer dizer que a lista não bate com o objetivo — outra aba
    // criou ou apagou um tópico enquanto esta arrastava. Recarregar resolve, e
    // é honesto dizer isso em vez de "erro ao salvar".
    if (!ok) {
      return {
        ok: false,
        error: "A lista mudou enquanto você reordenava. Recarregue a página e tente de novo.",
      };
    }
    revalidateGoal(goalId);
    return { ok: true };
  });
}
