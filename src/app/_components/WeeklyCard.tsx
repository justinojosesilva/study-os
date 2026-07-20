"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { setWeeklyGoalAction } from "@/app/_actions/settings";

export function WeeklyCard({ hours, goal }: { hours: number; goal: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(goal);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Bullet chart: measure (hours) with a target marker at the goal.
  const scaleMax = Math.max(goal * 1.15, hours || 0.1);
  const targetPct = goal > 0 ? (goal / scaleMax) * 100 : 0;
  const fillPct = Math.min(100, (hours / scaleMax) * 100);
  const reached = hours >= goal;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setWeeklyGoalAction(value);
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">Esta semana</p>
        {!editing && (
          <button
            onClick={() => {
              setValue(goal);
              setEditing(true);
            }}
            aria-label="Editar meta semanal"
            className="text-faint transition-colors hover:text-ink"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      <p className="mt-1 text-2xl font-medium tabular-nums">
        {hours.toLocaleString("pt-BR")}h
        {!editing && (
          <span className="ml-1 text-sm font-normal text-muted">de {goal}h</span>
        )}
      </p>

      {editing ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-sm text-muted">de</span>
          <input
            type="number"
            min={1}
            max={168}
            value={value}
            autoFocus
            onChange={(e) => setValue(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-14 rounded-md border border-line bg-surface px-2 py-1 text-sm tabular-nums"
          />
          <span className="text-sm text-muted">h</span>
          <button
            onClick={save}
            disabled={pending}
            aria-label="Salvar"
            className="ml-auto text-faculdade hover:opacity-80 disabled:opacity-50"
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => setEditing(false)}
            aria-label="Cancelar"
            className="text-faint hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          className="relative mt-3 h-2 rounded-full bg-surface"
          title={`${hours.toLocaleString("pt-BR")}h de ${goal}h`}
        >
          <div
            className={`h-full origin-left rounded-full motion-safe:animate-[growX_.5s_ease-out] ${
              reached ? "bg-faculdade" : "bg-faculdade/70"
            }`}
            style={{ width: `${fillPct}%` }}
          />
          <div
            className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-ink/60"
            style={{ left: `${targetPct}%` }}
            aria-hidden
          />
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
