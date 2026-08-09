import { z } from "zod";
import { MODEL, isMockMode } from "./config";
import { chamarModelo } from "./usage";
import type { RepoDetail } from "@/domain/github/repos";

/**
 * Descrição de projeto a partir do repositório.
 *
 * Nome de repositório e README são escritos para quem vai clonar o código;
 * currículo é lido por quem vai contratar. A tradução entre os dois é o único
 * trabalho de IA aqui — a escolha de QUAIS projetos entram continua sendo do
 * dono, pelo mesmo motivo da fase 2: curadoria não se automatiza bem.
 */

const ProjectSchema = z.object({
  /** Nome do repositório, para casar com o que foi enviado. */
  repo: z.string(),
  /** Título legível. "gfr-system" não é título de currículo. */
  title: z.string(),
  /** 1–2 frases sobre o que o projeto faz. Null se o README não disser. */
  description: z.string().nullable(),
  techs: z.array(z.string()),
});

export const GithubProjectsSchema = z.object({
  projects: z.array(ProjectSchema),
});

export type GithubProjectDraft = z.infer<typeof ProjectSchema>;

export type GithubProjectsResult =
  { ok: true; projects: GithubProjectDraft[]; mocked: boolean } | { ok: false; error: string };

const SYSTEM = `Você transforma repositórios do GitHub em entradas de portfólio para currículo.

REGRAS:
- Baseie-se SOMENTE no que o README e os metadados dizem. Não infira arquitetura,
  escala, resultado de negócio nem qualidade que não esteja escrita.
- title: nome legível em português, a partir do nome do repositório e do README.
  "gfr-system" pode virar "Sistema GFR"; não invente um produto que não existe.
- description: 1 ou 2 frases sobre o que o projeto FAZ. Se o README for só
  boilerplate de framework (ex.: "Getting Started with Create React App"), não há
  o que dizer — devolva null em vez de encher linguiça.
- techs: só o que estiver explícito no README ou na linguagem do repositório.
- Não escreva superlativo ("robusto", "escalável", "de ponta") sem evidência.
- Devolva um item para CADA repositório recebido, mantendo o campo repo igual.`;

export async function describeRepos(
  ownerId: string,
  repos: RepoDetail[],
): Promise<GithubProjectsResult> {
  if (repos.length === 0) return { ok: false, error: "Nenhum repositório selecionado." };

  if (isMockMode()) {
    return {
      ok: true,
      mocked: true,
      projects: repos.map((r) => ({
        repo: r.name,
        title: r.name,
        description: r.description,
        techs: r.language ? [r.language] : [],
      })),
    };
  }

  const serialized = repos
    .map((r) =>
      [
        `## ${r.name}`,
        `linguagem principal: ${r.language ?? "não informada"}`,
        r.topics.length > 0 ? `topics: ${r.topics.join(", ")}` : null,
        r.description ? `descrição do repositório: ${r.description}` : null,
        r.readme ? `README:\n${r.readme}` : "README: (ausente)",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");

  try {
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const chamada = await chamarModelo(ownerId, "githubProjects", (client) =>
      client.messages.parse({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Repositórios:\n\n${serialized}\n\nGere as entradas de portfólio.`,
          },
        ],
        output_config: { format: zodOutputFormat(GithubProjectsSchema) },
      }),
    );
    if (!chamada.ok) return { ok: false, error: chamada.error };
    const res = chamada.res;

    if (!res.parsed_output) {
      return { ok: false, error: "A IA não retornou as descrições." };
    }
    return { ok: true, projects: res.parsed_output.projects, mocked: false };
  } catch (err) {
    console.error("githubProjects error", err);
    return {
      ok: false,
      error: "Não foi possível descrever os projetos agora.",
    };
  }
}
