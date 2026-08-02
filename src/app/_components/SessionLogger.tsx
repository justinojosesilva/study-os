"use client";

import { useRef, useState, useTransition } from "react";
import { Play, Pause, RotateCcw, X, Timer, Coffee, SkipForward } from "lucide-react";
import { logStudySession } from "@/app/_actions/sessions";
import { useStudyTimer, MODES, fmtClock } from "./useStudyTimer";
import { useAmbientPlayer } from "./useAmbientPlayer";
import { useAmbientAudio, SYNTH_VOLUME_SCALE } from "./useAmbientAudio";
import { SoundControl, useSoundPrefs } from "./SoundControl";
import type { PickerTopic } from "@/domain/topics/repository";

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
  const timer = useStudyTimer(initialMinutes);
  const [manualDuration, setManualDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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

  // The saved duration follows the timer instead of the preset: saving after
  // 12 minutes of a 25-minute block used to log the full 25.
  const suggested = timer.started
    ? Math.max(1, timer.focusedMin)
    : (initialMinutes ?? timer.mode.focus);
  const durationMin = manualDuration ?? suggested;
  const resting = timer.phase === "break";

  function close() {
    timer.reset();
    setManualDuration(null);
    setError(null);
    dialogRef.current?.close();
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
        onClick={() => dialogRef.current?.showModal()}
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
        className="m-auto max-h-[92vh] w-[min(92vw,460px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        {/* Só o miolo rola: com a caixa de anotações maior, o formulário passa
            da altura de uma tela de notebook, e num diálogo que rola inteiro o
            "Salvar sessão" fica abaixo da dobra. Cabeçalho e rodapé fixos
            mantêm o botão sempre visível. */}
        <form onSubmit={onSubmit} className="flex max-h-[92vh] flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
            <span className="font-medium">Registrar sessão</span>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className="tip text-faint hover:text-ink"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
            <div
              className={`rounded-xl px-5 py-6 text-center transition-colors ${
                resting ? "bg-faculdade-soft" : "bg-surface-2"
              }`}
            >
              <p
                className={`mb-1 flex items-center justify-center gap-1.5 text-xs font-medium ${
                  resting ? "text-faculdade" : "text-muted"
                }`}
              >
                {resting ? (
                  <>
                    <Coffee size={13} /> Descanso
                  </>
                ) : (
                  "Foco"
                )}
              </p>

              <div className="font-mono text-5xl tabular-nums tracking-tight">
                {fmtClock(timer.remainingSec)}
              </div>

              <div className="mt-1 text-xs text-muted">
                {timer.focusedMin} min de estudo
                {timer.restedMin > 0 && ` · ${timer.restedMin} min de descanso`}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                {MODES.map((m, i) => (
                  <button
                    key={m.focus}
                    type="button"
                    onClick={() => {
                      timer.pickMode(i);
                      setManualDuration(null);
                    }}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      timer.modeIndex === i
                        ? "bg-ink text-canvas"
                        : "bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {m.focus}/{m.rest}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={timer.toggle}
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas"
                >
                  {timer.running ? <Pause size={16} /> : <Play size={16} />}
                  {timer.running ? "Pausar" : resting ? "Descansar" : "Iniciar"}
                </button>

                {resting && (
                  <button
                    type="button"
                    onClick={timer.skipBreak}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink"
                  >
                    <SkipForward size={15} /> Voltar ao foco
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    timer.reset();
                    setManualDuration(null);
                  }}
                  aria-label="Reiniciar"
                  className="rounded-lg border border-line px-3 py-2 text-muted hover:text-ink"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              <div className="mx-auto mt-4 max-w-[240px]">
                <SoundControl
                  enabled={sound.enabled}
                  onToggle={() => sound.setEnabled((v) => !v)}
                  volume={sound.volume}
                  onVolume={sound.setVolume}
                />
                <p className="mt-1 truncate text-[11px] text-faint">
                  {audio.hasTracks === false
                    ? `Som sintetizado · adicione faixas em public/audio/${resting ? "descanso" : "foco"}`
                    : audio.blocked
                      ? "O navegador bloqueou o áudio — toque em iniciar de novo"
                      : (audio.currentTitle ?? (resting ? "Som de descanso" : "Som de foco"))}
                </p>
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
                  onChange={(e) => setManualDuration(Number(e.target.value))}
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
              {/* Era rows={2} + resize-none, e as anotações reais passam de
                  2.000 caracteres com tabelas e código. Agora abre com espaço
                  útil e o usuário pode esticar. Markdown é renderizado depois,
                  na agenda e no calendário. */}
              <textarea
                name="notes"
                rows={8}
                placeholder="O que você estudou? Markdown funciona — títulos, listas, tabelas e código."
                className="min-h-32 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </Field>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-4">
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
