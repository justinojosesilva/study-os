"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotebookPen, X, Plus, ExternalLink } from "lucide-react";
import { createNoteAction } from "@/app/_actions/notes";
import { formatDayMonth } from "@/lib/date";
import { EmptyState } from "./EmptyState";
import type { NoteListItem } from "@/domain/notes/repository";
import { useAutoOpen, type OnDemandProps } from "./onDemandDialog";

/**
 * The topic's notes, reachable from its card — the answer to "where do I find
 * what I wrote about this?", which used to be nowhere: a note was visible only
 * inside the calendar dialog of the day it was written on.
 */
export function NotesDialog({
  topicId,
  topicTitle,
  goalId,
  notes,
  autoOpen,
  hideTrigger,
  onDismiss,
  onRequestOpen,
}: {
  topicId: string;
  topicTitle: string;
  goalId: string;
  notes: NoteListItem[];
} & OnDemandProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useAutoOpen(dialogRef, autoOpen);
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("topicId", topicId);
    fd.set("goalId", goalId);
    fd.set("content", content);
    startTransition(async () => {
      const res = await createNoteAction(fd);
      if (res.ok && res.id) {
        setContent("");
        dialogRef.current?.close();
        // Straight into the editor: a note written from here is usually the
        // start of a document, not a one-liner to file and forget.
        router.push(`/notes/${res.id}`);
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  const trigger = (
    <button
      type="button"
      onClick={() => (onRequestOpen ? onRequestOpen() : dialogRef.current?.showModal())}
      aria-label={`${topicTitle}: ${notes.length} ${notes.length === 1 ? "anotação" : "anotações"}`}
      className="tip inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <NotebookPen size={14} />
      {notes.length}
    </button>
  );

  if (onRequestOpen) return trigger;

  return (
    <>
      {!hideTrigger && trigger}

      <dialog
        ref={dialogRef}
        onClose={onDismiss}
        aria-label={`Anotações de ${topicTitle}`}
        className="m-auto max-h-[92vh] w-[min(92vw,560px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <div className="flex max-h-[92vh] flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
            <span className="font-medium">
              Anotações · <span className="text-muted">{topicTitle}</span>
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

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {notes.length === 0 ? (
              <EmptyState
                bordered={false}
                icon={NotebookPen}
                title="Nenhuma anotação ainda"
                hint="O que você escrever ao registrar uma sessão aparece aqui — ou comece uma abaixo."
              />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {notes.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/notes/${n.id}`}
                      className="press flex flex-col gap-1 rounded-lg border border-line px-3 py-2 hover:bg-surface-2"
                    >
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {n.title}
                        </span>
                        <ExternalLink size={12} className="shrink-0 text-faint" />
                      </span>
                      <span className="flex items-center gap-2 text-[11px] text-faint tabular-nums">
                        {formatDayMonth(n.createdAt)}
                        <span>·</span>
                        {n.length.toLocaleString("pt-BR")} caracteres
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={add} className="flex shrink-0 flex-col gap-2 border-t border-line px-5 py-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Escreva uma anotação… (markdown funciona)"
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={pending || !content.trim()}
              className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
            >
              <Plus size={16} /> {pending ? "Criando…" : "Nova anotação"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
