"use client";

import { useState, useTransition } from "react";
import { Sparkles, TriangleAlert, Lightbulb } from "lucide-react";
import { generateWeekStrategyAction } from "@/app/_actions/schedule";
import type { WeekStrategy as Strategy } from "@/domain/ai/weekStrategy";
import { SkeletonBlock, SkeletonText } from "./Skeleton";

export function WeekStrategy() {
  const [data, setData] = useState<Strategy | null>(null);
  const [mocked, setMocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateWeekStrategyAction();
      if (res.ok) {
        setData(res.data);
        setMocked(res.mocked);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <section className="mb-4 rounded-xl border border-line bg-surface px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Sparkles size={16} className="text-certificacao" /> Estratégia da semana
        </h2>
        <button
          onClick={generate}
          disabled={pending}
          className="press inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-50"
        >
          <Sparkles size={14} /> {pending ? "Gerando…" : data ? "Refazer" : "Gerar"}
        </button>
      </div>

      {!data && !error && !pending && (
        <p className="mt-2 text-sm text-muted">
          A IA lê seu plano da semana e explica o porquê das prioridades — o que atacar primeiro e
          como executar.
        </p>
      )}

      {pending && (
        <SkeletonBlock label="Gerando estratégia…" className="mt-3">
          <SkeletonText lines={3} />
        </SkeletonBlock>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {data && !pending && (
        <div className="mt-3 flex flex-col gap-3">
          {mocked && (
            <p className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
              <TriangleAlert size={13} /> Demonstração (mock) — defina ANTHROPIC_API_KEY para
              estratégia real.
            </p>
          )}

          <p className="text-sm leading-relaxed">{data.summary}</p>

          {data.priorities.length > 0 && (
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed">
              {data.priorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}

          {data.tip && (
            <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-warning" />
              {data.tip}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
