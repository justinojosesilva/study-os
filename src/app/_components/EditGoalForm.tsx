"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { updateGoalAction } from "@/app/_actions/goals";
import type { Category } from "@/lib/categories";

type Props = {
  id: string;
  title: string;
  why: string | null;
  category: Category;
  targetDate: string; // "YYYY-MM-DD" or ""
};

export function EditGoalForm({ id, title, why, category, targetDate }: Props) {
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
      const res = await updateGoalAction(fd);
      if (res.ok) close();
      else setError(res.error);
    });
  }

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:bg-surface-2"
      >
        <Pencil size={14} /> Editar
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Editar objetivo"
        className="m-auto w-[min(92vw,460px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <form onSubmit={onSubmit} className="flex flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-medium">Editar objetivo</span>
            <button type="button" onClick={close} aria-label="Fechar" className="text-faint hover:text-ink">
              <X size={18} />
            </button>
          </header>

          <div className="flex flex-col gap-4 px-5 py-5">
            <input type="hidden" name="goalId" value={id} />

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Título</span>
              <input
                name="title"
                defaultValue={title}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Categoria</span>
                <select
                  name="category"
                  defaultValue={category}
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
                  defaultValue={targetDate}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Por quê (opcional)</span>
              <textarea
                name="why"
                rows={2}
                defaultValue={why ?? ""}
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
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
