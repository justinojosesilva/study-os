"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import {
  createLesson,
  updateLesson,
  deleteLesson,
  setLessonCompleted,
  setLessonPublic,
} from "@/domain/lessons/repository";
import { ownsTopic } from "@/domain/sessions/repository";
import { ownsMaterial } from "@/domain/materials/repository";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function parseTitleContent(fd: FormData): { title: string; content: string } | { error: string } {
  const title = String(fd.get("title") ?? "").trim();
  const content = String(fd.get("content") ?? "").trim();
  if (!title) return { error: "Dê um título à aula." };
  if (!content) return { error: "Cole o conteúdo da aula (markdown)." };
  return { title, content };
}

export async function createLessonAction(fd: FormData): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const topicId = String(fd.get("topicId") ?? "").trim();
    const goalId = String(fd.get("goalId") ?? "").trim();
    const parsed = parseTitleContent(fd);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    if (!(await ownsTopic(ownerId, topicId))) {
      return { ok: false, error: "Tópico não encontrado." };
    }
    const kind = fd.get("kind") === "lab" ? "lab" : "aula";

    // A fonte de onde a aula saiu. Opcional, e a posse é checada aqui porque o
    // id vem do cliente.
    const rawMaterial = String(fd.get("materialId") ?? "").trim();
    const materialId = rawMaterial || null;
    if (materialId && !(await ownsMaterial(ownerId, materialId))) {
      return { ok: false, error: "Material não encontrado." };
    }

    const row = await createLesson({ ownerId, topicId, kind, materialId, ...parsed });
    if (goalId) revalidatePath(`/goals/${goalId}`);
    return { ok: true, id: row.id };
  });
}

export async function updateLessonAction(
  lessonId: string,
  goalId: string,
  fd: FormData,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const parsed = parseTitleContent(fd);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    const ok = await updateLesson(ownerId, lessonId, parsed);
    if (!ok) return { ok: false, error: "Aula não encontrada." };
    if (goalId) revalidatePath(`/goals/${goalId}`);
    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true };
  });
}

export async function deleteLessonAction(
  lessonId: string,
  goalId: string,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const ok = await deleteLesson(ownerId, lessonId);
    if (!ok) return { ok: false, error: "Aula não encontrada." };
    if (goalId) revalidatePath(`/goals/${goalId}`);
    return { ok: true };
  });
}

export async function setLessonCompletedAction(
  lessonId: string,
  goalId: string,
  done: boolean,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const topicId = await setLessonCompleted(ownerId, lessonId, done);
    if (!topicId) return { ok: false, error: "Aula não encontrada." };
    if (goalId) revalidatePath(`/goals/${goalId}`);
    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true };
  });
}

/**
 * Publica ou despublica uma aula, devolvendo o slug para a UI montar o link.
 *
 * A checagem de posse não é feita aqui: `setLessonPublic` filtra por ownerId na
 * própria query e devolve null se não achar. Uma checagem separada seria uma
 * segunda fonte de verdade para a mesma pergunta.
 */
export async function setLessonPublicAction(
  lessonId: string,
  isPublic: boolean,
): Promise<{ ok: true; isPublic: boolean; slug: string | null } | { ok: false; error: string }> {
  return scoped(async (ownerId) => {
    const res = await setLessonPublic(ownerId, lessonId, isPublic);
    if (!res) return { ok: false as const, error: "Aula não encontrada." };
    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true as const, isPublic: res.isPublic, slug: res.slug };
  });
}
