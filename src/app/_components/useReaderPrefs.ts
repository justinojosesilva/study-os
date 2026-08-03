"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reading preferences.
 *
 * Kept in localStorage rather than a table: they are per-device settings for a
 * single user, and a row in Postgres would buy nothing but a round trip. If
 * syncing across machines ever matters, this becomes a column on `users`
 * without anything else moving.
 */

export type Surface = "sistema" | "papel" | "sepia";
export type Family = "sans" | "serif";

export type ReaderPrefs = {
  fontSize: number; // px
  lineHeight: number;
  width: number; // ch, applied to prose paragraphs
  family: Family;
  surface: Surface;
};

export const DEFAULT_PREFS: ReaderPrefs = {
  fontSize: 16,
  lineHeight: 1.75,
  // The measure the reader already used before any of this was adjustable.
  width: 68,
  family: "sans",
  surface: "sistema",
};

export const LIMITS = {
  fontSize: { min: 14, max: 22, step: 1 },
  lineHeight: { min: 1.4, max: 2.1, step: 0.05 },
  width: { min: 54, max: 96, step: 2 },
} as const;

const KEY = "studyos.reader.prefs";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function sanitize(raw: unknown): ReaderPrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const r = raw as Partial<ReaderPrefs>;
  return {
    fontSize: clamp(Number(r.fontSize) || DEFAULT_PREFS.fontSize, LIMITS.fontSize.min, LIMITS.fontSize.max),
    lineHeight: clamp(Number(r.lineHeight) || DEFAULT_PREFS.lineHeight, LIMITS.lineHeight.min, LIMITS.lineHeight.max),
    width: clamp(Number(r.width) || DEFAULT_PREFS.width, LIMITS.width.min, LIMITS.width.max),
    family: r.family === "serif" ? "serif" : "sans",
    surface: r.surface === "papel" || r.surface === "sepia" ? r.surface : "sistema",
  };
}

/**
 * Read through `useSyncExternalStore` rather than "default state plus a load
 * effect": localStorage is external state, the server has no access to it, and
 * setting state from an effect to catch up is the pattern React added this API
 * to replace.
 *
 * The snapshot is cached because the hook demands a stable reference — parsing
 * on every call would return a new object each time and spin.
 */
let cache: ReaderPrefs | null = null;
const listeners = new Set<() => void>();

function read(): ReaderPrefs {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? sanitize(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    // A corrupt or blocked store is not worth failing a page over.
    cache = DEFAULT_PREFS;
  }
  return cache;
}

function write(next: ReaderPrefs) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab changing the settings invalidates the cache here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useReaderPrefs() {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);

  const update = useCallback(
    (patch: Partial<ReaderPrefs>) => write(sanitize({ ...read(), ...patch })),
    [],
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    cache = DEFAULT_PREFS;
    listeners.forEach((l) => l());
  }, []);

  return { prefs, update, reset };
}

const PALETTES: Record<Exclude<Surface, "sistema">, { bg: string; body: string; ink: string; th: string; td: string }> = {
  papel: { bg: "#faf9f7", body: "#3d3a36", ink: "#26231f", th: "#d9d4cd", td: "#e6e2dc" },
  sepia: { bg: "#f4ecd8", body: "#4a3f2f", ink: "#2f2718", th: "#d8caa8", td: "#e3d8bd" },
};

/**
 * Surface colours, written as Tailwind Typography's own variables so the whole
 * prose tree follows without a stylesheet full of overrides.
 *
 * The `invert` twins have to be set as well, and the style has to land on the
 * `.prose` element itself: `dark:prose-invert` reassigns `--tw-prose-body` from
 * the invert set ON THAT ELEMENT, so an override on the parent is simply
 * replaced. First attempt put it on the wrapper and produced near-white text on
 * sepia — measured at lab(96.5), which is unreadable.
 *
 * "sistema" sets nothing and keeps the app's own light/dark tokens.
 */
export function surfaceStyle(surface: Surface): React.CSSProperties {
  if (surface === "sistema") return {};
  const p = PALETTES[surface];
  return {
    backgroundColor: p.bg,
    "--tw-prose-body": p.body,
    "--tw-prose-invert-body": p.body,
    "--tw-prose-headings": p.ink,
    "--tw-prose-invert-headings": p.ink,
    "--tw-prose-bold": p.ink,
    "--tw-prose-invert-bold": p.ink,
    "--tw-prose-quotes": p.ink,
    "--tw-prose-invert-quotes": p.ink,
    "--tw-prose-code": p.ink,
    "--tw-prose-invert-code": p.ink,
    "--tw-prose-counters": p.body,
    "--tw-prose-invert-counters": p.body,
    "--tw-prose-bullets": p.th,
    "--tw-prose-invert-bullets": p.th,
    "--tw-prose-th-borders": p.th,
    "--tw-prose-invert-th-borders": p.th,
    "--tw-prose-td-borders": p.td,
    "--tw-prose-invert-td-borders": p.td,
  } as React.CSSProperties;
}
