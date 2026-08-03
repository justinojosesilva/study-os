"use client";

import { useRef } from "react";
import { Settings2, X, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import { LIMITS, type ReaderPrefs, type Surface, type Family } from "./useReaderPrefs";

const SURFACES: { value: Surface; label: string; swatch: string }[] = [
  { value: "sistema", label: "Sistema", swatch: "bg-surface border-line" },
  { value: "papel", label: "Papel", swatch: "bg-[#faf9f7] border-[#d9d4cd]" },
  { value: "sepia", label: "Sépia", swatch: "bg-[#f4ecd8] border-[#d8caa8]" },
];

/**
 * The reading controls, in a dialog rather than a permanent rail: they are
 * adjusted once in a while and then forgotten, and a lesson at this length
 * needs its horizontal space for the text and the index.
 */
export function ReaderSettings({
  prefs,
  update,
  reset,
  focus,
  onToggleFocus,
}: {
  prefs: ReaderPrefs;
  update: (patch: Partial<ReaderPrefs>) => void;
  reset: () => void;
  focus: boolean;
  onToggleFocus: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleFocus}
          aria-pressed={focus}
          aria-label={focus ? "Sair do modo foco" : "Modo foco"}
          className="tip rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          aria-label="Preferências de leitura"
          className="tip tip-left rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Settings2 size={16} />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Preferências de leitura"
        className="m-auto w-[min(92vw,420px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-medium">Leitura</span>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar"
            className="text-faint hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-5 px-5 py-5">
          <Slider
            label="Tamanho da fonte"
            value={prefs.fontSize}
            display={`${prefs.fontSize}px`}
            {...LIMITS.fontSize}
            onChange={(fontSize) => update({ fontSize })}
          />
          <Slider
            label="Entrelinha"
            value={prefs.lineHeight}
            display={prefs.lineHeight.toFixed(2)}
            {...LIMITS.lineHeight}
            onChange={(lineHeight) => update({ lineHeight })}
          />
          <Slider
            label="Largura do texto"
            value={prefs.width}
            display={`${prefs.width} caracteres`}
            {...LIMITS.width}
            onChange={(width) => update({ width })}
          />

          <Choice
            label="Fonte"
            options={[
              { value: "sans" as Family, label: "Sem serifa" },
              { value: "serif" as Family, label: "Serifada" },
            ]}
            value={prefs.family}
            onChange={(family) => update({ family })}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Superfície</span>
            <div className="flex gap-2">
              {SURFACES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => update({ surface: s.value })}
                  aria-pressed={prefs.surface === s.value}
                  className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                    prefs.surface === s.value
                      ? "border-profissional text-ink"
                      : "border-line text-muted hover:text-ink"
                  }`}
                >
                  <span className={`size-4 shrink-0 rounded border ${s.swatch}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={reset}
            className="press inline-flex items-center gap-1.5 self-start rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
          >
            <RotateCcw size={14} /> Restaurar padrão
          </button>
        </div>
      </dialog>
    </>
  );
}

function Slider({
  label,
  display,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="text-xs tabular-nums text-faint">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-profissional"
      />
    </label>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div role="group" className="flex overflow-hidden rounded-lg border border-line text-sm">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`flex-1 px-3 py-1.5 transition-colors ${
              value === o.value
                ? "bg-surface-2 font-medium text-ink"
                : "text-muted hover:text-ink"
            } ${o.value === "serif" ? "font-serif" : ""}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
