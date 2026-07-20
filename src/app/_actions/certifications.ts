"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import {
  createCertification,
  updateCertification,
  setCertificationStatus,
  deleteCertification,
  type CertificationFields,
  type CertStatus,
} from "@/domain/certifications/repository";
import { ownsGoal } from "@/domain/goals/repository";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATUSES: CertStatus[] = ["planned", "scheduled", "passed", "failed", "expired"];

function revalidateFor(goalId: string | null) {
  revalidatePath("/certifications");
  revalidatePath("/"); // dashboard "próxima prova" widget
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

function parseText(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s || null;
}

function parseDate(raw: unknown): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Cost input is in reais (e.g. "150" or "150,00"); we store integer cents. */
function parseCents(raw: unknown): number | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : Math.round(n * 100);
}

/** Shared FormData → fields parse, with goal-ownership guard. */
async function parseFields(
  ownerId: string,
  fd: FormData,
): Promise<{ ok: true; fields: CertificationFields } | { ok: false; error: string }> {
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Dê um nome à certificação." };

  const provider = String(fd.get("provider") ?? "").trim();
  if (!provider) return { ok: false, error: "Informe o provedor (ex: AWS)." };

  const status = String(fd.get("status") ?? "planned") as CertStatus;
  if (!STATUSES.includes(status)) return { ok: false, error: "Status inválido." };

  const goalId = String(fd.get("goalId") ?? "").trim() || null;
  if (goalId && !(await ownsGoal(ownerId, goalId))) {
    return { ok: false, error: "Objetivo não encontrado." };
  }

  return {
    ok: true,
    fields: {
      title,
      provider,
      code: parseText(fd.get("code")),
      goalId,
      status,
      examDate: parseDate(fd.get("examDate")),
      obtainedDate: parseDate(fd.get("obtainedDate")),
      expiresDate: parseDate(fd.get("expiresDate")),
      score: parseText(fd.get("score")),
      costCents: parseCents(fd.get("cost")),
      credentialUrl: parseText(fd.get("credentialUrl")),
      notes: parseText(fd.get("notes")),
    },
  };
}

export async function createCertificationAction(fd: FormData): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const parsed = await parseFields(ownerId, fd);
    if (!parsed.ok) return parsed;
    await createCertification({ ownerId, ...parsed.fields });
    revalidateFor(parsed.fields.goalId);
    return { ok: true };
  });
}

export async function updateCertificationAction(
  certId: string,
  fd: FormData,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const parsed = await parseFields(ownerId, fd);
    if (!parsed.ok) return parsed;
    const ok = await updateCertification(ownerId, certId, parsed.fields);
    if (!ok) return { ok: false, error: "Certificação não encontrada." };
    revalidateFor(parsed.fields.goalId);
    return { ok: true };
  });
}

export async function setCertificationStatusAction(
  certId: string,
  status: CertStatus,
): Promise<ActionResult> {
  if (!STATUSES.includes(status)) return { ok: false, error: "Status inválido." };
  return scoped(async (ownerId) => {
    const ok = await setCertificationStatus(ownerId, certId, status);
    if (!ok) return { ok: false, error: "Certificação não encontrada." };
    revalidateFor(null);
    return { ok: true };
  });
}

export async function deleteCertificationAction(certId: string): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const ok = await deleteCertification(ownerId, certId);
    if (!ok) return { ok: false, error: "Certificação não encontrada." };
    revalidateFor(null);
    return { ok: true };
  });
}

/** Best-effort provider guess from a certification name (used when adopting a
 *  mentor suggestion, which is just a free-text string). */
function inferProvider(title: string): string {
  const t = title.toLowerCase();
  // Word boundaries on short codes so substrings (e.g. "oci" inside
  // "assOCIate") don't trigger a false match.
  if (/\baws\b|amazon/.test(t)) return "AWS";
  if (/google|\bgcp\b/.test(t)) return "Google Cloud";
  if (/azure|microsoft|\baz-?\d/.test(t)) return "Microsoft";
  if (/kubernetes|\bckad?\b|\bcka\b|\bcncf\b/.test(t)) return "CNCF";
  if (/\boracle\b|\boci\b/.test(t)) return "Oracle";
  if (/terraform|vault|hashicorp/.test(t)) return "HashiCorp";
  return "Outro";
}

/** Adopt a mentor's certification suggestion (a plain string) into the tracker. */
export async function adoptCertificationAction(
  title: string,
  goalId: string | null = null,
): Promise<ActionResult> {
  const name = title.trim();
  if (!name) return { ok: false, error: "Nome vazio." };
  return scoped(async (ownerId) => {
    if (goalId && !(await ownsGoal(ownerId, goalId))) {
      return { ok: false, error: "Objetivo não encontrado." };
    }
    await createCertification({
      ownerId,
      title: name,
      provider: inferProvider(name),
      goalId,
      status: "planned",
    });
    revalidateFor(goalId);
    return { ok: true };
  });
}
