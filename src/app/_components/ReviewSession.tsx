"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ArrowLeft, CalendarCheck } from "lucide-react";
import { recordReviewAction } from "@/app/_actions/reviews";

type QueueItem = {
  flashcardId: string;
  front: string;
  back: string;
  topicTitle: string;
  goalTitle: string;
};

const RATINGS = [
  { value: 1, label: "Esqueci", cls: "border-line text-red-600 hover:bg-red-600/10" },
  { value: 2, label: "Difícil", cls: "border-line text-warning hover:bg-warning/10" },
  { value: 3, label: "Bom", cls: "border-line text-faculdade hover:bg-faculdade-soft" },
  { value: 4, label: "Fácil", cls: "border-line text-profissional hover:bg-profissional-soft" },
] as const;

export function ReviewSession({ queue }: { queue: QueueItem[] }) {
  // Freeze the queue at mount. Every Server Action auto-refreshes this route,
  // which would otherwise feed a shrinking queue back as props (skipping items,
  // and unmounting this component on the last card).
  const [items] = useState(queue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = items.length;
  const current = items[index];

  function rate(rating: number) {
    if (!current) return;
    setError(null);
    const flashcardId = current.flashcardId;
    startTransition(async () => {
      const res = await recordReviewAction(flashcardId, rating);
      if (res.ok) {
        setRevealed(false);
        setIndex((i) => i + 1);
      } else {
        setError(res.error);
      }
    });
  }

  if (total === 0) {
    return (
      <Panel
        icon={<CalendarCheck size={24} />}
        title="Tudo em dia"
        body="Nenhum card para revisar agora. Crie flashcards nos tópicos de um objetivo para começar a revisão espaçada."
      />
    );
  }

  if (index >= total) {
    return (
      <Panel
        accent
        icon={<Check size={24} />}
        title="Revisão concluída"
        body={`Você revisou ${total} ${total === 1 ? "card" : "cards"}. Volte amanhã para os próximos.`}
        action
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>
          {index + 1} de {total}
        </span>
        <span>{Math.round((index / total) * 100)}%</span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-faculdade transition-all"
          style={{ width: `${(index / total) * 100}%` }}
        />
      </div>

      <div className="rounded-xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-wide text-faint">
          {current.goalTitle} · {current.topicTitle}
        </p>
        <p className="mt-3 text-xl font-medium">{current.front}</p>

        {revealed && (
          <div className="mt-5 border-t border-line pt-5 text-left">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{current.back}</p>
          </div>
        )}
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="mt-5 w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
        >
          Mostrar resposta
        </button>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => rate(r.value)}
              disabled={pending}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${r.cls}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Panel({
  icon,
  title,
  body,
  accent,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent?: boolean;
  action?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <span
        className={`mx-auto mb-3 flex size-12 items-center justify-center rounded-full ${
          accent ? "bg-faculdade-soft text-faculdade" : "bg-surface-2 text-muted"
        }`}
      >
        {icon}
      </span>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {action && (
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm transition-colors hover:bg-surface-2"
        >
          <ArrowLeft size={16} /> Voltar ao dashboard
        </Link>
      )}
    </div>
  );
}
