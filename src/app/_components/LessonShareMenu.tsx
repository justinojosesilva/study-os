"use client";

import { useRef, useState, useTransition } from "react";
import { Share2, X, Download, Printer, Copy, Check, Globe, Lock } from "lucide-react";
import { setLessonPublicAction } from "@/app/_actions/lessons";

/**
 * Tirar a aula de dentro do app: baixar, imprimir ou compartilhar por link.
 *
 * Os três moram no mesmo diálogo porque são a mesma intenção — "levar isto para
 * fora" — e porque três botões soltos na barra do leitor competiriam com os
 * controles de leitura, que são os usados o tempo todo. Este é usado uma vez
 * por aula, quando muito.
 */
export function LessonShareMenu({
  lessonId,
  title,
  isPublic: initialPublic,
  slug: initialSlug,
}: {
  lessonId: string;
  title: string;
  isPublic: boolean;
  slug: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [slug, setSlug] = useState(initialSlug);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  // Montado no cliente porque depende da origem real — o mesmo app responde em
  // latisskills.com.br, no domínio da Vercel e em localhost, e um link com a
  // origem errada é pior que link nenhum.
  const url = slug && typeof window !== "undefined" ? `${window.location.origin}/a/${slug}` : "";

  function alternar() {
    setErro(null);
    startTransition(async () => {
      const res = await setLessonPublicAction(lessonId, !isPublic);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setIsPublic(res.isPublic);
      setSlug(res.slug);
    });
  }

  function copiar() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1800);
      })
      .catch(() => setErro("Não foi possível copiar. Selecione o link e copie à mão."));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label="Compartilhar ou exportar"
        className="tip rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Share2 size={16} />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Compartilhar ou exportar"
        className="m-auto w-[min(92vw,460px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-medium">Compartilhar ou exportar</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar"
            className="text-faint hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5">
          {/* --- levar embora --- */}
          <div className="flex gap-2">
            <a
              href={`/lessons/${lessonId}/download`}
              download
              className="press flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2"
            >
              <Download size={15} className="text-faint" />
              Baixar .md
            </a>
            <button
              type="button"
              onClick={() => {
                dialogRef.current?.close();
                // Fecha antes: um <dialog> aberto é o topo da pilha e imprime
                // por cima da aula.
                requestAnimationFrame(() => window.print());
              }}
              className="press flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2"
            >
              <Printer size={15} className="text-faint" />
              Imprimir / PDF
            </button>
          </div>

          <div className="border-t border-line" />

          {/* --- link público --- */}
          <div>
            <div className="mb-2 flex items-start gap-2">
              {isPublic ? (
                <Globe size={15} className="mt-0.5 shrink-0 text-profissional" />
              ) : (
                <Lock size={15} className="mt-0.5 shrink-0 text-faint" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {isPublic ? "Aula publicada" : "Aula privada"}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {isPublic
                    ? "Quem tiver o link lê a aula sem precisar de conta. Suas notas não vão junto."
                    : "Publique para gerar um link que você pode mandar para alguém."}
                </p>
              </div>
              <button
                type="button"
                onClick={alternar}
                disabled={pendente}
                className={`press shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                  isPublic
                    ? "border border-line hover:bg-surface-2"
                    : "bg-ink text-canvas"
                }`}
              >
                {pendente ? "…" : isPublic ? "Despublicar" : "Publicar"}
              </button>
            </div>

            {isPublic && url && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={`Link público de ${title}`}
                  className="min-w-0 flex-1 bg-transparent text-xs text-muted outline-none"
                />
                <button
                  type="button"
                  onClick={copiar}
                  aria-label="Copiar link"
                  className="shrink-0 text-faint hover:text-ink"
                >
                  {copiado ? <Check size={15} className="text-profissional" /> : <Copy size={15} />}
                </button>
              </div>
            )}
          </div>

          {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
        </div>
      </dialog>
    </>
  );
}
