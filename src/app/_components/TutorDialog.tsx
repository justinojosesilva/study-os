"use client";

import { useRef, useState, useTransition } from "react";
import { Lightbulb, X, Send } from "lucide-react";
import { askTutorAction } from "@/app/_actions/ai";
import { SaveTutorNote } from "./SaveTutorNote";
import type { TutorMode } from "@/domain/ai/tutor";
import { SkeletonBlock, SkeletonText } from "./Skeleton";
import { useAutoOpen, type OnDemandProps } from "./onDemandDialog";

const MODES: { key: TutorMode; label: string }[] = [
  { key: "explain", label: "Explicar" },
  { key: "exercises", label: "Exercícios" },
  { key: "summary", label: "Resumo" },
];

export function TutorDialog({
  topicId,
  topicTitle,
  autoOpen,
  hideTrigger,
  onDismiss,
  onRequestOpen,
}: {
  topicId: string;
  topicTitle: string;
} & OnDemandProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useAutoOpen(dialogRef, autoOpen);
  const [question, setQuestion] = useState("");
  const [text, setText] = useState<string | null>(null);
  // O que produziu a resposta na tela. A caixa de pergunta continua editável
  // depois de responder, então lê-la na hora de salvar gravaria outra coisa.
  const [answered, setAnswered] = useState<{ mode: TutorMode; question: string | null } | null>(null);
  const [mocked, setMocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask(mode: TutorMode, q?: string) {
    setError(null);
    setText(null);
    setAnswered(null);
    startTransition(async () => {
      const res = await askTutorAction(topicId, mode, q);
      if (res.ok) {
        setText(res.text);
        setAnswered({ mode, question: q?.trim() || null });
        setMocked(res.mocked);
      } else {
        setError(res.error);
      }
    });
  }

  const trigger = (
    <button
      type="button"
      onClick={() => (onRequestOpen ? onRequestOpen() : dialogRef.current?.showModal())}
      aria-label="Tutor"
      className="text-faint transition-colors hover:text-ink"
    >
      <Lightbulb size={16} />
    </button>
  );

  if (onRequestOpen) return trigger;

  return (
    <>
      {!hideTrigger && trigger}

      <dialog
        ref={dialogRef}
        onClose={onDismiss}
        aria-label={`Tutor: ${topicTitle}`}
        className="m-auto w-[min(92vw,560px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="flex items-center gap-2 font-medium">
            <Lightbulb size={17} className="text-certificacao" />
            Tutor · <span className="text-muted">{topicTitle}</span>
          </span>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar"
            className="text-faint hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => ask(m.key)}
                disabled={pending}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {m.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim()) ask("explain", question);
            }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pergunte algo sobre este tópico…"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending || !question.trim()}
              aria-label="Perguntar"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-canvas disabled:opacity-50"
            >
              <Send size={15} />
            </button>
          </form>

          <div className="mt-4 max-h-[46vh] overflow-y-auto">
            {pending && (
              <SkeletonBlock label="O tutor está pensando…">
                <SkeletonText lines={4} />
              </SkeletonBlock>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {text && !pending && (
              <div>
                {mocked && (
                  <p className="mb-2 text-xs text-muted">
                    Demonstração (mock) — defina ANTHROPIC_API_KEY para respostas reais.
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
                {answered && (
                  <SaveTutorNote
                    topicId={topicId}
                    mode={answered.mode}
                    question={answered.question}
                    answer={text}
                  />
                )}
              </div>
            )}
            {!pending && !text && !error && (
              <p className="text-sm text-muted">
                Escolha uma ação acima ou faça uma pergunta para começar.
              </p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
