"use client";

import { useEffect, useRef } from "react";
import type { Phase } from "./useStudyTimer";

/**
 * Ambient sound for the study timer, synthesised in the browser.
 *
 * There are no audio files on purpose: real lo-fi tracks are licensed works,
 * and shipping (or streaming) them would mean either a licensing problem or a
 * third-party dependency that can vanish. Web Audio gives us something that
 * runs offline, weighs nothing, and never needs a CDN — at the cost of being a
 * warm evolving pad rather than lo-fi hip hop with drums and samples.
 *
 * The lo-fi character here comes from the same place it does on a real track:
 * everything is pushed through a low-pass filter so it sounds muffled and warm,
 * with a bed of vinyl-ish hiss on top.
 */

/** MIDI note numbers per chord. Focus sits in a minor key with 7ths/9ths. */
const PROGRESSIONS: Record<Phase, number[][]> = {
  focus: [
    [45, 60, 64, 67, 71], // Am9
    [41, 57, 60, 64, 69], // Fmaj7
    [36, 55, 59, 64, 67], // Cmaj7
    [43, 59, 62, 64, 69], // G6/9
  ],
  // Breaks stay on two open, consonant chords that drift slowly.
  break: [
    [41, 60, 65, 67, 72], // Fmaj9
    [36, 59, 64, 67, 74], // Cmaj9
  ],
};

const SETTINGS: Record<Phase, { chordSec: number; cutoff: number; noise: number; noiseType: "hiss" | "waves" }> = {
  focus: { chordSec: 9, cutoff: 700, noise: 0.012, noiseType: "hiss" },
  break: { chordSec: 15, cutoff: 480, noise: 0.02, noiseType: "waves" },
};

/**
 * The slider is calibrated for recorded tracks, which are mastered far louder
 * than this pad. Scaling keeps the fallback at a comparable perceived level
 * instead of blasting when the slider sits high.
 */
export const SYNTH_VOLUME_SCALE = 0.7;

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Ambient {
  private ctx: AudioContext;
  private master: GainNode;
  private padFilter: BiquadFilterNode;
  private voices: { osc: OscillatorNode; gain: GainNode }[] = [];
  private noise: AudioBufferSourceNode;
  private noiseGain: GainNode;
  private noiseFilter: BiquadFilterNode;
  private lfo: OscillatorNode;
  private chordTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private phase: Phase;

  constructor(phase: Phase, volume: number) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.phase = phase;
    const cfg = SETTINGS[phase];

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    // Pad — the muffled warmth is the whole point, so the filter is low.
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = cfg.cutoff;
    this.padFilter.Q.value = 0.7;
    this.padFilter.connect(this.master);

    const chord = PROGRESSIONS[phase][0];
    chord.forEach((note, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = midiToHz(note);
      // A little detune keeps the chord from sounding sterile.
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * (3 + i * 2);

      const gain = this.ctx.createGain();
      // Bass note carries; upper voices sit back so the chord stays soft.
      gain.gain.value = i === 0 ? 0.22 : 0.1;

      osc.connect(gain).connect(this.padFilter);
      osc.start();
      this.voices.push({ osc, gain });
    });

    // Slow filter movement so the bed never sits perfectly still.
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.value = 0.05;
    const lfoAmount = this.ctx.createGain();
    lfoAmount.gain.value = cfg.cutoff * 0.28;
    this.lfo.connect(lfoAmount).connect(this.padFilter.frequency);
    this.lfo.start();

    // Noise bed: hiss for focus (vinyl air), slow swells for the break (waves).
    const seconds = 4;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      // Brown-ish noise is far gentler than white for long listening.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    this.noise = this.ctx.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    if (cfg.noiseType === "hiss") {
      this.noiseFilter.type = "bandpass";
      this.noiseFilter.frequency.value = 1800;
      this.noiseFilter.Q.value = 0.6;
    } else {
      this.noiseFilter.type = "lowpass";
      this.noiseFilter.frequency.value = 420;
    }

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = cfg.noise;
    this.noise.connect(this.noiseFilter).connect(this.noiseGain).connect(this.master);
    this.noise.start();

    if (cfg.noiseType === "waves") {
      // Gentle swell, roughly the pace of breathing.
      const waveLfo = this.ctx.createOscillator();
      waveLfo.frequency.value = 0.08;
      const waveAmount = this.ctx.createGain();
      waveAmount.gain.value = cfg.noise * 0.8;
      waveLfo.connect(waveAmount).connect(this.noiseGain.gain);
      waveLfo.start();
    }

    this.fadeTo(volume, 2.5);
    this.chordTimer = setInterval(() => this.nextChord(), cfg.chordSec * 1000);
  }

  private nextChord() {
    const prog = PROGRESSIONS[this.phase];
    this.step = (this.step + 1) % prog.length;
    const chord = prog[this.step];
    const t = this.ctx.currentTime;
    this.voices.forEach((v, i) => {
      const note = chord[i % chord.length];
      // Glide instead of jumping — an abrupt chord change would be jarring
      // against a bed this quiet.
      v.osc.frequency.cancelScheduledValues(t);
      v.osc.frequency.setValueAtTime(v.osc.frequency.value, t);
      v.osc.frequency.exponentialRampToValueAtTime(midiToHz(note), t + 3);
    });
  }

  fadeTo(volume: number, seconds = 0.6) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
    this.master.gain.linearRampToValueAtTime(Math.max(0.0001, volume), t + seconds);
  }

  resume() {
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  async stop() {
    if (this.chordTimer) clearInterval(this.chordTimer);
    this.fadeTo(0, 0.8);
    await new Promise((r) => setTimeout(r, 900));
    this.voices.forEach((v) => v.osc.stop());
    this.lfo.stop();
    this.noise.stop();
    await this.ctx.close();
  }
}

/**
 * Plays the bed matching the current phase while the timer runs. Audio only
 * ever starts from a click (the timer's own start button), which is what the
 * browser autoplay policy requires.
 */
export function useAmbientAudio({
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
  const ref = useRef<{ engine: Ambient; phase: Phase } | null>(null);

  useEffect(() => {
    const shouldPlay = running && enabled && volume > 0;

    if (!shouldPlay) {
      const current = ref.current;
      ref.current = null;
      void current?.engine.stop();
      return;
    }

    // The two phases are different instruments, so switching rebuilds the bed.
    if (ref.current && ref.current.phase !== phase) {
      const previous = ref.current;
      ref.current = null;
      void previous.engine.stop();
    }

    if (!ref.current) {
      ref.current = { engine: new Ambient(phase, volume), phase };
    } else {
      ref.current.engine.resume();
      ref.current.engine.fadeTo(volume);
    }
  }, [phase, running, enabled, volume]);

  // Stop the sound if the page goes away mid-session.
  useEffect(() => {
    return () => {
      const current = ref.current;
      ref.current = null;
      void current?.engine.stop();
    };
  }, []);
}
