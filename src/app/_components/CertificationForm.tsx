"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X, Pencil } from "lucide-react";
import {
  createCertificationAction,
  updateCertificationAction,
} from "@/app/_actions/certifications";
import type { CertificationView } from "@/domain/certifications/repository";
import { toDateKey } from "@/lib/date";

type GoalOption = { id: string; title: string };

const STATUS_OPTIONS = [
  { value: "planned", label: "Planejada" },
  { value: "scheduled", label: "Agendada" },
  { value: "passed", label: "Conquistada" },
  { value: "failed", label: "Não passou" },
  { value: "expired", label: "Expirada" },
] as const;

function dateVal(d: Date | null | undefined): string {
  return d ? toDateKey(d) : "";
}

export function CertificationForm({
  goals,
  cert,
}: {
  goals: GoalOption[];
  cert?: CertificationView;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(cert);

  function close() {
    setError(null);
    dialogRef.current?.close();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = cert
        ? await updateCertificationAction(cert.id, fd)
        : await createCertificationAction(fd);
      if (res.ok) {
        if (!editing) form.reset();
        close();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      {editing ? (
        <button
          onClick={() => dialogRef.current?.showModal()}
          aria-label="Editar certificação"
          className="text-faint transition-colors hover:text-ink"
        >
          <Pencil size={15} />
        </button>
      ) : (
        <button
          onClick={() => dialogRef.current?.showModal()}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> Nova certificação
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-label={editing ? "Editar certificação" : "Nova certificação"}
        className="m-auto w-[min(94vw,540px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <form onSubmit={onSubmit} className="flex flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-medium">
              {editing ? "Editar certificação" : "Nova certificação"}
            </span>
            <button type="button" onClick={close} aria-label="Fechar" className="text-faint hover:text-ink">
              <X size={18} />
            </button>
          </header>

          <div className="flex max-h-[64vh] flex-col gap-4 overflow-y-auto px-5 py-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Certificação</span>
              <input
                name="title"
                autoFocus={!editing}
                defaultValue={cert?.title ?? ""}
                placeholder="AWS Certified Solutions Architect – Associate"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Provedor</span>
                <input
                  name="provider"
                  defaultValue={cert?.provider ?? ""}
                  placeholder="AWS"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Código (opcional)</span>
                <input
                  name="code"
                  defaultValue={cert?.code ?? ""}
                  placeholder="SAA-C03"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Status</span>
                <select
                  name="status"
                  defaultValue={cert?.status ?? "planned"}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Objetivo vinculado</span>
                <select
                  name="goalId"
                  defaultValue={cert?.goalId ?? ""}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  <option value="">Nenhum</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Data da prova</span>
                <input
                  type="date"
                  name="examDate"
                  defaultValue={dateVal(cert?.examDate)}
                  className="w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Conquista</span>
                <input
                  type="date"
                  name="obtainedDate"
                  defaultValue={dateVal(cert?.obtainedDate)}
                  className="w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Expira</span>
                <input
                  type="date"
                  name="expiresDate"
                  defaultValue={dateVal(cert?.expiresDate)}
                  className="w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Nota (opcional)</span>
                <input
                  name="score"
                  defaultValue={cert?.score ?? ""}
                  placeholder="820/1000"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Custo R$ (opcional)</span>
                <input
                  name="cost"
                  inputMode="decimal"
                  defaultValue={cert?.costCents != null ? (cert.costCents / 100).toString() : ""}
                  placeholder="150"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Link da credencial (opcional)</span>
              <input
                name="credentialUrl"
                defaultValue={cert?.credentialUrl ?? ""}
                placeholder="https://www.credly.com/badges/…"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Notas (opcional)</span>
              <textarea
                name="notes"
                rows={2}
                defaultValue={cert?.notes ?? ""}
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
              {pending ? "Salvando…" : editing ? "Salvar" : "Adicionar"}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
