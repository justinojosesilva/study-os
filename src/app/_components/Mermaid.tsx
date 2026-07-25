"use client";

import { useEffect, useRef, useState } from "react";

let seq = 0;

/**
 * Renders a mermaid diagram. `mermaid` is imported dynamically inside the effect,
 * so the (large) library is code-split and only loaded when a lesson containing a
 * diagram is opened. Falls back to the raw source if rendering fails.
 */
export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dark =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: dark ? "dark" : "default",
        });
        const { svg } = await mermaid.render(`mmd-${seq++}`, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 text-xs">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Diagrama"
      className="my-4 flex justify-center overflow-x-auto rounded-lg border border-line bg-surface p-4"
    />
  );
}
