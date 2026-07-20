"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Play, Pause, RotateCcw, X, Timer } from "lucide-react";
import { logStudySession } from "@/app/_actions/sessions";
import type { PickerTopic } from "@/domain/topics/repository";

const MODES = [25, 50] as const;

export function SessionLogger({
  topics,
  initialTopicId,
  initialMinutes,
  triggerLabel = "Iniciar sessão",
  triggerClassName,
}: {
  topics: PickerTopic[];
  initialTopicId?: string;
  initialMinutes?: number;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [focusLen, setFocusLen] = useState<number>(25);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [durationMin, setDurationMin] = useState(initialMinutes ?? 25);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const targetSec = focusLen * 60;
  const remaining = Math.max(0, targetSec - elapsedSec);
  const focusedMin = Math.max(1, Math.round(elapsedSec / 60));

  useEffect(() => {
    if (running && elapsedSec >= targetSec) {
      setRunning(false);
      setDurationMin(focusLen);
    }
  }, [running, elapsedSec, targetSec, focusLen]);

  function open() {
    dialogRef.current?.showModal();
  }
  function close() {
    setRunning(false);
    setElapsedSec(0);
    setError(null);
    dialogRef.current?.close();
  }
  function pickMode(min: number) {
    setFocusLen(min);
    setDurationMin(min);
    setElapsedSec(0);
    setRunning(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("durationMin", String(durationMin));
    startTransition(async () => {
      const res = await logStudySession(fd);
      if (res.ok) close();
      else setError(res.error);
    });
  }

  return (
    <>
      <button
        onClick={open}
        className={
          triggerClassName ??
          "inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
        }
      >
        <Play size={16} /> {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Iniciar sessão de estudo"
        className="m-auto w-[min(92vw,460px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <form onSubmit={onSubmit} className="flex flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-medium">Registrar sessão</span>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className="text-faint hover:text-ink"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex flex-col gap-5 px-5 py-5">
            <div className="rounded-xl bg-surface-2 px-5 py-6 text-center">
              <div className="font-mono text-5xl tabular-nums tracking-tight">
                {fmt(running || elapsedSec > 0 ? remaining : targetSec)}
              </div>
              <div className="mt-1 text-xs text-muted">
                {focusLen} min de foco · {focusedMin} min acumulados
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickMode(m)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      focusLen === m
                        ? "bg-ink text-canvas"
                        : "bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {m}/{m === 25 ? 5 : 10}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRunning((r) => !r)}
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas"
                >
                  {running ? <Pause size={16} /> : <Play size={16} />}
                  {running ? "Pausar" : "Iniciar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setElapsedSec(0);
                    setRunning(false);
                  }}
                  aria-label="Reiniciar"
                  className="rounded-lg border border-line px-3 py-2 text-muted hover:text-ink"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            <Field label="Tópico">
              <select
                name="topicId"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                defaultValue={initialTopicId ?? ""}
              >
                <option value="">Sem tópico específico</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.goalTitle} — {t.title}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Duração (min)">
                <input
                  type="number"
                  min={1}
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Compreensão (1–10)">
                <input
                  type="number"
                  name="comprehension"
                  min={1}
                  max={10}
                  placeholder="opcional"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Anotações">
              <textarea
                name="notes"
                rows={2}
                placeholder="O que você estudou?"
                className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </Field>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
            >
              <Timer size={16} /> {pending ? "Salvando…" : "Salvar sessão"}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function fmt(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
