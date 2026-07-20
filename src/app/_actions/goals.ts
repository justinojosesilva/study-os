"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import {
  createGoal,
  updateGoal,
  setGoalStatus,
} from "@/domain/goals/repository";
import type { Goal } from "@/infra/db/schema";

const CATEGORIES = ["faculdade", "profissional", "certificacao"] as const;
type Category = (typeof CATEGORIES)[number];

const STATUSES = ["active", "paused", "done", "archived"] as const;
type Status = (typeof STATUSES)[number];

export type ActionResult = { ok: true } | { ok: false; error: string };

type ParsedFields = {
  title: string;
  category: Category;
  why: string | null;
  targetDate: Date | null;
};

function parseGoalFields(formData: FormData): ParsedFields | { error: string } {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Dê um título ao objetivo." };

  const category = String(formData.get("category") ?? "") as Category;
  if (!CATEGORIES.includes(category)) return { error: "Categoria inválida." };

  const whyRaw = String(formData.get("why") ?? "").trim();
  const why = whyRaw || null;

  const dateRaw = String(formData.get("targetDate") ?? "").trim();
  const targetDate = dateRaw ? new Date(dateRaw) : null;
  if (targetDate && Number.isNaN(targetDate.getTime())) {
    return { error: "Data alvo inválida." };
  }

  return { title, category, why, targetDate };
}

export async function createGoalAction(formData: FormData): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const parsed = parseGoalFields(formData);
    if ("error" in parsed) return { ok: false, error: parsed.error };

    await createGoal({ ownerId, ...parsed });
    revalidatePath("/");
    return { ok: true };
  });
}

export async function updateGoalAction(formData: FormData): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const goalId = String(formData.get("goalId") ?? "");
    if (!goalId) return { ok: false, error: "Objetivo ausente." };

    const parsed = parseGoalFields(formData);
    if ("error" in parsed) return { ok: false, error: parsed.error };

    const updated = await updateGoal(ownerId, goalId, parsed);
    if (!updated) return { ok: false, error: "Objetivo não encontrado." };

    revalidatePath(`/goals/${goalId}`);
    revalidatePath("/");
    return { ok: true };
  });
}

export async function setGoalStatusAction(
  goalId: string,
  status: Status,
): Promise<ActionResult> {
  if (!STATUSES.includes(status)) return { ok: false, error: "Status inválido." };
  return scoped(async (ownerId) => {
    const updated = await setGoalStatus(ownerId, goalId, status as Goal["status"]);
    if (!updated) return { ok: false, error: "Objetivo não encontrado." };

    revalidatePath(`/goals/${goalId}`);
    revalidatePath("/");
    return { ok: true };
  });
}
