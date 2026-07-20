"use client";

import { useState, useTransition } from "react";
import { Sparkles, Plus, Check, TriangleAlert } from "lucide-react";
import { analyzeGoalGapsAction } from "@/app/_actions/ai";
import { createTopicAction } from "@/app/_actions/topics";
import type { GapAnalysis } from "@/domain/ai/gapAnalysis";
import { Skeleton, SkeletonBlock, SkeletonText } from "./Skeleton";

const PRIORITY = {
  alta: "bg-red-600/10 text-red-600",
  média: "bg-warning/15 text-warning",
  baixa: "bg-surface-2 text-muted",
} as const;

export function GapAnalysis({ goalId }: { goalId: string }) {
  const [data, setData] = useState<GapAnalysis | null>(null);
  const [mocked, setMocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [addingPending, startAdding] = useTransition();

  function analyze() {
    setError(null);
    startTransition(async () => {
      const res = await analyzeGoalGapsAction(goalId);
      if (res.ok) {
        setData(res.data);
        setMocked(res.mocked);
      } else {
        setError(res.error);
        setData(null);
      }
    });
  }

  function addTopic(title: string) {
    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("title", title);
    fd.set("weight", "1");
    startAdding(async () => {
      const res = await createTopicAction(fd);
      if (res.ok) setAdded((prev) => new Set(prev).add(title));
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Sparkles size={17} className="text-certificacao" />
          Análise de lacunas
        </h2>
        <button
          onClick={analyze}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles size={14} /> {pending ? "Analisando…" : data ? "Refazer" : "Analisar"}
        </button>
      </div>

      {!data && !error && !pending && (
        <p className="mt-2 text-sm text-muted">
          A IA analisa seus tópicos e o objetivo para apontar o que você já domina, as
          lacunas que faltam e o que estudar em seguida.
        </p>
      )}

      {pending && (
        <SkeletonBlock label="Analisando lacunas…" className="mt-4 flex flex-col gap-4">
          <SkeletonText lines={2} />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </SkeletonBlock>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {data && !pending && (
        <div className="mt-4 flex flex-col gap-4">
          {mocked && (
            <p className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
              <TriangleAlert size={13} /> Demonstração (mock) — defina ANTHROPIC_API_KEY para
              análise real.
            </p>
          )}

          <p className="text-sm leading-relaxed">{data.summary}</p>

          {data.strengths.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">
                Você já tem
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {data.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-md bg-faculdade-soft px-2 py-1 text-xs text-faculdade"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.gaps.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">
                Lacunas
              </p>
              <ul className="flex flex-col gap-2">
                {data.gaps.map((g, i) => (
                  <li key={i} className="rounded-lg border border-line px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{g.skill}</span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY[g.priority]}`}
                      >
                        {g.priority}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{g.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.suggestedTopics.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">
                Sugestões de tópicos
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {data.suggestedTopics.map((t) => {
                  const isAdded = added.has(t);
                  return (
                    <li key={t}>
                      <button
                        onClick={() => addTopic(t)}
                        disabled={isAdded || addingPending}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-70 ${
                          isAdded
                            ? "border-line bg-faculdade-soft text-faculdade"
                            : "border-line bg-surface hover:bg-surface-2"
                        }`}
                      >
                        {isAdded ? <Check size={12} /> : <Plus size={12} />}
                        {t}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
