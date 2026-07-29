"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, TriangleAlert, ArrowRight, Plus, Check } from "lucide-react";
import { generateRoadmapAction, adoptRoadmapAction } from "@/app/_actions/ai";
import { adoptCertificationAction } from "@/app/_actions/certifications";
import type { Roadmap } from "@/domain/ai/roadmap";
import { Skeleton, SkeletonBlock } from "./Skeleton";

export function RoadmapMentor() {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [context, setContext] = useState("");
  const [data, setData] = useState<Roadmap | null>(null);
  const [mocked, setMocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adopting, startAdopting] = useTransition();
  const [addedCerts, setAddedCerts] = useState<Set<string>>(new Set());
  const [addingCert, startAddCert] = useTransition();

  function addCert(name: string) {
    startAddCert(async () => {
      const res = await adoptCertificationAction(name);
      if (res.ok) setAddedCerts((prev) => new Set(prev).add(name));
    });
  }

  function generate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await generateRoadmapAction(target, context);
      if (res.ok) {
        setData(res.data);
        setMocked(res.mocked);
      } else {
        setError(res.error);
        setData(null);
      }
    });
  }

  function adopt() {
    if (!data) return;
    setError(null);
    // Carrega o nome da fase junto: antes o flatMap descartava o agrupamento
    // que o roadmap tinha acabado de propor.
    const topics = data.phases.flatMap((p) =>
      p.topics.map((title) => ({ title, phase: p.name })),
    );
    startAdopting(async () => {
      const res = await adoptRoadmapAction({
        title: data.goalTitle,
        summary: data.summary,
        months: data.estimatedMonths,
        topics,
      });
      if (res.ok) router.push(`/goals/${res.goalId}`);
      else setError(res.error);
    });
  }

  return (
    <div>
      <form onSubmit={generate} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">O que você quer se tornar?</span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Ex: Arquiteto de Soluções Cloud, Engenheiro de Dados…"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Contexto (opcional)</span>
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Ex: já sei Python, tenho 8h/semana, prazo de 6 meses"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !target.trim()}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles size={16} /> {pending ? "Gerando roadmap…" : "Gerar roadmap"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {pending && (
        <SkeletonBlock label="Gerando roadmap…" className="mt-8 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5" style={{ width: "45%" }} />
            <Skeleton className="h-3.5" />
            <Skeleton className="h-3.5" style={{ width: "70%" }} />
          </div>
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </SkeletonBlock>
      )}

      {data && !pending && (
        <div className="mt-8 flex flex-col gap-5">
          {mocked && (
            <p className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
              <TriangleAlert size={13} /> Demonstração (mock) — defina ANTHROPIC_API_KEY para
              roadmap real.
            </p>
          )}

          <div>
            <h2 className="text-lg font-medium">{data.goalTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{data.summary}</p>
            <p className="mt-1 text-xs text-faint">
              Tempo estimado: {data.estimatedMonths} {data.estimatedMonths === 1 ? "mês" : "meses"}
            </p>
          </div>

          <ol className="flex flex-col gap-3">
            {data.phases.map((p, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface px-5 py-4">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-certificacao-soft text-[11px] font-medium text-certificacao">
                    {i + 1}
                  </span>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted">· {p.focus}</span>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {p.topics.map((t) => (
                    <li key={t} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">
                      {t}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          {data.certifications.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">
                Certificações recomendadas
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {data.certifications.map((c) => {
                  const added = addedCerts.has(c);
                  return (
                    <li key={c}>
                      <button
                        onClick={() => addCert(c)}
                        disabled={added || addingCert}
                        title={added ? "Adicionada às suas certificações" : "Adicionar às minhas certificações"}
                        className={`press inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-70 ${
                          added
                            ? "bg-faculdade-soft text-faculdade"
                            : "bg-profissional-soft text-profissional hover:opacity-80"
                        }`}
                      >
                        {added ? <Check size={12} /> : <Plus size={12} />} {c}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <button
            onClick={adopt}
            disabled={adopting}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {adopting ? "Criando…" : "Criar objetivo com este roadmap"}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
