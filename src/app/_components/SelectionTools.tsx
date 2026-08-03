"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, Sparkles, Layers, X, Check, Plus } from "lucide-react";
import { createAnchoredNoteAction } from "@/app/_actions/notes";
import { askTutorAction } from "@/app/_actions/ai";
import { generateFlashcardsAction } from "@/app/_actions/ai";
import { createFlashcardAction } from "@/app/_actions/flashcards";
import { SkeletonText } from "./Skeleton";

/**
 * What you can do with a passage you just selected: annotate it, ask the tutor
 * about it, or turn it into flashcards.
 *
 * The anchor is the nearest heading BEFORE the selection, by id, plus the quote
 * itself — never a character offset. Editing a paragraph shifts every offset
 * after it; a heading survives anything short of renaming the section, and if
 * it is renamed the note still carries its quote and simply floats free.
 */

/** Long enough to identify the passage, short enough to store and display. */
const MAX_QUOTE = 1200;

type Picked = { text: string; anchorSlug: string | null; x: number; y: number };

function nearestHeading(node: Node | null): string | null {
  let el = node instanceof Element ? node : node?.parentElement ?? null;
  while (el) {
    // Walk backwards through previous siblings, then up, until a heading with
    // an id turns up — that is the section the passage lives in.
    let sib: Element | null = el;
    while (sib) {
      if (/^H[1-6]$/.test(sib.tagName) && sib.id) return sib.id;
      const found = sib.querySelector?.("h1[id], h2[id], h3[id], h4[id]");
      if (found && sib !== el) return found.id;
      sib = sib.previousElementSibling;
    }
    el = el.parentElement;
  }
  return null;
}

export function SelectionTools({
  lessonId,
  topicId,
  goalId,
  containerRef,
}: {
  lessonId: string;
  topicId: string;
  goalId: string;
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [mode, setMode] = useState<null | "note" | "tutor" | "cards">(null);
  const barRef = useRef<HTMLDivElement>(null);

  const clear = useCallback(() => {
    setPicked(null);
    setMode(null);
  }, []);

  useEffect(() => {
    function onUp(e: MouseEvent) {
      // A click inside the bar is using it, not making a new selection.
      if (barRef.current?.contains(e.target as Node)) return;

      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || sel.isCollapsed || text.length < 3) {
        setPicked((prev) => (prev && mode ? prev : null));
        return;
      }
      const range = sel.getRangeAt(0);
      const host = containerRef.current;
      if (!host || !host.contains(range.commonAncestorContainer)) return;

      // Coordinates RELATIVE TO THE CONTAINER, which is the positioned
      // ancestor. Page coordinates put the bar below the passage instead of
      // above it, off by exactly the container's offset from the document.
      const rect = range.getBoundingClientRect();
      const host_ = host.getBoundingClientRect();
      setPicked({
        text: text.slice(0, MAX_QUOTE),
        anchorSlug: nearestHeading(range.startContainer),
        x: rect.left + rect.width / 2 - host_.left,
        y: rect.top - host_.top,
      });
    }
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [containerRef, mode]);

  if (!picked) return null;

  return (
    <>
      {!mode && (
        <div
          ref={barRef}
          // Container coordinates, so the bar stays glued to the passage while
          // the reader scrolls instead of floating over the viewport.
          style={{ left: picked.x, top: picked.y - 8 }}
          className="absolute z-40 -translate-x-1/2 -translate-y-full"
        >
          <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-lg">
            <Tool icon={NotebookPen} label="Anotar" onClick={() => setMode("note")} />
            <Tool icon={Sparkles} label="Perguntar ao tutor" onClick={() => setMode("tutor")} />
            <Tool icon={Layers} label="Gerar flashcards" onClick={() => setMode("cards")} />
          </div>
        </div>
      )}

      {mode === "note" && (
        <NoteComposer
          quote={picked.text}
          onCancel={clear}
          onSave={async (comment) => {
            const res = await createAnchoredNoteAction({
              lessonId,
              topicId,
              anchorSlug: picked.anchorSlug,
              quote: picked.text,
              comment,
            });
            if (res.ok) {
              clear();
              router.refresh();
            }
            return res;
          }}
        />
      )}

      {mode === "tutor" && (
        <TutorOnPassage topicId={topicId} quote={picked.text} onClose={clear} />
      )}

      {mode === "cards" && (
        <CardsFromPassage
          topicId={topicId}
          goalId={goalId}
          quote={picked.text}
          onClose={clear}
        />
      )}
    </>
  );
}

function Tool({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof NotebookPen;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="tip inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto max-h-[90vh] w-[min(92vw,560px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="flex max-h-[90vh] flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <span className="font-medium">{title}</span>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fechar"
            className="text-faint hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <blockquote className="mb-3 max-h-32 overflow-y-auto border-l-2 border-profissional/50 pl-3 text-sm italic text-muted">
      {text}
    </blockquote>
  );
}

function NoteComposer({
  quote,
  onCancel,
  onSave,
}: {
  quote: string;
  onCancel: () => void;
  onSave: (comment: string) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <Shell title="Anotar trecho" onClose={onCancel}>
      <Quote text={quote} />
      <textarea
        autoFocus
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={5}
        placeholder="O que você quer registrar sobre este trecho? (opcional)"
        className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          const res = await onSave(comment);
          if (!res.ok) setError(res.error);
          setSaving(false);
        }}
        className="press mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
      >
        <NotebookPen size={15} /> {saving ? "Salvando…" : "Salvar anotação"}
      </button>
    </Shell>
  );
}

function TutorOnPassage({
  topicId,
  quote,
  onClose,
}: {
  topicId: string;
  quote: string;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function ask() {
    setPending(true);
    setError(null);
    // The passage travels with the question so the tutor answers about THIS
    // paragraph, not about the topic in general.
    const framed = `Sobre este trecho da aula:\n\n"${quote}"\n\n${
      question.trim() || "Explique este trecho."
    }`;
    const res = await askTutorAction(topicId, "explain", framed);
    if (res.ok) setAnswer(res.text);
    else setError(res.error);
    setPending(false);
  }

  return (
    <Shell title="Perguntar ao tutor" onClose={onClose}>
      <Quote text={quote} />
      {answer === null ? (
        <>
          <input
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !pending && ask()}
            placeholder="Sua dúvida (em branco = explique este trecho)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          {pending && (
            <div className="mt-3">
              <SkeletonText lines={4} />
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {!pending && (
            <button
              type="button"
              onClick={ask}
              className="press mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas"
            >
              <Sparkles size={15} /> Perguntar
            </button>
          )}
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>
      )}
    </Shell>
  );
}

function CardsFromPassage({
  topicId,
  goalId,
  quote,
  onClose,
}: {
  topicId: string;
  goalId: string;
  quote: string;
  onClose: () => void;
}) {
  const [cards, setCards] = useState<{ front: string; back: string }[] | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    (async () => {
      // strict: the passage is the subject, not a hint about the topic.
      const res = await generateFlashcardsAction(topicId, quote, true);
      if (res.ok) setCards(res.data);
      else setError(res.error);
      setPending(false);
    })();
  }, [topicId, quote]);

  async function add(i: number) {
    const c = cards![i];
    const fd = new FormData();
    fd.set("topicId", topicId);
    fd.set("goalId", goalId);
    fd.set("front", c.front);
    fd.set("back", c.back);
    const res = await createFlashcardAction(fd);
    if (res.ok) setAdded((prev) => new Set(prev).add(i));
    else setError(res.error);
  }

  return (
    <Shell title="Flashcards do trecho" onClose={onClose}>
      <Quote text={quote} />
      {pending && <SkeletonText lines={3} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {cards && (
        <ul className="flex flex-col gap-1.5">
          {cards.map((c, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-line px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{c.front}</span>
                <span className="block text-xs text-muted">{c.back}</span>
              </span>
              <button
                type="button"
                onClick={() => add(i)}
                disabled={added.has(i)}
                aria-label={`Adicionar: ${c.front}`}
                className={`tip shrink-0 rounded-md p-1 ${
                  added.has(i) ? "text-emerald-500" : "text-faint hover:text-ink"
                }`}
              >
                {added.has(i) ? <Check size={15} /> : <Plus size={15} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
