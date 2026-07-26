"use client";

import { useCallback, useEffect, useState } from "react";

export type Phase = "focus" | "break";

/** Pomodoro presets: minutes of focus and the break that follows each one. */
export const MODES = [
  { focus: 25, rest: 5 },
  { focus: 50, rest: 10 },
] as const;

export type Mode = (typeof MODES)[number];

/**
 * The timer behind both the session dialog and the floating widget.
 *
 * Three things it does deliberately:
 *
 * 1. Elapsed time comes from timestamps, not from counting ticks. `setInterval`
 *    drifts, and browsers throttle it hard in a background tab — counting ticks
 *    silently under-reports a session where you switched away.
 *
 * 2. A finished phase commits at most its own target, so a tab left in the
 *    background doesn't bank half an hour of "focus" it never saw.
 *
 * 3. Break time is tracked but kept OUT of the study total. The break is real
 *    and worth seeing, yet folding it into study minutes would inflate hours,
 *    the streak and the heatmap — the numbers the whole app derives from.
 */
export function useStudyTimer(initialFocusMin?: number) {
  const initialIndex = Math.max(
    0,
    MODES.findIndex((m) => m.focus === initialFocusMin),
  );
  const [modeIndex, setModeIndex] = useState(initialIndex);
  const [phase, setPhase] = useState<Phase>("focus");

  // `startedAt` and `now` are state, not refs: render must stay pure, so the
  // clock is a value React knows about rather than something read mid-render.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  // Committed totals from phases already finished or left behind.
  const [focusMs, setFocusMs] = useState(0);
  const [restMs, setRestMs] = useState(0);
  // Time banked in the current phase across pauses.
  const [phaseBankedMs, setPhaseBankedMs] = useState(0);

  const mode = MODES[modeIndex];
  const targetMs = (phase === "focus" ? mode.focus : mode.rest) * 60_000;
  const running = startedAt !== null;

  const liveMs = startedAt !== null ? Math.max(0, now - startedAt) : 0;
  const phaseMs = Math.min(phaseBankedMs + liveMs, targetMs);

  const totalFocusMs = focusMs + (phase === "focus" ? phaseMs : 0);
  const totalRestMs = restMs + (phase === "break" ? phaseMs : 0);

  /** Banks the current phase and moves to the other one. */
  const advance = useCallback(
    (next: Phase, banked: number, autoStart: boolean) => {
      if (phase === "focus") setFocusMs((v) => v + banked);
      else setRestMs((v) => v + banked);
      setPhaseBankedMs(0);
      setPhase(next);
      setStartedAt(autoStart ? Date.now() : null);
      setNow(Date.now());
    },
    [phase],
  );

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      const elapsed = phaseBankedMs + (t - startedAt);
      if (elapsed >= targetMs) {
        // Focus ending starts the break by itself — having to press a button to
        // begin resting is exactly what made break time impossible to account
        // for. The break ending stops, so the next block is a deliberate choice.
        advance(phase === "focus" ? "break" : "focus", targetMs, phase === "focus");
      } else {
        setNow(t);
      }
    }, 250);
    return () => clearInterval(id);
  }, [startedAt, phaseBankedMs, targetMs, phase, advance]);

  const toggle = useCallback(() => {
    if (startedAt !== null) {
      setPhaseBankedMs(Math.min(phaseBankedMs + (Date.now() - startedAt), targetMs));
      setStartedAt(null);
    } else {
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
    }
  }, [startedAt, phaseBankedMs, targetMs]);

  const clear = useCallback((index: number) => {
    setModeIndex(index);
    setPhase("focus");
    setStartedAt(null);
    setPhaseBankedMs(0);
    setFocusMs(0);
    setRestMs(0);
  }, []);

  const reset = useCallback(() => clear(modeIndex), [clear, modeIndex]);
  const pickMode = useCallback((index: number) => clear(index), [clear]);

  /** Leave the break early and go back to focusing. */
  const skipBreak = useCallback(() => advance("focus", phaseMs, false), [advance, phaseMs]);

  return {
    mode,
    modeIndex,
    pickMode,
    phase,
    running,
    toggle,
    reset,
    skipBreak,
    /** Countdown for the phase on screen. */
    remainingSec: Math.max(0, Math.ceil((targetMs - phaseMs) / 1000)),
    /** Study time only — what gets saved. */
    focusedMin: Math.round(totalFocusMs / 60_000),
    /** Break time — shown, never added to study minutes. */
    restedMin: Math.round(totalRestMs / 60_000),
    started: totalFocusMs > 0 || totalRestMs > 0,
  };
}

export function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
