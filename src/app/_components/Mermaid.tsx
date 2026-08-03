"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";

let seq = 0;

/**
 * Renders a mermaid diagram. `mermaid` is imported dynamically inside the effect,
 * so the (large) library is code-split and only loaded when a lesson containing a
 * diagram is opened. Falls back to the raw source if rendering fails.
 */
export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
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

  /**
   * The SVG is MOVED into the dialog and moved back on close, not cloned.
   *
   * Mermaid ships a `<style>` inside the SVG whose rules are scoped by the
   * element's own id (`#mmd-3 .node rect { … }`). A clone with the id stripped
   * matches none of them and renders as solid black shapes with no text —
   * which is exactly what the first version did. Keeping the id would mean two
   * elements sharing one id in the document. Moving the node keeps the styles
   * and creates no duplicate.
   */
  function expand() {
    const svg = ref.current?.querySelector("svg");
    const target = zoomRef.current;
    if (!svg || !target) return;
    svg.style.maxWidth = "none";
    svg.style.width = "100%";
    svg.style.height = "auto";
    target.replaceChildren(svg);
    dialogRef.current?.showModal();
  }

  /** Puts the diagram back where it belongs, whatever closed the dialog. */
  function restore() {
    const svg = zoomRef.current?.querySelector("svg");
    if (!svg || !ref.current) return;
    svg.style.maxWidth = "";
    svg.style.width = "";
    svg.style.height = "";
    ref.current.replaceChildren(svg);
  }

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 text-xs">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <>
      {/* Um destes diagramas tem 1.681px de altura — rolar dentro dele para ler
          é o caso que mais dói, e a proposta só previa expandir código. */}
      <div className="group relative my-4">
        <button
          type="button"
          onClick={expand}
          aria-label="Expandir diagrama"
          className="tip tip-left absolute right-2 top-2 z-10 rounded-md border border-line bg-surface/90 p-1.5 text-muted opacity-0 backdrop-blur transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Maximize2 size={14} />
        </button>
        <div
          ref={ref}
          role="img"
          aria-label="Diagrama"
          className="flex justify-center overflow-x-auto rounded-lg border border-line bg-surface p-4"
        />
      </div>

      <dialog
        ref={dialogRef}
        onClose={restore}
        aria-label="Diagrama ampliado"
        className="m-auto h-[92vh] w-[min(96vw,1200px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/60"
      >
        <div className="flex h-full flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
            <span className="text-sm font-medium">Diagrama</span>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Fechar"
              className="text-faint hover:text-ink"
            >
              <X size={18} />
            </button>
          </header>
          {/* O SVG é clonado para cá quando o diálogo abre: renderizar o mesmo
              gráfico duas vezes custaria uma segunda passada do mermaid. */}
          <div ref={zoomRef} className="min-h-0 flex-1 overflow-auto p-6" />
        </div>
      </dialog>
    </>
  );
}
