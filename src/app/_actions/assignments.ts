"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import {
  createAssignment,
  toggleDelivered,
  setArtifactUrl,
  deleteAssignment,
} from "@/domain/assignments/repository";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** As telas que mostram entrega: a do objetivo, a agenda e o dashboard. */
function revalidar(goalId: string) {
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
}

/**
 * Aceita "AAAA-MM-DD" do `<input type="date">` e devolve o FIM daquele dia no
 * fuso local.
 *
 * `new Date("2026-08-20")` é interpretado como UTC meia-noite — no Brasil isso
 * vira 19/08 às 21h, e a entrega apareceria vencida um dia antes. E o fim do
 * dia, não o começo: quem escreve "entrega dia 20" tem o dia 20 inteiro.
 */
function fimDoDiaLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [, a, mes, d] = m;
  const data = new Date(Number(a), Number(mes) - 1, Number(d), 23, 59, 59, 999);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** Só http(s). `javascript:` num href é XSS, e o link é clicável na tela. */
function urlValida(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}

export async function createAssignmentAction(input: {
  goalId: string;
  topicId?: string | null;
  title: string;
  description?: string | null;
  dueDate: string;
  artifactUrl?: string | null;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Dê um nome à atividade." };
  if (title.length > 200) return { ok: false, error: "Nome muito longo." };

  const dueDate = fimDoDiaLocal(input.dueDate);
  if (!dueDate) return { ok: false, error: "Informe a data de entrega." };

  let artifactUrl: string | null = null;
  if (input.artifactUrl?.trim()) {
    artifactUrl = urlValida(input.artifactUrl);
    if (!artifactUrl) return { ok: false, error: "O link do artefato precisa começar com http." };
  }

  return scoped(async (ownerId) => {
    const linha = await createAssignment(ownerId, {
      goalId: input.goalId,
      topicId: input.topicId || null,
      title,
      description: input.description?.trim() || null,
      dueDate,
      artifactUrl,
    });
    // `null` aqui é objetivo ou tópico que não é seu — a mesma resposta para
    // os dois casos, para a mensagem não virar um oráculo de o que existe.
    if (!linha) return { ok: false, error: "Objetivo ou tópico não encontrado." };
    revalidar(input.goalId);
    return { ok: true };
  });
}

export async function toggleDeliveredAction(
  id: string,
  entregue: boolean,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const goalId = await toggleDelivered(ownerId, id, entregue);
    if (!goalId) return { ok: false, error: "Atividade não encontrada." };
    revalidar(goalId);
    return { ok: true };
  });
}

export async function setArtifactUrlAction(id: string, url: string): Promise<ActionResult> {
  const limpa = url.trim() ? urlValida(url) : null;
  if (url.trim() && !limpa) {
    return { ok: false, error: "O link precisa começar com http." };
  }
  return scoped(async (ownerId) => {
    const goalId = await setArtifactUrl(ownerId, id, limpa);
    if (!goalId) return { ok: false, error: "Atividade não encontrada." };
    revalidar(goalId);
    return { ok: true };
  });
}

export async function deleteAssignmentAction(id: string): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const goalId = await deleteAssignment(ownerId, id);
    if (!goalId) return { ok: false, error: "Atividade não encontrada." };
    revalidar(goalId);
    return { ok: true };
  });
}
