"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, X, FileUp, AlertTriangle, Check, Trash2, Info } from "lucide-react";
import {
  importCareerAction,
  confirmCareerImportAction,
} from "@/app/_actions/careerImport";
import type { CareerExtraction } from "@/domain/ai/careerImport";
import { SkeletonBlock, SkeletonText } from "./Skeleton";

/**
 * Importar o currículo que a pessoa já tem.
 *
 * O fluxo é lê → REVISA → grava, e o passo do meio não é opcional: o modelo
 * lê datas erradas com confiança total, e um currículo errado é pior que um
 * vazio. Enquanto não se clica em "Importar", nada tocou o banco.
 */
export function CareerImportDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [extraction, setExtraction] = useState<CareerExtraction | null>(null);
  const [mocked, setMocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, startRead] = useTransition();
  const [saving, startSave] = useTransition();

  function close() {
    setExtraction(null);
    setError(null);
    setFileName(null);
    dialogRef.current?.close();
  }

  function read(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    const fd = new FormData(ev.currentTarget);
    startRead(async () => {
      const res = await importCareerAction(fd);
      if (res.ok) {
        setExtraction(res.data);
        setMocked(res.mocked);
      } else {
        setError(res.error);
      }
    });
  }

  function confirm() {
    if (!extraction) return;
    setError(null);
    startSave(async () => {
      const res = await confirmCareerImportAction(extraction);
      if (res.ok) close();
      else setError(res.error);
    });
  }

  const total =
    (extraction?.experiences.length ?? 0) +
    (extraction?.projects.length ?? 0) +
    (extraction?.certifications.length ?? 0);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
      >
        <Upload size={14} /> Importar currículo
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        aria-label="Importar currículo"
        className="m-auto max-h-[92vh] w-[min(92vw,640px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <div className="flex max-h-[92vh] flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
            <span className="flex items-center gap-2 font-medium">
              <FileUp size={17} className="text-profissional" />
              Importar currículo
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
            {!extraction && !reading && (
              <form onSubmit={read} className="flex flex-col gap-4">
                <div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted">PDF do currículo</span>
                    <input
                      type="file"
                      name="file"
                      accept="application/pdf"
                      onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-2.5 file:py-1 file:text-xs file:font-medium"
                    />
                  </label>
                  {fileName && <p className="mt-1 text-xs text-faint">{fileName}</p>}
                </div>

                <p className="text-center text-xs text-faint">ou</p>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted">Colar o texto</span>
                  <textarea
                    name="text"
                    rows={6}
                    placeholder="Cole aqui o conteúdo do currículo, se preferir não enviar arquivo."
                    className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  />
                </label>

                <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs text-muted">
                  <Info size={14} className="mt-0.5 shrink-0 text-faint" />
                  <span>
                    Não tem o arquivo? No LinkedIn, abra seu perfil no computador e use{" "}
                    <strong className="font-medium text-ink">Mais → Salvar como PDF</strong>. Para
                    os dados completos em CSV, o caminho é{" "}
                    <strong className="font-medium text-ink">
                      Eu → Configurações e privacidade → Privacidade de dados → Baixar seus dados
                    </strong>{" "}
                    — só funciona no computador, não no aplicativo.
                  </span>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas"
                >
                  <FileUp size={15} /> Ler currículo
                </button>
              </form>
            )}

            {reading && (
              <SkeletonBlock label="Lendo o currículo…">
                <SkeletonText lines={4} />
              </SkeletonBlock>
            )}

            {extraction && !reading && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-surface-2 px-3 py-2.5 text-xs">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
                  <span>
                    Revise antes de importar. Datas e cargos lidos de um PDF erram com
                    frequência, e dá para corrigir tudo depois de importar.
                  </span>
                </div>

                {mocked && (
                  <p className="text-xs text-faint">
                    Modo de demonstração — nenhum documento foi lido de verdade.
                  </p>
                )}

                {extraction.uncertain.length > 0 && (
                  <div className="rounded-lg border border-line px-3 py-2.5">
                    <p className="mb-1 text-xs font-medium text-muted">
                      O que ficou em dúvida na leitura
                    </p>
                    <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-muted">
                      {extraction.uncertain.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <ReviewList
                  title={`Experiências (${extraction.experiences.length})`}
                  empty="Nenhuma experiência encontrada."
                  items={extraction.experiences.map((e, i) => ({
                    key: i,
                    primary: `${e.role} · ${e.company}`,
                    secondary: `${e.startDate} — ${e.endDate ?? "atual"}${e.location ? ` · ${e.location}` : ""}`,
                    tertiary: e.techs.join(" · "),
                  }))}
                  onRemove={(i) =>
                    setExtraction({
                      ...extraction,
                      experiences: extraction.experiences.filter((_, k) => k !== i),
                    })
                  }
                />

                <ReviewList
                  title={`Certificações (${extraction.certifications.length})`}
                  empty="Nenhuma certificação encontrada."
                  items={extraction.certifications.map((c, i) => ({
                    key: i,
                    primary: c.title,
                    secondary: [c.provider, c.code].filter(Boolean).join(" · "),
                    tertiary: c.obtainedDate ?? "",
                  }))}
                  onRemove={(i) =>
                    setExtraction({
                      ...extraction,
                      certifications: extraction.certifications.filter((_, k) => k !== i),
                    })
                  }
                />

                <ReviewList
                  title={`Projetos (${extraction.projects.length})`}
                  empty="Nenhum projeto encontrado."
                  items={extraction.projects.map((p, i) => ({
                    key: i,
                    primary: p.title,
                    secondary: p.description ?? "",
                    tertiary: p.techs.join(" · "),
                  }))}
                  onRemove={(i) =>
                    setExtraction({
                      ...extraction,
                      projects: extraction.projects.filter((_, k) => k !== i),
                    })
                  }
                />

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            )}
          </div>

          {extraction && !reading && (
            <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-5 py-4">
              <button
                type="button"
                onClick={() => setExtraction(null)}
                className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={saving || total === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
              >
                <Check size={15} />
                {saving ? "Importando…" : `Importar ${total} ${total === 1 ? "item" : "itens"}`}
              </button>
            </footer>
          )}
        </div>
      </dialog>
    </>
  );
}

type ReviewItem = {
  key: number;
  primary: string;
  secondary: string;
  tertiary: string;
};

function ReviewList({
  title,
  empty,
  items,
  onRemove,
}: {
  title: string;
  empty: string;
  items: ReviewItem[];
  onRemove: (index: number) => void;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{it.primary}</p>
                {it.secondary && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{it.secondary}</p>
                )}
                {it.tertiary && <p className="mt-1 text-xs text-faint">{it.tertiary}</p>}
              </div>
              <button
                type="button"
                onClick={() => onRemove(it.key)}
                aria-label={`Descartar ${it.primary}`}
                className="tip tip-left shrink-0 p-1 text-faint transition-colors hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
