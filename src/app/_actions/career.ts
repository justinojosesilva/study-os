"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import {
  createExperience,
  updateExperience,
  deleteExperience,
  createProject,
  updateProject,
  deleteProject,
} from "@/domain/resume/career";

export type ActionResult = { ok: true } | { ok: false; error: string };

function clean(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

/** "React, Node, AWS" → ["React","Node","AWS"]; vazio vira null. */
function parseTechs(v: FormDataEntryValue | null): string[] | null {
  const list = String(v ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

/** Aceita "2010-03" ou "2010"; devolve null se não for nenhum dos dois. */
function parseMonth(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
  if (/^\d{4}$/.test(s)) return `${s}-01`;
  return null;
}

function revalidate() {
  revalidatePath("/curriculo");
}

// --- experiências -----------------------------------------------------------

export async function createExperienceAction(fd: FormData): Promise<ActionResult> {
  const company = clean(fd.get("company"));
  const role = clean(fd.get("role"));
  const startDate = parseMonth(fd.get("startDate"));

  if (!company) return { ok: false, error: "Informe a empresa." };
  if (!role) return { ok: false, error: "Informe o cargo." };
  if (!startDate) return { ok: false, error: "Início inválido — use AAAA-MM (ex.: 2010-03)." };

  const endRaw = String(fd.get("endDate") ?? "").trim();
  const endDate = endRaw ? parseMonth(endRaw) : null;
  if (endRaw && !endDate) {
    return { ok: false, error: "Fim inválido — use AAAA-MM, ou deixe vazio para o cargo atual." };
  }
  if (endDate && endDate < startDate) {
    return { ok: false, error: "O fim não pode ser anterior ao início." };
  }

  return scoped(async (ownerId) => {
    await createExperience(ownerId, {
      company,
      role,
      startDate,
      endDate,
      location: clean(fd.get("location")),
      description: clean(fd.get("description")),
      techs: parseTechs(fd.get("techs")),
    });
    revalidate();
    return { ok: true };
  });
}

export async function updateExperienceAction(
  id: string,
  fd: FormData,
): Promise<ActionResult> {
  const company = clean(fd.get("company"));
  const role = clean(fd.get("role"));
  const startDate = parseMonth(fd.get("startDate"));

  if (!company) return { ok: false, error: "Informe a empresa." };
  if (!role) return { ok: false, error: "Informe o cargo." };
  if (!startDate) return { ok: false, error: "Início inválido — use AAAA-MM (ex.: 2010-03)." };

  const endRaw = String(fd.get("endDate") ?? "").trim();
  const endDate = endRaw ? parseMonth(endRaw) : null;
  if (endRaw && !endDate) {
    return { ok: false, error: "Fim inválido — use AAAA-MM, ou deixe vazio para o cargo atual." };
  }
  if (endDate && endDate < startDate) {
    return { ok: false, error: "O fim não pode ser anterior ao início." };
  }

  return scoped(async (ownerId) => {
    await updateExperience(ownerId, id, {
      company,
      role,
      startDate,
      endDate,
      location: clean(fd.get("location")),
      description: clean(fd.get("description")),
      techs: parseTechs(fd.get("techs")),
    });
    revalidate();
    return { ok: true };
  });
}

export async function deleteExperienceAction(id: string): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    await deleteExperience(ownerId, id);
    revalidate();
    return { ok: true };
  });
}

// --- projetos ---------------------------------------------------------------

export async function createProjectAction(fd: FormData): Promise<ActionResult> {
  const title = clean(fd.get("title"));
  if (!title) return { ok: false, error: "Informe o título do projeto." };

  return scoped(async (ownerId) => {
    await createProject(ownerId, {
      title,
      description: clean(fd.get("description")),
      url: clean(fd.get("url")),
      repoUrl: clean(fd.get("repoUrl")),
      techs: parseTechs(fd.get("techs")),
      highlight: fd.get("highlight") === "on",
    });
    revalidate();
    return { ok: true };
  });
}

export async function updateProjectAction(id: string, fd: FormData): Promise<ActionResult> {
  const title = clean(fd.get("title"));
  if (!title) return { ok: false, error: "Informe o título do projeto." };

  return scoped(async (ownerId) => {
    await updateProject(ownerId, id, {
      title,
      description: clean(fd.get("description")),
      url: clean(fd.get("url")),
      repoUrl: clean(fd.get("repoUrl")),
      techs: parseTechs(fd.get("techs")),
      highlight: fd.get("highlight") === "on",
    });
    revalidate();
    return { ok: true };
  });
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    await deleteProject(ownerId, id);
    revalidate();
    return { ok: true };
  });
}

/** Alterna só o destaque, sem abrir o formulário inteiro. */
export async function toggleProjectHighlightAction(
  id: string,
  highlight: boolean,
): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    await updateProject(ownerId, id, { highlight });
    revalidate();
    return { ok: true };
  });
}
