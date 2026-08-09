"use server";

import { revalidatePath } from "next/cache";
import { scoped, getCurrentUserId } from "@/domain/auth";
import { createExperience, createProject } from "@/domain/resume/career";
import { createCertification } from "@/domain/certifications/repository";
import { extractCareer, type CareerExtraction } from "@/domain/ai/careerImport";

/**
 * Importar é DOIS passos, de propósito: `importCareerAction` lê e devolve, e
 * só `confirmCareerImportAction` grava — depois de a pessoa ter revisado na
 * tela. Ver a nota em `domain/ai/careerImport.ts`.
 */

export type ImportResult =
  { ok: true; data: CareerExtraction; mocked: boolean } | { ok: false; error: string };

/** O limite da API é 32 MB no request inteiro; 10 MB cobre folgado um CV. */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function importCareerAction(fd: FormData): Promise<ImportResult> {
  const file = fd.get("file");
  const text = String(fd.get("text") ?? "").trim();

  let pdfBase64: string | undefined;

  if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf") {
      return {
        ok: false,
        error: "Envie um PDF, ou cole o texto do currículo.",
      };
    }
    if (file.size > MAX_PDF_BYTES) {
      return {
        ok: false,
        error: "PDF acima de 10 MB. Cole o texto ou envie um arquivo menor.",
      };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    // base64 sem quebras de linha — a API rejeita o payload com elas.
    pdfBase64 = buf.toString("base64");
  }

  if (!pdfBase64 && !text) {
    return {
      ok: false,
      error: "Envie o PDF do currículo ou cole o texto dele.",
    };
  }

  // Sem transação aberta: a chamada ao modelo leva segundos e não deve
  // segurar conexão do banco. Nada é lido do banco aqui.
  const ownerId = await getCurrentUserId();
  return extractCareer(ownerId, { pdfBase64, text: text || undefined });
}

export type ConfirmResult =
  | { ok: true; experiences: number; projects: number; certifications: number }
  | { ok: false; error: string };

/** "2019-06" -> Date. Null quando o documento não trouxe a data. */
function mesParaData(ym: string | null): Date | null {
  if (!ym || !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

/** Grava o que a pessoa revisou. Só aqui existe escrita. */
export async function confirmCareerImportAction(data: CareerExtraction): Promise<ConfirmResult> {
  const experiences = data.experiences.filter((e) => e.company.trim() && e.role.trim());
  const projects = data.projects.filter((p) => p.title.trim());
  const certs = data.certifications.filter((c) => c.title.trim() && c.provider.trim());

  if (experiences.length === 0 && projects.length === 0 && certs.length === 0) {
    return { ok: false, error: "Nada para importar." };
  }

  return scoped(async (ownerId) => {
    // `sortOrder` preserva a ordem revisada na tela; o repositório ordena por
    // ele antes da data, então o que a pessoa arrumou é o que aparece.
    for (const [i, e] of experiences.entries()) {
      await createExperience(ownerId, {
        company: e.company.trim(),
        role: e.role.trim(),
        startDate: e.startDate,
        endDate: e.endDate,
        location: e.location,
        description: e.description,
        techs: e.techs.length > 0 ? e.techs : null,
        sortOrder: i,
      });
    }
    for (const [i, p] of projects.entries()) {
      await createProject(ownerId, {
        title: p.title.trim(),
        description: p.description,
        url: p.url,
        repoUrl: null,
        techs: p.techs.length > 0 ? p.techs : null,
        highlight: false, // a escolha do que entra na folha continua sendo sua
        sortOrder: i,
      });
    }
    // Estar no currículo significa obtida — daí `passed`, e não o default
    // `planned`. É o status que o gerador de currículo lê.
    for (const c of certs) {
      await createCertification({
        ownerId,
        title: c.title.trim(),
        provider: c.provider.trim(),
        code: c.code,
        status: "passed",
        obtainedDate: mesParaData(c.obtainedDate),
      });
    }

    revalidatePath("/curriculo");
    revalidatePath("/certifications");
    return {
      ok: true,
      experiences: experiences.length,
      projects: projects.length,
      certifications: certs.length,
    };
  });
}
