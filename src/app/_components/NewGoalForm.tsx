"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createGoalAction } from "@/app/_actions/goals";

export function NewGoalForm() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setError(null);
    dialogRef.current?.close();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createGoalAction(fd);
      if (res.ok) {
        e.currentTarget?.reset?.();
        close();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
      >
        <Plus size={16} /> Novo objetivo
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Novo objetivo"
        className="m-auto w-[min(92vw,460px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <form onSubmit={onSubmit} className="flex flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-medium">Novo objetivo</span>
            <button type="button" onClick={close} aria-label="Fechar" className="text-faint hover:text-ink">
              <X size={18} />
            </button>
          </header>

          <div className="flex flex-col gap-4 px-5 py-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Título</span>
              <input
                name="title"
                autoFocus
                placeholder="Certificação AWS Solutions Architect"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Categoria</span>
                <select
                  name="category"
                  defaultValue="profissional"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  <option value="profissional">Profissional</option>
                  <option value="faculdade">Faculdade</option>
                  <option value="certificacao">Certificação</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Data alvo</span>
                <input
                  type="date"
                  name="targetDate"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Por quê (opcional)</span>
              <textarea
                name="why"
                rows={2}
                placeholder="O que esse objetivo destrava na sua carreira?"
                className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
            <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
            >
              {pending ? "Criando…" : "Criar objetivo"}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
