"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, X, Check } from "lucide-react";
import { StartBlockButton } from "./SessionLauncher";
import { SessionNote } from "./SessionNote";
import { NextStepHint } from "./NextStepHint";
import type { NextStep } from "@/domain/notes/repository";
import { formatTime } from "@/lib/date";

export type CalBlock = {
  kind: "review" | "topic";
  label: string;
  minutes: number;
  topicId?: string;
  goalId?: string;
  goalTitle?: string;
};

export type PastSession = {
  topicTitle: string | null;
  durationMin: number;
  comprehension: number | null;
  startedAt: Date;
  note: { id: string; title: string; content: string } | null;
};

export type DayCell = {
  dateKey: string; // YYYY-MM-DD
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  reviews: number; // review blocks (marker)
  topics: number; // topic blocks (marker)
  pastMinutes: number; // >0 → studied marker (past days)
};

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function fmtMin(m: number): string {
  if (m <= 0) return "0";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}min`;
  return mm === 0 ? `${h}h` : `${h}h${String(mm).padStart(2, "0")}`;
}

function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const s = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MonthCalendar({
  monthLabel,
  cells,
  planByDate,
  pastByDate,
  nextSteps,
}: {
  monthLabel: string;
  cells: DayCell[];
  planByDate: Record<string, CalBlock[]>;
  pastByDate: Record<string, PastSession[]>;
  nextSteps: Map<string, NextStep>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  function open(key: string) {
    setSelected(key);
    dialogRef.current?.showModal();
  }
  function close() {
    setSelected(null);
    dialogRef.current?.close();
  }

  const plan = selected ? (planByDate[selected] ?? []) : [];
  const past = selected ? (pastByDate[selected] ?? []) : [];
  const pastTotal = past.reduce((s, x) => s + x.durationMin, 0);

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-4 sm:px-5">
      <p className="mb-3 text-sm font-medium">
        {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
      </p>

      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAY.map((w) => (
          <div key={w} className="py-0.5 text-center text-[11px] text-faint">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c) => {
          const hasContent = c.reviews > 0 || c.topics > 0 || c.pastMinutes > 0;
          const topicDots = Math.min(c.topics, 3);
          return (
            <button
              key={c.dateKey}
              type="button"
              disabled={!hasContent}
              onClick={() => open(c.dateKey)}
              className={`press relative min-h-[58px] rounded-lg border p-1.5 text-left transition-colors ${
                c.isToday ? "border-profissional/50" : "border-line"
              } ${c.inMonth ? "" : "opacity-40"} ${
                hasContent ? "cursor-pointer hover:bg-surface-2" : "cursor-default"
              }`}
            >
              <span
                className={`text-xs tabular-nums ${
                  c.isToday ? "font-medium text-profissional" : "text-ink"
                }`}
              >
                {c.dayNum}
              </span>
              <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                {c.pastMinutes > 0 && c.reviews === 0 && c.topics === 0 && (
                  <Check size={13} className="text-faint" />
                )}
                {c.reviews > 0 && <Dot className="bg-faculdade" />}
                {Array.from({ length: topicDots }, (_, i) => (
                  <Dot key={i} className="bg-profissional" />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <Legend className="bg-faculdade" label="revisão" />
        <Legend className="bg-profissional" label="estudo" />
        <span className="inline-flex items-center gap-1.5">
          <Check size={13} className="text-faint" /> estudado
        </span>
      </div>

      <dialog
        ref={dialogRef}
        aria-label={selected ? dayLabel(selected) : "Dia"}
        className="m-auto w-[min(92vw,440px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        {selected && (
          <div className="flex flex-col">
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <span className="font-medium">{dayLabel(selected)}</span>
              <button type="button" onClick={close} aria-label="Fechar" className="tip text-faint hover:text-ink">
                <X size={18} />
              </button>
            </header>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {plan.length === 0 && past.length === 0 && (
                <p className="py-3 text-sm text-muted">Nada planejado para este dia.</p>
              )}

              {plan.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {plan.map((b, i) =>
                    b.kind === "review" ? (
                      <li key={i}>
                        <Link
                          href="/review"
                          onClick={close}
                          className="press flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface-2"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-faculdade-soft text-faculdade">
                            <RefreshCw size={15} />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.label}</span>
                          <span className="shrink-0 text-xs text-muted tabular-nums">{fmtMin(b.minutes)}</span>
                        </Link>
                      </li>
                    ) : (
                      <li key={i} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xs font-medium text-muted tabular-nums">
                          {b.minutes}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{b.label}</p>
                          {b.goalTitle && <p className="truncate text-xs text-muted">{b.goalTitle}</p>}
                          {b.topicId && <NextStepHint step={nextSteps.get(b.topicId)} />}
                        </div>
                        <StartBlockButton topicId={b.topicId} minutes={b.minutes} />
                      </li>
                    ),
                  )}
                </ul>
              )}

              {/* What actually happened. Shown alongside the plan, never instead
                  of it — the days you studied are exactly the days that also
                  have a plan, so an either/or hid the history when it mattered. */}
              {past.length > 0 && (
                <div className={plan.length > 0 ? "mt-5 border-t border-line pt-4" : undefined}>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Check size={13} className="text-emerald-500" />
                    Estudado · {fmtMin(pastTotal)} em {past.length}{" "}
                    {past.length === 1 ? "sessão" : "sessões"}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {past.map((s, i) => (
                      <li key={i} className="rounded-lg border border-line px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {s.topicTitle ?? "Estudo livre"}
                          </span>
                          <span className="flex shrink-0 items-center gap-3 text-xs text-muted tabular-nums">
                            {s.comprehension != null && <span>{s.comprehension}/10</span>}
                            <span className="font-medium text-ink">{fmtMin(s.durationMin)}</span>
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-faint tabular-nums">
                          {formatTime(s.startedAt)}
                        </p>
                        {s.note && (
                          <SessionNote content={s.note.content} href={`/notes/${s.note.id}`} />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`size-1.5 rounded-full ${className}`} />;
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot className={className} /> {label}
    </span>
  );
}
