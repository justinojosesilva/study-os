"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import {
  createMaterial,
  updateMaterial,
  updateMaterialProgress,
  deleteMaterial,
} from "@/domain/materials/repository";
import { ownsGoal } from "@/domain/goals/repository";
import type { Material } from "@/infra/db/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

const TYPES = ["book", "pdf", "video", "course", "article", "link"] as const;
type MaterialType = (typeof TYPES)[number];

function revalidateFor(goalId: string | null) {
  revalidatePath("/materials");
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

function parseUrl(raw: unknown): string | null {
  const url = String(raw ?? "").trim();
  return url || null;
}

export async function createMaterialAction(formData: FormData): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Dê um título ao material." };

    const type = String(formData.get("type") ?? "") as MaterialType;
    if (!TYPES.includes(type)) return { ok: false, error: "Tipo inválido." };

    const goalRaw = String(formData.get("goalId") ?? "").trim();
    const goalId = goalRaw || null;
    if (goalId && !(await ownsGoal(ownerId, goalId))) {
      return { ok: false, error: "Objetivo não encontrado." };
    }

    await createMaterial({
      ownerId,
      goalId,
      title,
      type: type as Material["type"],
      url: parseUrl(formData.get("url")),
    });
    revalidateFor(goalId);
    return { ok: true };
  });
}

export async function updateMaterialAction(
  materialId: string,
  goalId: string | null,
  type: string,
  title: string,
  url: string,
): Promise<ActionResult> {
  const t = title.trim();
  if (!t) return { ok: false, error: "Dê um título ao material." };
  if (!TYPES.includes(type as MaterialType)) {
    return { ok: false, error: "Tipo inválido." };
  }

  return scoped(async (ownerId) => {
    const ok = await updateMaterial(ownerId, materialId, {
      type: type as Material["type"],
      title: t,
      url: url.trim() || null,
    });
    if (!ok) return { ok: false, error: "Material não encontrado." };
    revalidateFor(goalId);
    return { ok: true };
  });
}

export async function updateMaterialProgressAction(
  materialId: string,
  goalId: string | null,
  progressPct: number,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const ok = await updateMaterialProgress(ownerId, materialId, progressPct);
    if (!ok) return { ok: false, error: "Material não encontrado." };
    revalidateFor(goalId);
    return { ok: true };
  });
}

export async function deleteMaterialAction(
  materialId: string,
  goalId: string | null,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const ok = await deleteMaterial(ownerId, materialId);
    if (!ok) return { ok: false, error: "Material não encontrado." };
    revalidateFor(goalId);
    return { ok: true };
  });
}
