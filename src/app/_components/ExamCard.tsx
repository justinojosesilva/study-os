"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { generateExamAction } from "@/app/_actions/exams";

type Attempt = {
  id: string;
  scorePct: number | null;
  createdAt: Date;
  completedAt: Date | null;
};

export function ExamCard({
  goalId,
  progressPct,
  attempts,
}: {
  goalId: string;
  progressPct: number;
  attempts: Attempt[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateExamAction(goalId);
      if (res.ok) router.push(`/exams/${res.examId}`);
      else setError(res.error);
    });
  }

  const last = attempts[0];
  const previous = attempts[1];
  const delta =
    last?.scorePct != null && previous?.scorePct != null
      ? last.scorePct - previous.scorePct
      : null;

  return (
    <section className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium">
            <GraduationCap size={17} className="text-profissional" />
            Prova do objetivo
          </h2>
          <p className="mt-1 text-sm text-muted">
            {progressPct >= 100
              ? "Objetivo completo — hora de verificar o que ficou de verdade."
              : "Teste o que absorveu. Errar um tópico o devolve para revisão e vira flashcard."}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={pending}
          className="press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          <Sparkles size={15} /> {pending ? "Gerando…" : "Gerar prova"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {attempts.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 flex items-center gap-2 text-xs text-muted">
            <span>Tentativas</span>
            {delta !== null && delta !== 0 && (
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  delta > 0 ? "text-emerald-500" : "text-amber-500"
                }`}
              >
                {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {delta > 0 ? "+" : ""}
                {delta} pts
              </span>
            )}
          </p>
          <ul className="flex flex-col gap-1.5">
            {attempts.slice(0, 5).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/exams/${a.id}`}
                  className="press flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <span className="text-muted tabular-nums">
                    {a.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                  <span className="font-medium tabular-nums">{a.scorePct}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
