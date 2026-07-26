"use client";

import { useEffect, useRef, useState } from "react";
import type { Phase } from "./useStudyTimer";

export type TrackLists = { focus: string[]; break: string[] };

const CROSSFADE_MS = 4000;
const FADE_IN_MS = 1500;
const FADE_OUT_MS = 900;
const TICK_MS = 50;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Filename without extension — enough to show what's playing. */
export function trackTitle(src: string): string {
  const file = decodeURIComponent(src.split("/").pop() ?? "");
  return file.replace(/\.[^.]+$/, "");
}

/**
 * Plays the files dropped into `public/audio/*` as a shuffled, looping bed.
 *
 * Two audio elements alternate so tracks can crossfade instead of dropping to
 * silence between them — a hard cut is exactly the kind of thing that pulls you
 * out of focus. Every volume move (fade in, crossfade, user dragging the
 * slider) goes through one ticker that eases each element toward its own
 * target, so the cases can't fight each other.
 */
class Playlist {
  private els: HTMLAudioElement[];
  private state: { vol: number; target: number; step: number }[];
  private order: string[] = [];
  private index = 0;
  private active = 0;
  private handingOver = false;
  private failures = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private volume: number;
  private onTrack: (src: string | null) => void;
  private onBlocked: () => void;

  constructor(
    sources: string[],
    volume: number,
    onTrack: (src: string | null) => void,
    onBlocked: () => void,
  ) {
    this.volume = volume;
    this.onTrack = onTrack;
    this.onBlocked = onBlocked;
    this.els = [new Audio(), new Audio()];
    this.state = this.els.map(() => ({ vol: 0, target: 0, step: 0 }));
    this.els.forEach((el) => {
      el.preload = "auto";
      el.volume = 0;
    });
    this.order = shuffle(sources);
    this.ticker = setInterval(() => this.tick(), TICK_MS);
    void this.play(0, FADE_IN_MS);
  }

  private tick() {
    this.els.forEach((el, i) => {
      const s = this.state[i];
      if (s.vol !== s.target) {
        const next = s.vol + s.step;
        s.vol = s.step > 0 ? Math.min(next, s.target) : Math.max(next, s.target);
        el.volume = Math.max(0, Math.min(1, s.vol));
        if (s.vol === 0 && s.target === 0) el.pause();
      }
    });

    // Hand over to the next track while the current one is still playing.
    const el = this.els[this.active];
    if (!this.handingOver && el.duration && Number.isFinite(el.duration)) {
      const remainingMs = (el.duration - el.currentTime) * 1000;
      if (remainingMs <= CROSSFADE_MS) {
        this.handingOver = true;
        this.fade(this.active, 0, CROSSFADE_MS);
        void this.play((this.active + 1) % 2, CROSSFADE_MS, true);
      }
    }
  }

  private fade(slot: number, target: number, ms: number) {
    const s = this.state[slot];
    s.target = target;
    s.step = ((target - s.vol) / ms) * TICK_MS;
  }

  private async play(slot: number, fadeMs: number, advance = false) {
    if (this.order.length === 0) return;
    if (advance) this.index = (this.index + 1) % this.order.length;
    const src = this.order[this.index];

    const el = this.els[slot];
    el.src = src;
    el.currentTime = 0;
    this.state[slot].vol = 0;
    el.volume = 0;

    try {
      await el.play();
    } catch (err) {
      if ((err as DOMException)?.name === "NotAllowedError") {
        // Autoplay policy refused — surfaced so the UI can ask for a click
        // instead of silently playing nothing.
        this.onBlocked();
        return;
      }
      // Unplayable or corrupt file: skip it instead of killing the whole bed.
      // Give up only once every track has failed, so this can't spin forever.
      this.failures += 1;
      if (this.failures >= this.order.length) {
        this.onTrack(null);
        return;
      }
      void this.play(slot, fadeMs, true);
      return;
    }

    this.failures = 0;
    this.active = slot;
    this.handingOver = false;
    this.fade(slot, this.volume, fadeMs);
    this.onTrack(src);

    // Safety net for files whose duration never resolves.
    el.onended = () => {
      if (this.handingOver) return;
      this.handingOver = true;
      void this.play((slot + 1) % 2, FADE_IN_MS, true);
    };
  }

  setVolume(volume: number) {
    this.volume = volume;
    // Only the audible element follows the slider; the other is mid-fade.
    this.fade(this.active, volume, 250);
  }

  skip() {
    this.handingOver = true;
    this.fade(this.active, 0, 400);
    void this.play((this.active + 1) % 2, 600, true);
  }

  async stop() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    const els = this.els;
    const states = this.state;
    // Fade out by hand: the ticker is already gone.
    const steps = FADE_OUT_MS / TICK_MS;
    for (let n = 0; n < steps; n++) {
      els.forEach((el, i) => {
        states[i].vol = Math.max(0, states[i].vol - states[i].vol / (steps - n || 1));
        el.volume = Math.max(0, Math.min(1, states[i].vol));
      });
      await new Promise((r) => setTimeout(r, TICK_MS));
    }
    els.forEach((el) => {
      el.onended = null;
      el.pause();
      el.removeAttribute("src");
      el.load();
    });
    this.onTrack(null);
  }
}

export function useAmbientPlayer({
  phase,
  running,
  enabled,
  volume,
}: {
  phase: Phase;
  running: boolean;
  enabled: boolean;
  volume: number;
}) {
  const [tracks, setTracks] = useState<TrackLists | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const playerRef = useRef<{ playlist: Playlist; phase: Phase } | null>(null);
  const skipRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ambient-tracks")
      .then((r) => r.json())
      .then((data: TrackLists) => {
        if (!cancelled) setTracks(data);
      })
      .catch(() => {
        if (!cancelled) setTracks({ focus: [], break: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const list = phase === "focus" ? tracks?.focus : tracks?.break;
    const shouldPlay = running && enabled && volume > 0 && !!list?.length;

    if (!shouldPlay) {
      const previous = playerRef.current;
      playerRef.current = null;
      skipRef.current = null;
      void previous?.playlist.stop();
      return;
    }

    // Each phase has its own bed, so changing phase restarts the playlist.
    if (playerRef.current && playerRef.current.phase !== phase) {
      const previous = playerRef.current;
      playerRef.current = null;
      void previous.playlist.stop();
    }

    if (!playerRef.current) {
      const playlist = new Playlist(
        list,
        volume,
        (src) => setCurrent(src),
        () => setBlocked(true),
      );
      playerRef.current = { playlist, phase };
      skipRef.current = () => playlist.skip();
    } else {
      playerRef.current.playlist.setVolume(volume);
    }
  }, [phase, running, enabled, volume, tracks]);

  useEffect(() => {
    return () => {
      const previous = playerRef.current;
      playerRef.current = null;
      void previous?.playlist.stop();
    };
  }, []);

  const list = phase === "focus" ? tracks?.focus : tracks?.break;

  return {
    /** null while the listing is still loading. */
    hasTracks: tracks === null ? null : (list?.length ?? 0) > 0,
    trackCount: list?.length ?? 0,
    currentTitle: current ? trackTitle(current) : null,
    blocked,
    skip: () => skipRef.current?.(),
  };
}
