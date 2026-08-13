"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 *
 * 4. O estado SOBREVIVE a recarregar a página. Ver `escopo` e a nota sobre
 *    batimento abaixo — uma hora e meia de estudo já foi perdida por um reload,
 *    e o tempo só existia na memória desta aba.
 */

/**
 * Estado guardado entre recargas. `lastSeenAt` é o batimento: sem ele não dá
 * para distinguir "recarreguei agora" de "deixei a aba aberta e fui dormir".
 */
type EstadoSalvo = {
  v: 1;
  modeIndex: number;
  phase: Phase;
  focusMs: number;
  restMs: number;
  phaseBankedMs: number;
  startedAt: number | null;
  lastSeenAt: number;
};

/**
 * Acima disto, o intervalo entre o último batimento e a volta NÃO é estudo.
 *
 * Recarregar leva segundos; fechar o notebook leva horas. Sem esse corte,
 * reabrir a aba no dia seguinte creditaria uma fase inteira de foco que nunca
 * aconteceu — e horas, ofensiva e heatmap saem todos daí.
 */
const ABANDONO_MS = 90_000;

const chave = (escopo: string) => `latis:timer:${escopo}`;

function ler(escopo: string): EstadoSalvo | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(chave(escopo));
    if (!bruto) return null;
    const s = JSON.parse(bruto) as EstadoSalvo;
    return s?.v === 1 && typeof s.lastSeenAt === "number" ? s : null;
  } catch {
    // JSON corrompido ou storage bloqueado: seguir sem estado é melhor que
    // quebrar o cronômetro inteiro.
    return null;
  }
}

function gravar(escopo: string, s: EstadoSalvo) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chave(escopo), JSON.stringify(s));
  } catch {
    // Modo privado ou cota estourada. Perder a persistência é ruim; derrubar a
    // sessão em andamento por causa dela seria pior.
  }
}

function limpar(escopo: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(chave(escopo));
  } catch {
    /* idem */
  }
}

/**
 * @param escopo Identifica QUAL cronômetro está sendo salvo. O widget flutuante
 *   é preso a um tópico e o diálogo escolhe o tópico no formulário — com uma
 *   chave só, recarregar numa aula diferente colaria o tempo de uma no crédito
 *   da outra. Sem escopo, nada é persistido.
 */
export function useStudyTimer(initialFocusMin?: number, escopo?: string) {
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

  /**
   * Reidrata uma vez, na montagem.
   *
   * Não uso inicializador preguiçoso do `useState` de propósito: o servidor
   * renderiza 00:00 e o cliente renderizaria o tempo salvo, o que é divergência
   * de hidratação. Aqui pisca o zero por um quadro e depois assume — feio por
   * um instante, correto sempre.
   *
   * A regra `set-state-in-effect` está desligada SÓ neste bloco, e não por
   * conveniência: ela existe para impedir renderização em cascata a partir de
   * estado derivado. Aqui o efeito faz o que a própria documentação do React
   * descreve como uso legítimo — ler um sistema externo (o `localStorage`) uma
   * vez e sincronizar o estado do React com ele. Roda uma vez por montagem,
   * guardado por `reidratado`, e não há como fazer no inicializador sem
   * quebrar a hidratação.
   */
  const reidratado = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!escopo || reidratado.current) return;
    reidratado.current = true;

    const s = ler(escopo);
    if (!s) return;

    setModeIndex(s.modeIndex);
    setPhase(s.phase);
    setFocusMs(s.focusMs);
    setRestMs(s.restMs);

    const alvo = (s.phase === "focus" ? MODES[s.modeIndex].focus : MODES[s.modeIndex].rest) * 60_000;

    if (s.startedAt === null) {
      // Estava pausado: nada a decidir, o tempo parado não anda.
      setPhaseBankedMs(s.phaseBankedMs);
      return;
    }

    const ausente = Date.now() - s.lastSeenAt;
    if (ausente > ABANDONO_MS) {
      // Aba fechada, máquina suspensa. Credita só até o último batimento e
      // volta PAUSADO — retomar sozinho seria contar como estudo um tempo em
      // que ninguém estava lá.
      const ate = Math.min(s.phaseBankedMs + (s.lastSeenAt - s.startedAt), alvo);
      setPhaseBankedMs(Math.max(0, ate));
      setStartedAt(null);
      setNow(Date.now());
    } else {
      // Recarga comum: o cronômetro simplesmente continua. O tempo decorrido
      // vem de `Date.now() - startedAt`, então a conta atravessa o reload
      // sozinha.
      setPhaseBankedMs(s.phaseBankedMs);
      setStartedAt(s.startedAt);
      setNow(Date.now());
    }
  }, [escopo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // O snapshot vive num ref para o batimento poder gravá-lo sem virar
  // dependência de efeito — senão o intervalo se remontaria a cada tique. É
  // escrito DENTRO do efeito, nunca durante a renderização.
  const instantaneo = useRef<Omit<EstadoSalvo, "lastSeenAt">>({
    v: 1,
    modeIndex,
    phase,
    focusMs,
    restMs,
    phaseBankedMs,
    startedAt,
  });

  // 1) Grava quando o estado muda de verdade. `now` fica FORA das dependências:
  //    ele avança a cada 250ms e gravaria no disco quatro vezes por segundo.
  useEffect(() => {
    instantaneo.current = { v: 1, modeIndex, phase, focusMs, restMs, phaseBankedMs, startedAt };
    if (!escopo || !reidratado.current) return;
    const vazio = startedAt === null && focusMs === 0 && restMs === 0 && phaseBankedMs === 0;
    if (vazio) limpar(escopo);
    else gravar(escopo, { ...instantaneo.current, lastSeenAt: Date.now() });
  }, [escopo, modeIndex, phase, focusMs, restMs, phaseBankedMs, startedAt]);

  // 2) Batimento enquanto roda: só renova `lastSeenAt`, a cada 5s. É ele que
  //    diz, na volta, até quando a pessoa esteve de fato presente.
  useEffect(() => {
    if (!escopo || startedAt === null) return;
    const id = setInterval(() => {
      gravar(escopo, { ...instantaneo.current, lastSeenAt: Date.now() });
    }, 5_000);
    return () => clearInterval(id);
  }, [escopo, startedAt]);

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

  const clear = useCallback(
    (index: number) => {
      setModeIndex(index);
      setPhase("focus");
      setStartedAt(null);
      setPhaseBankedMs(0);
      setFocusMs(0);
      setRestMs(0);
      // Apaga na hora em vez de esperar o efeito: `reset()` é chamado logo após
      // salvar a sessão, e o componente pode desmontar antes do efeito rodar —
      // aí o estado zumbi reapareceria na próxima visita.
      if (escopo) limpar(escopo);
    },
    [escopo],
  );

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
