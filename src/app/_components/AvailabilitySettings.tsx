"use client";

import { useRef, useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { setAvailabilityAction } from "@/app/_actions/schedule";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function AvailabilitySettings({ availability }: { availability: number[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mins, setMins] = useState<number[]>(() => availability.slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = mins.reduce((s, n) => s + (n || 0), 0);

  function setDay(i: number, value: string) {
    const n = Math.max(0, Math.min(1440, Math.round(Number(value) || 0)));
    setMins((prev) => prev.map((m, idx) => (idx === i ? n : m)));
  }

  function close() {
    setError(null);
    dialogRef.current?.close();
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setAvailabilityAction(mins);
      if (res.ok) close();
      else setError(res.error);
    });
  }

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="press inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2"
      >
        <SlidersHorizontal size={15} /> Disponibilidade
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Disponibilidade semanal"
        className="m-auto w-[min(92vw,420px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-medium">Disponibilidade semanal</span>
          <button type="button" onClick={close} aria-label="Fechar" className="text-faint hover:text-ink">
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-2 px-5 py-5">
          <p className="mb-1 text-sm text-muted">
            Minutos que você tem para estudar em cada dia. A agenda distribui seus tópicos e
            revisões dentro desse tempo.
          </p>
          {WEEKDAYS.map((label, i) => (
            <label key={i} className="flex items-center justify-between gap-3">
              <span className="text-sm">{label}</span>
              <span className="inline-flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={1440}
                  step={15}
                  value={mins[i] ?? 0}
                  onChange={(e) => setDay(i, e.target.value)}
                  className="w-24 rounded-lg border border-line bg-surface px-3 py-1.5 text-right text-sm tabular-nums"
                />
                <span className="w-8 text-xs text-muted">min</span>
              </span>
            </label>
          ))}
          <p className="mt-1 text-xs text-faint">
            Total: {Math.round((total / 60) * 10) / 10}h por semana
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </footer>
      </dialog>
    </>
  );
}
