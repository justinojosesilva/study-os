"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Copy control for a code block.
 *
 * `navigator.clipboard` rejects without a trusted gesture and on insecure
 * origins, so the failure is shown rather than swallowed — a button that
 * silently does nothing is worse than one that says it could not.
 */
export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={state === "done" ? "Copiado" : "Copiar código"}
      className={`tip tip-left absolute right-2 top-2 z-10 rounded-md border border-line bg-surface/90 p-1.5 backdrop-blur transition-opacity ${
        state === "idle" ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100" : "opacity-100"
      } ${state === "error" ? "text-red-500" : state === "done" ? "text-emerald-500" : "text-muted hover:text-ink"}`}
    >
      {state === "done" ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}
