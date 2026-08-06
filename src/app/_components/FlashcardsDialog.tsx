"use client";

import { useRef, useState, useTransition } from "react";
import { Layers, X, Plus, Trash2, Pencil, Check, Sparkles } from "lucide-react";
import {
  createFlashcardAction,
  updateFlashcardAction,
  deleteFlashcardAction,
} from "@/app/_actions/flashcards";
import { generateFlashcardsAction } from "@/app/_actions/ai";
import type { GeneratedCard } from "@/domain/ai/flashcardGen";
import { Skeleton, SkeletonBlock } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { useAutoOpen, type OnDemandProps } from "./onDemandDialog";

type Card = { id: string; front: string; back: string };

type Props = {
  topicId: string;
  topicTitle: string;
  goalId: string;
  cards: Card[];
} & OnDemandProps;

export function FlashcardsDialog({
  topicId,
  topicTitle,
  goalId,
  cards,
  autoOpen,
  hideTrigger,
  onDismiss,
  onRequestOpen,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useAutoOpen(dialogRef, autoOpen);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createFlashcardAction(fd);
      if (res.ok) formRef.current?.reset();
      else setError(res.error);
    });
  }

  const trigger = (
    <button
      type="button"
      onClick={() => (onRequestOpen ? onRequestOpen() : dialogRef.current?.showModal())}
      aria-label={`Flashcards de ${topicTitle}: ${cards.length}`}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Layers size={14} /> {cards.length}
    </button>
  );

  if (onRequestOpen) return trigger;

  return (
    <>
      {!hideTrigger && trigger}

      <dialog
        ref={dialogRef}
        onClose={onDismiss}
        aria-label={`Flashcards de ${topicTitle}`}
        className="m-auto w-[min(92vw,520px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-medium">
            Flashcards · <span className="text-muted">{topicTitle}</span>
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

        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          {cards.length === 0 ? (
            <EmptyState
              bordered={false}
              icon={Layers}
              title="Nenhum card ainda"
              hint="Crie pares pergunta/resposta abaixo, ou gere com IA."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {cards.map((c) => (
                <CardItem key={c.id} card={c} goalId={goalId} />
              ))}
            </ul>
          )}
        </div>

        <AiGenerator topicId={topicId} goalId={goalId} />

        <form
          ref={formRef}
          onSubmit={add}
          className="flex flex-col gap-2 border-t border-line px-5 py-4"
        >
          <input type="hidden" name="topicId" value={topicId} />
          <input
            name="front"
            placeholder="Frente (pergunta)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          <textarea
            name="back"
            rows={2}
            placeholder="Verso (resposta)"
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            <Plus size={16} /> {pending ? "…" : "Adicionar card"}
          </button>
        </form>
      </dialog>
    </>
  );
}

function CardItem({ card, goalId }: { card: Card; goalId: string }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const front = String(fd.get("front") ?? "");
    const back = String(fd.get("back") ?? "");
    startTransition(async () => {
      const res = await updateFlashcardAction(card.id, goalId, front, back);
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteFlashcardAction(card.id, goalId);
      if (!res.ok) setError(res.error);
    });
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-line px-3 py-2.5">
        <form onSubmit={save} className="flex flex-col gap-2">
          <input
            name="front"
            defaultValue={card.front}
            className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
          <textarea
            name="back"
            rows={2}
            defaultValue={card.back}
            className="w-full resize-none rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-2.5 py-1 text-xs text-muted hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-canvas disabled:opacity-50"
            >
              <Check size={13} /> Salvar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{card.front}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{card.back}</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          aria-label="Editar card"
          className="text-faint transition-colors hover:text-ink"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={remove}
          disabled={pending}
          aria-label="Remover card"
          className="tip text-faint transition-colors hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

function AiGenerator({ topicId, goalId }: { topicId: string; goalId: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [cards, setCards] = useState<GeneratedCard[] | null>(null);
  const [mocked, setMocked] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [genPending, startGen] = useTransition();
  const [addPending, startAdd] = useTransition();

  function generate() {
    setError(null);
    setCards(null);
    setAdded(new Set());
    startGen(async () => {
      const res = await generateFlashcardsAction(topicId, content);
      if (res.ok) {
        setCards(res.data);
        setMocked(res.mocked);
      } else {
        setError(res.error);
      }
    });
  }

  function persist(card: GeneratedCard): Promise<boolean> {
    const fd = new FormData();
    fd.set("topicId", topicId);
    fd.set("front", card.front);
    fd.set("back", card.back);
    return createFlashcardAction(fd).then((r) => r.ok);
  }

  function addOne(index: number) {
    if (!cards) return;
    startAdd(async () => {
      const ok = await persist(cards[index]);
      if (ok) setAdded((prev) => new Set(prev).add(index));
    });
  }

  function addAll() {
    if (!cards) return;
    startAdd(async () => {
      const next = new Set(added);
      for (let i = 0; i < cards.length; i++) {
        if (next.has(i)) continue;
        if (await persist(cards[i])) next.add(i);
      }
      setAdded(next);
    });
  }

  if (!open) {
    return (
      <div className="border-t border-line px-5 py-3">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-certificacao hover:opacity-80"
        >
          <Sparkles size={15} /> Gerar com IA
        </button>
      </div>
    );
  }

  const allAdded = cards ? added.size === cards.length : false;

  return (
    <div className="border-t border-line px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={15} className="text-certificacao" />
        <span className="text-sm font-medium">Gerar com IA</span>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="Cole conteúdo/anotações (opcional). Vazio = a IA usa o tópico."
        className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <button
        onClick={generate}
        disabled={genPending}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-50"
      >
        <Sparkles size={14} /> {genPending ? "Gerando…" : cards ? "Gerar de novo" : "Gerar"}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {genPending && (
        <SkeletonBlock label="Gerando flashcards…" className="mt-3 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </SkeletonBlock>
      )}

      {cards && !genPending && (
        <div className="mt-3 flex flex-col gap-2">
          {mocked && (
            <p className="text-xs text-muted">
              Demonstração (mock) — defina ANTHROPIC_API_KEY para geração real.
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{cards.length} sugeridos</span>
            <button
              onClick={addAll}
              disabled={addPending || allAdded}
              className="rounded-md border border-line px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {allAdded ? "Todos adicionados" : "Adicionar todos"}
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {cards.map((c, i) => {
              const isAdded = added.has(i);
              return (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-line px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.front}</p>
                    <p className="mt-0.5 text-sm text-muted">{c.back}</p>
                  </div>
                  <button
                    onClick={() => addOne(i)}
                    disabled={isAdded || addPending}
                    aria-label="Adicionar card"
                    className={`shrink-0 rounded-md p-1 transition-colors disabled:opacity-70 ${
                      isAdded ? "text-faculdade" : "text-faint hover:text-ink"
                    }`}
                  >
                    {isAdded ? <Check size={16} /> : <Plus size={16} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
