"use client";

import { useState, useTransition } from "react";
import {
  Play, Pause, RotateCcw, Timer, Coffee, SkipForward, ChevronDown, X, Volume2, VolumeX,
} from "lucide-react";
import { logStudySession } from "@/app/_actions/sessions";
import { useStudyTimer, MODES, fmtClock } from "./useStudyTimer";
import { useAmbientPlayer } from "./useAmbientPlayer";
import { useAmbientAudio, SYNTH_VOLUME_SCALE } from "./useAmbientAudio";
import { SoundControl, useSoundPrefs } from "./SoundControl";

/**
 * Compact session timer for the reading pages.
 *
 * Fixed to a corner and deliberately small: the lesson is long, so the timer
 * must never take the page over or interrupt scrolling. It shares
 * `useStudyTimer` with the dialog, so focus/break behave identically in both.
 */
export function FloatingSessionLogger({
  topicId,
  topicTitle,
}: {
  topicId: string;
  topicTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualDuration, setManualDuration] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useStudyTimer();
  const sound = useSoundPrefs();

  const audio = useAmbientPlayer({
    phase: timer.phase,
    running: timer.running,
    enabled: sound.enabled,
    volume: sound.volume,
  });

  // Synthesised bed as a fallback: it plays only while this phase has no files,
  // so the session is never silent before any music has been added.
  useAmbientAudio({
    phase: timer.phase,
    running: timer.running,
    enabled: sound.enabled && audio.hasTracks === false,
    volume: sound.volume * SYNTH_VOLUME_SCALE,
  });

  const resting = timer.phase === "break";
  const durationMin = manualDuration ?? Math.max(1, timer.focusedMin || 1);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("topicId", topicId);
    fd.set("durationMin", String(durationMin));
    startTransition(async () => {
      const res = await logStudySession(fd);
      if (!res.ok) return setError(res.error);
      timer.reset();
      setManualDuration(null);
      setSaved(true);
      setOpen(false);
      setTimeout(() => setSaved(false), 4000);
    });
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 print:hidden">
      {saved && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium">
          Sessão salva.
        </p>
      )}

      {open && (
        <form
          onSubmit={onSubmit}
          className="w-[min(88vw,300px)] rounded-xl border border-line bg-surface p-3 shadow-lg"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-medium text-muted" title={topicTitle}>
              {topicTitle}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Recolher"
              className="shrink-0 text-faint hover:text-ink"
            >
              <ChevronDown size={15} />
            </button>
          </div>

          <div className="mb-2 flex items-center justify-center gap-1.5">
            {MODES.map((m, i) => (
              <button
                key={m.focus}
                type="button"
                onClick={() => {
                  timer.pickMode(i);
                  setManualDuration(null);
                }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  timer.modeIndex === i
                    ? "bg-ink text-canvas"
                    : "bg-surface-2 text-muted hover:text-ink"
                }`}
              >
                {m.focus}/{m.rest}
              </button>
            ))}
          </div>

          <div className="mb-2 border-y border-line py-2">
            <SoundControl
              compact
              enabled={sound.enabled}
              onToggle={() => sound.setEnabled((v) => !v)}
              volume={sound.volume}
              onVolume={sound.setVolume}
            />
            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[11px] text-faint">
                {audio.hasTracks === false
                  ? "Som sintetizado · sem faixas"
                  : audio.blocked
                    ? "Áudio bloqueado — toque em iniciar de novo"
                    : (audio.currentTitle ??
                      `${audio.trackCount} ${audio.trackCount === 1 ? "faixa" : "faixas"}`)}
              </p>
              {audio.currentTitle && (
                <button
                  type="button"
                  onClick={audio.skip}
                  aria-label="Próxima faixa"
                  className="tip tip-left shrink-0 text-faint hover:text-ink"
                >
                  <SkipForward size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted">Duração (min)</span>
              <input
                type="number"
                min={1}
                value={durationMin}
                onChange={(e) => setManualDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted">Compreensão</span>
              <input
                type="number"
                name="comprehension"
                min={1}
                max={10}
                placeholder="1–10"
                className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <textarea
            name="notes"
            rows={2}
            placeholder="Anotações desta sessão…"
            className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          />

          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="press mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            <Timer size={15} /> {pending ? "Salvando…" : "Salvar sessão"}
          </button>
        </form>
      )}

      {/* Always-visible bar: the clock stays readable while the panel is shut. */}
      <div
        className={`flex items-center gap-1 rounded-full border py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur transition-colors ${
          resting ? "border-faculdade/40 bg-faculdade-soft" : "border-line bg-surface/95"
        }`}
      >
        {resting && <Coffee size={14} className="shrink-0 text-faculdade" />}
        <span className="font-mono text-sm tabular-nums" aria-live="polite">
          {fmtClock(timer.remainingSec)}
        </span>

        <button
          type="button"
          onClick={timer.toggle}
          aria-label={timer.running ? "Pausar" : resting ? "Descansar" : "Iniciar"}
          className="tip press ml-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-canvas"
        >
          {timer.running ? <Pause size={15} /> : <Play size={15} />}
        </button>

        {resting ? (
          <button
            type="button"
            onClick={timer.skipBreak}
            aria-label="Voltar ao foco"
            className="tip tip-left press flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
          >
            <SkipForward size={15} />
          </button>
        ) : (
          timer.started && (
            <button
              type="button"
              onClick={() => {
                timer.reset();
                setManualDuration(null);
              }}
              aria-label="Reiniciar"
              className="press flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
            >
              <RotateCcw size={15} />
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => sound.setEnabled((v) => !v)}
          aria-label={sound.enabled ? "Desligar som" : "Ligar som"}
          aria-pressed={sound.enabled}
          className={`press flex size-8 shrink-0 items-center justify-center rounded-full ${
            sound.enabled ? "text-muted hover:text-ink" : "text-faint hover:text-muted"
          }`}
        >
          {sound.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Recolher sessão" : "Registrar sessão"}
          aria-expanded={open}
          className="press flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
        >
          {open ? <X size={15} /> : <Timer size={15} />}
        </button>
      </div>

      {timer.started && !open && (
        <p className="rounded-md bg-surface/90 px-2 py-0.5 text-[11px] text-muted backdrop-blur">
          {timer.focusedMin} min de estudo
          {timer.restedMin > 0 && ` · ${timer.restedMin} de descanso`}
        </p>
      )}
    </div>
  );
}
