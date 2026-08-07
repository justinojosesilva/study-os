"use client";

import { useRef, useState, useTransition } from "react";
// O lucide removeu os ícones de marca, então não existe mais `Github`.
import { GitBranch, X, Search, Check, Star, ArrowLeft, Info } from "lucide-react";
import {
  listReposAction,
  describeReposAction,
  confirmGithubProjectsAction,
} from "@/app/_actions/githubImport";
import type { GithubRepo } from "@/domain/github/repos";
import type { GithubProjectDraft } from "@/domain/ai/githubProjects";
import { SkeletonBlock, SkeletonText } from "./Skeleton";

/**
 * Trazer projetos do GitHub — escolhendo, não varrendo.
 *
 * Na conta real são 66 repositórios, 3 com descrição e a maioria exercício de
 * bootcamp. Importar tudo descreveria um júnior e contradiria os 21 anos de
 * carreira que o currículo já registra. Quem sabe quais valem é o dono.
 */

const MAX = 8;

export function GithubImportDialog({ sugestaoUsuario }: { sugestaoUsuario?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState(sugestaoUsuario ?? "");
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<GithubProjectDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, startBusca] = useTransition();
  const [descrevendo, startDescreve] = useTransition();
  const [salvando, startSalva] = useTransition();

  function close() {
    setRepos(null);
    setEscolhidos(new Set());
    setDrafts(null);
    setError(null);
    dialogRef.current?.close();
  }

  function buscar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    startBusca(async () => {
      const res = await listReposAction(user);
      if (res.ok) setRepos(res.repos);
      else setError(res.error);
    });
  }

  function alternar(name: string) {
    setEscolhidos((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (next.size < MAX) next.add(name);
      return next;
    });
  }

  function descrever() {
    if (!repos) return;
    setError(null);
    startDescreve(async () => {
      const res = await describeReposAction(user, [...escolhidos], repos);
      if (res.ok) setDrafts(res.projects);
      else setError(res.error);
    });
  }

  function confirmar() {
    if (!drafts || !repos) return;
    setError(null);
    const urls = Object.fromEntries(repos.map((r) => [r.name, r.htmlUrl]));
    startSalva(async () => {
      const res = await confirmGithubProjectsAction(drafts, urls);
      if (res.ok) close();
      else setError(res.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
      >
        <GitBranch size={14} /> Do GitHub
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        aria-label="Importar projetos do GitHub"
        className="m-auto max-h-[92vh] w-[min(92vw,640px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <div className="flex max-h-[92vh] flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
            <span className="flex items-center gap-2 font-medium">
              <GitBranch size={17} />
              Projetos do GitHub
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className="tip text-faint hover:text-ink"
            >
              <X size={18} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {/* passo 1 — usuário */}
            {!repos && !buscando && (
              <form onSubmit={buscar} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted">Usuário do GitHub</span>
                  <input
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="seu-usuario"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  />
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas"
                >
                  <Search size={15} /> Buscar repositórios
                </button>
              </form>
            )}

            {buscando && (
              <SkeletonBlock label="Buscando repositórios…">
                <SkeletonText lines={3} />
              </SkeletonBlock>
            )}

            {/* passo 2 — escolha */}
            {repos && !drafts && !descrevendo && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs text-muted">
                  <Info size={14} className="mt-0.5 shrink-0 text-faint" />
                  <span>
                    {repos.length} repositórios. Escolha só os que são projeto de verdade —
                    exercício de curso no currículo trabalha contra você. Até {MAX} por vez.
                  </span>
                </div>

                <p className="text-xs text-faint">
                  {escolhidos.size} de {MAX} escolhidos
                </p>

                <ul className="flex flex-col gap-1.5">
                  {repos.map((r) => {
                    const on = escolhidos.has(r.name);
                    const cheio = escolhidos.size >= MAX && !on;
                    return (
                      <li key={r.name}>
                        <button
                          type="button"
                          onClick={() => alternar(r.name)}
                          disabled={cheio}
                          aria-pressed={on}
                          className={`press flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            on ? "border-profissional bg-surface-2" : "border-line hover:bg-surface-2"
                          } ${cheio ? "opacity-40" : ""}`}
                        >
                          <span
                            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                              on ? "border-profissional bg-profissional text-canvas" : "border-line"
                            }`}
                          >
                            {on && <Check size={11} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.name}</span>
                            {r.description && (
                              <span className="mt-0.5 block line-clamp-1 text-xs text-muted">
                                {r.description}
                              </span>
                            )}
                            <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-faint tabular-nums">
                              {r.language && <span>{r.language}</span>}
                              <span>{Math.round(r.sizeKb / 1024) || "<1"} MB</span>
                              <span>{r.updatedAt.slice(0, 7)}</span>
                              {r.stars > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Star size={10} /> {r.stars}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            )}

            {descrevendo && (
              <SkeletonBlock label="Lendo os READMEs e escrevendo as descrições…">
                <SkeletonText lines={4} />
              </SkeletonBlock>
            )}

            {/* passo 3 — revisão */}
            {drafts && !descrevendo && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted">
                  Revise antes de importar. Entram sem estrela — você decide depois quais vão
                  para a folha.
                </p>
                <ul className="flex flex-col gap-2">
                  {drafts.map((d, i) => (
                    <li key={d.repo} className="rounded-lg border border-line px-3 py-2.5">
                      <input
                        value={d.title}
                        onChange={(e) =>
                          setDrafts(
                            drafts.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)),
                          )
                        }
                        aria-label={`Título de ${d.repo}`}
                        className="w-full rounded border border-line bg-surface px-2 py-1 text-sm font-medium"
                      />
                      <textarea
                        value={d.description ?? ""}
                        rows={2}
                        placeholder="Sem descrição — o README não dizia o que o projeto faz."
                        onChange={(e) =>
                          setDrafts(
                            drafts.map((x, k) =>
                              k === i ? { ...x, description: e.target.value || null } : x,
                            ),
                          )
                        }
                        aria-label={`Descrição de ${d.repo}`}
                        className="mt-1.5 w-full resize-y rounded border border-line bg-surface px-2 py-1 text-xs"
                      />
                      {d.techs.length > 0 && (
                        <p className="mt-1 text-[11px] text-faint">{d.techs.join(" · ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            )}
          </div>

          {repos && !buscando && (
            <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-5 py-4">
              <button
                type="button"
                onClick={() => (drafts ? setDrafts(null) : setRepos(null))}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-ink"
              >
                <ArrowLeft size={15} /> Voltar
              </button>
              {drafts ? (
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={salvando}
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
                >
                  <Check size={15} />
                  {salvando ? "Importando…" : `Importar ${drafts.length}`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={descrever}
                  disabled={escolhidos.size === 0 || descrevendo}
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
                >
                  Descrever {escolhidos.size || ""}
                </button>
              )}
            </footer>
          )}
        </div>
      </dialog>
    </>
  );
}
