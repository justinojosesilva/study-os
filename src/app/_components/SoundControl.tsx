"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export const DEFAULT_VOLUME = 0.35;

/** Sound preferences shared by the session dialog and the floating widget. */
export function useSoundPrefs() {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  return { enabled, setEnabled, volume, setVolume };
}

export function SoundControl({
  enabled,
  onToggle,
  volume,
  onVolume,
  compact = false,
}: {
  enabled: boolean;
  onToggle: () => void;
  volume: number;
  onVolume: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={enabled ? "Desligar som" : "Ligar som"}
        aria-pressed={enabled}
        className={`shrink-0 rounded-md p-1 transition-colors ${
          enabled ? "text-ink" : "text-faint hover:text-muted"
        }`}
      >
        {enabled ? <Volume2 size={compact ? 14 : 16} /> : <VolumeX size={compact ? 14 : 16} />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={enabled ? volume : 0}
        onChange={(e) => onVolume(Number(e.target.value))}
        disabled={!enabled}
        aria-label="Volume do som ambiente"
        className={`h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-ink disabled:opacity-40 ${
          compact ? "max-w-[110px]" : ""
        }`}
      />
    </div>
  );
}
