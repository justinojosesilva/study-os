"use client";

import { useState, useTransition } from "react";
import { Layers, Plus, Check, Sparkles } from "lucide-react";
import { generateFlashcardsAction } from "@/app/_actions/ai";
import { createFlashcardAction } from "@/app/_actions/flashcards";
import { SkeletonText } from "./Skeleton";

type Card = { front: string; back: string };

/**
 * Turns one note into flashcards.
 *
 * The generator already accepted pasted text; a note is the best possible
 * input for it, because it is the student's own distillation of the topic
 * rather than raw source material. Cards are reviewed before being kept — the
 * model gets it wrong sometimes, and a bad card costs weeks of FSRS repetition.
 */
export function NoteFlashcards({
  topicId,
  goalId,
  content,
}: {
  topicId: string;
  goalId: string;
  content: string;
}) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startGen] = useTransition();
  const [saving, startSave] = useTransition();

  function generate() {
    setError(null);
    setAdded(new Set());
    startGen(async () => {
      // strict: the note is the subject, not a hint about the topic.
      const res = await generateFlashcardsAction(topicId, content, true);
      if (res.ok) setCards(res.data);
      else setError(res.error);
    });
  }

  function add(card: Card, i: number) {
    setError(null);
    const fd = new FormData();
    fd.set("topicId", topicId);
    fd.set("goalId", goalId);
    fd.set("front", card.front);
    fd.set("back", card.back);
    startSave(async () => {
      const res = await createFlashcardAction(fd);
      if (res.ok) setAdded((prev) => new Set(prev).add(i));
      else setError(res.error);
    });
  }

  function addAll() {
    setError(null);
    startSave(async () => {
      for (let i = 0; i < (cards?.length ?? 0); i++) {
        if (added.has(i)) continue;
        const fd = new FormData();
        fd.set("topicId", topicId);
        fd.set("goalId", goalId);
        fd.set("front", cards![i].front);
        fd.set("back", cards![i].back);
        const res = await createFlashcardAction(fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setAdded((prev) => new Set(prev).add(i));
      }
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Layers size={16} className="text-faculdade" />
          Flashcards desta anotação
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          <Sparkles size={14} />
          {pending ? "Gerando…" : cards ? "Gerar de novo" : "Gerar com IA"}
        </button>
      </div>

      {!cards && !pending && (
        <p className="mt-2 text-xs text-faint">
          Transforma o que você escreveu em cartões de revisão espaçada, sem sair daqui.
        </p>
      )}

      {pending && (
        <div className="mt-3">
          <SkeletonText lines={3} />
        </div>
      )}

      {cards && !pending && (
        <>
          <ul className="mt-3 flex flex-col gap-1.5">
            {cards.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-line px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c.front}</span>
                  <span className="block text-xs text-muted">{c.back}</span>
                </span>
                <button
                  type="button"
                  onClick={() => add(c, i)}
                  disabled={saving || added.has(i)}
                  aria-label={`Adicionar cartão: ${c.front}`}
                  className={`tip shrink-0 rounded-md p-1 transition-colors ${
                    added.has(i)
                      ? "text-emerald-500"
                      : "text-faint hover:text-ink disabled:opacity-50"
                  }`}
                >
                  {added.has(i) ? <Check size={15} /> : <Plus size={15} />}
                </button>
              </li>
            ))}
          </ul>
          {added.size < cards.length && (
            <button
              type="button"
              onClick={addAll}
              disabled={saving}
              className="press mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-50"
            >
              <Plus size={14} /> {saving ? "Adicionando…" : "Adicionar todos"}
            </button>
          )}
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
