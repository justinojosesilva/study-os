"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import { createProject } from "@/domain/resume/career";
import { listPublicRepos, fetchReadmes, type GithubRepo } from "@/domain/github/repos";
import { describeRepos, type GithubProjectDraft } from "@/domain/ai/githubProjects";

/** Mesmo formato da fase 2: lê, mostra, e só grava depois de revisado. */

export type ListReposResult =
  | { ok: true; repos: GithubRepo[] }
  | { ok: false; error: string };

export async function listReposAction(username: string): Promise<ListReposResult> {
  const user = username.trim();
  if (!user) return { ok: false, error: "Informe o usuário do GitHub." };
  return listPublicRepos(user);
}

export type DescribeResult =
  | { ok: true; projects: GithubProjectDraft[]; mocked: boolean }
  | { ok: false; error: string };

/** Limite de escolha: segura o custo do prompt e o número de requisições. */
const MAX_SELECAO = 8;

export async function describeReposAction(
  username: string,
  names: string[],
  repos: GithubRepo[],
): Promise<DescribeResult> {
  if (names.length === 0) return { ok: false, error: "Escolha ao menos um repositório." };
  if (names.length > MAX_SELECAO) {
    return { ok: false, error: `Escolha no máximo ${MAX_SELECAO} repositórios por vez.` };
  }
  const detalhes = await fetchReadmes(username, names, repos);
  if (detalhes.length === 0) {
    return { ok: false, error: "Não consegui ler os repositórios escolhidos." };
  }
  return describeRepos(detalhes);
}

export type ConfirmResult =
  | { ok: true; imported: number }
  | { ok: false; error: string };

export async function confirmGithubProjectsAction(
  drafts: GithubProjectDraft[],
  urls: Record<string, string>,
): Promise<ConfirmResult> {
  const validos = drafts.filter((d) => d.title.trim());
  if (validos.length === 0) return { ok: false, error: "Nada para importar." };

  return scoped(async (ownerId) => {
    for (const [i, d] of validos.entries()) {
      await createProject(ownerId, {
        title: d.title.trim(),
        description: d.description,
        url: null,
        repoUrl: urls[d.repo] ?? null,
        techs: d.techs.length > 0 ? d.techs : null,
        // Igual à importação de currículo: sugere, não decide o que vai na folha.
        highlight: false,
        sortOrder: i,
      });
    }
    revalidatePath("/curriculo");
    return { ok: true, imported: validos.length };
  });
}
