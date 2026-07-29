"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, X, ArrowRight, RotateCcw, Layers, Trophy } from "lucide-react";
import { submitExamAction } from "@/app/_actions/exams";
import type { GradedResult } from "@/domain/exams/repository";

type Question = {
  id: string;
  topicTitle: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  chosenIndex: number | null;
  explanation: string;
};

export function ExamRunner({
  examId,
  goalId,
  questions,
  initialResult,
}: {
  examId: string;
  goalId: string;
  questions: Question[];
  initialResult: { scorePct: number } | null;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<GradedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // An already-submitted exam is read-only: show the stored answers as review.
  const submitted = initialResult !== null || result !== null;
  const answered = Object.keys(answers).length;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitExamAction(examId, goalId, answers);
      if (res.ok) setResult(res.result);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {result && <ResultPanel result={result} goalId={goalId} />}

      {questions.map((q, i) => {
        const chosen = submitted ? (q.chosenIndex ?? answers[q.id] ?? null) : (answers[q.id] ?? null);
        return (
          <section key={q.id} className="rounded-xl border border-line bg-surface px-5 py-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
              {i + 1}/{questions.length} · {q.topicTitle}
            </p>
            <p className="mb-3 font-medium">{q.prompt}</p>

            <ul className="flex flex-col gap-2">
              {q.options.map((opt, oi) => {
                const isChosen = chosen === oi;
                const isCorrect = oi === q.correctIndex;
                const showTruth = submitted && (isCorrect || isChosen);
                return (
                  <li key={oi}>
                    <button
                      type="button"
                      disabled={submitted || pending}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        showTruth && isCorrect
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : showTruth && isChosen
                            ? "border-red-500/50 bg-red-500/10"
                            : isChosen
                              ? "border-profissional bg-profissional-soft"
                              : "border-line hover:bg-surface-2"
                      } ${submitted ? "cursor-default" : ""}`}
                    >
                      <span className="min-w-0 flex-1">{opt}</span>
                      {showTruth && isCorrect && (
                        <Check size={16} className="shrink-0 text-emerald-500" />
                      )}
                      {showTruth && isChosen && !isCorrect && (
                        <X size={16} className="shrink-0 text-red-500" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {submitted && (
              <p className="mt-2.5 border-l-2 border-line pl-2.5 text-xs text-muted">
                {q.explanation}
              </p>
            )}
          </section>
        );
      })}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!submitted && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-3">
          <span className="text-sm text-muted tabular-nums">
            {answered} de {questions.length} respondidas
          </span>
          <button
            onClick={submit}
            disabled={pending || answered < questions.length}
            className="press inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            {pending ? "Corrigindo…" : "Entregar prova"} <ArrowRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result, goalId }: { result: GradedResult; goalId: string }) {
  const good = result.scorePct >= 70;
  return (
    <section
      className={`rounded-xl border px-5 py-4 ${
        good ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"
      }`}
    >
      <p className="text-2xl font-medium tabular-nums">
        {result.scorePct}%
        <span className="ml-2 text-sm font-normal text-muted">
          {result.correct} de {result.total} corretas
        </span>
      </p>

      {result.masteredTopics.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-muted">
          <Trophy size={14} className="mt-0.5 shrink-0 text-emerald-500" />
          <span>
            Agora <strong className="font-medium text-ink">dominado</strong>:{" "}
            {result.masteredTopics.join(", ")}
          </span>
        </p>
      )}

      {result.demotedTopics.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
          <RotateCcw size={14} className="mt-0.5 shrink-0" />
          <span>Voltaram um passo: {result.demotedTopics.join(", ")}</span>
        </p>
      )}

      {result.cardsCreated > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <Layers size={14} className="shrink-0" />
          {result.cardsCreated} {result.cardsCreated === 1 ? "flashcard criado" : "flashcards criados"} a
          partir dos erros.
        </p>
      )}

      {result.masteredTopics.length === 0 &&
        result.demotedTopics.length === 0 &&
        result.cardsCreated === 0 && (
          <p className="mt-2 text-sm text-muted">
            Nada mudou de status — nenhum tópico caiu, e os que acertou ainda não estavam em
            praticando.
          </p>
        )}

      <Link
        href={`/goals/${goalId}`}
        className="press mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2"
      >
        Voltar ao objetivo
      </Link>
    </section>
  );
}
