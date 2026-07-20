"use client";

import { useState, useTransition } from "react";
import { Trash2, ExternalLink, Pencil, Check } from "lucide-react";
import { MATERIAL_TYPE, MATERIAL_TYPE_OPTIONS, type MaterialType } from "@/lib/materials";
import {
  updateMaterialAction,
  updateMaterialProgressAction,
  deleteMaterialAction,
} from "@/app/_actions/materials";

type MaterialLite = {
  id: string;
  type: MaterialType;
  title: string;
  url: string | null;
  progressPct: number;
};

export function MaterialRow({
  material,
  goalId,
}: {
  material: MaterialLite;
  goalId: string | null;
}) {
  const [progress, setProgress] = useState(material.progressPct);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const meta = MATERIAL_TYPE[material.type];
  const Icon = meta.Icon;

  function commit(value: number) {
    if (value === material.progressPct) return;
    setError(null);
    startTransition(async () => {
      const res = await updateMaterialProgressAction(material.id, goalId, value);
      if (!res.ok) {
        setError(res.error);
        setProgress(material.progressPct);
      }
    });
  }

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateMaterialAction(
        material.id,
        goalId,
        String(fd.get("type") ?? ""),
        String(fd.get("title") ?? ""),
        String(fd.get("url") ?? ""),
      );
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteMaterialAction(material.id, goalId);
      if (!res.ok) setError(res.error);
    });
  }

  if (editing) {
    return (
      <li className="border-b border-line py-3 last:border-0">
        <form onSubmit={save} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <select
              name="type"
              defaultValue={material.type}
              className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
            >
              {MATERIAL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              name="title"
              defaultValue={material.title}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
            />
          </div>
          <input
            name="url"
            type="url"
            defaultValue={material.url ?? ""}
            placeholder="https://… (opcional)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-2.5 py-1 text-xs text-muted hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-canvas disabled:opacity-50"
            >
              <Check size={13} /> Salvar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <Icon size={17} className="shrink-0 text-muted" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {material.url ? (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm font-medium text-profissional hover:underline"
            >
              {material.title}
            </a>
          ) : (
            <span className="truncate text-sm font-medium">{material.title}</span>
          )}
          {material.url && <ExternalLink size={12} className="shrink-0 text-faint" />}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex w-36 shrink-0 items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          disabled={pending}
          onChange={(e) => setProgress(Number(e.target.value))}
          onPointerUp={() => commit(progress)}
          onKeyUp={() => commit(progress)}
          className="flex-1 accent-faculdade"
          aria-label={`Progresso de ${material.title}`}
        />
        <span className="w-9 text-right text-xs tabular-nums text-muted">{progress}%</span>
      </div>

      <button
        onClick={() => setEditing(true)}
        aria-label="Editar material"
        className="shrink-0 text-faint transition-colors hover:text-ink"
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={remove}
        disabled={pending}
        aria-label="Remover material"
        className="shrink-0 text-faint transition-colors hover:text-red-600 disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
