/**
 * Leitura de repositórios públicos do GitHub.
 *
 * POR QUE ISTO É UM SELETOR E NÃO UM ANALISADOR: medido na conta real em
 * 07/08/2026 — 66 repositórios públicos, 3 com descrição, 0 com estrela, 0 com
 * topic, e a maioria esmagadora sendo exercício de bootcamp (`desafio01-...`,
 * `calc-exercicio-02`, `alura_space`). Análise automática sobre esse conjunto
 * descreve um júnior, contradizendo a carreira de 21 anos que o currículo já
 * registra. O sinal está em QUAIS repositórios, e isso quem sabe é o dono.
 *
 * Limite da API sem autenticação: 60 requisições/hora POR IP — e num
 * serverless o IP é compartilhado, então o teto vale para o app inteiro. Por
 * isso listar custa 1 requisição e o README só é buscado para o que foi
 * escolhido. `GITHUB_TOKEN`, se existir, sobe o teto para 5.000/h.
 */

export type GithubRepo = {
  name: string;
  description: string | null;
  language: string | null;
  htmlUrl: string;
  homepage: string | null;
  sizeKb: number;
  stars: number;
  topics: string[];
  updatedAt: string;
  isFork: boolean;
};

export type ReposResult =
  | { ok: true; repos: GithubRepo[] }
  | { ok: false; error: string };

const API = "https://api.github.com";

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Mensagem útil em vez de "falhou": o motivo mais provável é o teto por IP. */
async function explainFailure(res: Response, contexto: string): Promise<string> {
  if (res.status === 404) return "Usuário não encontrado no GitHub.";
  const restante = res.headers.get("x-ratelimit-remaining");
  if ((res.status === 403 || res.status === 429) && restante === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset") ?? 0) * 1000;
    const min = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : null;
    return process.env.GITHUB_TOKEN
      ? `Limite da API do GitHub atingido${min ? `. Tente em ${min} min` : ""}.`
      : `Limite do GitHub atingido (60/hora sem token, compartilhado pelo app)${min ? `. Tente em ${min} min` : ""}.`;
  }
  return `Não foi possível ${contexto} (HTTP ${res.status}).`;
}

export async function listPublicRepos(username: string): Promise<ReposResult> {
  const user = username.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(user)) {
    return { ok: false, error: "Usuário inválido." };
  }

  try {
    // Uma requisição só. `per_page=100` cobre a maioria das contas; quem tiver
    // mais que isso vê os 100 mais recentes, que é o que interessa.
    const res = await fetch(
      `${API}/users/${user}/repos?per_page=100&sort=updated&type=owner`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return { ok: false, error: await explainFailure(res, "listar os repositórios") };

    const raw = (await res.json()) as Array<Record<string, unknown>>;
    const repos: GithubRepo[] = raw.map((r) => ({
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      language: (r.language as string | null) ?? null,
      htmlUrl: String(r.html_url),
      homepage: (r.homepage as string | null) || null,
      sizeKb: Number(r.size ?? 0),
      stars: Number(r.stargazers_count ?? 0),
      topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
      updatedAt: String(r.updated_at ?? ""),
      isFork: Boolean(r.fork),
    }));
    return { ok: true, repos };
  } catch (err) {
    console.error("github list error", err);
    return { ok: false, error: "Não foi possível falar com o GitHub agora." };
  }
}

export type RepoDetail = GithubRepo & { readme: string | null };

/**
 * README dos escolhidos. Truncado: o que interessa para descrever um projeto
 * está no começo, e README de 40 KB só inflaria o prompt.
 */
export async function fetchReadmes(
  username: string,
  names: string[],
  repos: GithubRepo[],
): Promise<RepoDetail[]> {
  const user = username.trim().replace(/^@/, "");
  const byName = new Map(repos.map((r) => [r.name, r]));

  const out = await Promise.all(
    names.map(async (name): Promise<RepoDetail | null> => {
      const base = byName.get(name);
      if (!base) return null;
      try {
        const res = await fetch(`${API}/repos/${user}/${name}/readme`, {
          headers: { ...headers(), Accept: "application/vnd.github.raw+json" },
          cache: "no-store",
        });
        // Repositório sem README é comum e não é erro — segue sem ele.
        const readme = res.ok ? (await res.text()).slice(0, 6000) : null;
        return { ...base, readme };
      } catch {
        return { ...base, readme: null };
      }
    }),
  );
  return out.filter((r): r is RepoDetail => r !== null);
}
