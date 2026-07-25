"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import { createLesson, updateLesson, deleteLesson } from "@/domain/lessons/repository";
import { ownsTopic } from "@/domain/sessions/repository";

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
    const row = await createLesson({ ownerId, topicId, ...parsed });
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
