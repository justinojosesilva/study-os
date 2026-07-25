"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, X, Plus, Trash2, Upload, ExternalLink } from "lucide-react";
import { createLessonAction, deleteLessonAction } from "@/app/_actions/lessons";
import { EmptyState } from "./EmptyState";

type LessonLite = { id: string; title: string };

export function LessonsDialog({
  topicId,
  topicTitle,
  goalId,
  lessons,
}: {
  topicId: string;
  topicTitle: string;
  goalId: string;
  lessons: LessonLite[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    if (!title.trim()) setTitle(file.name.replace(/\.mdx?$/i, ""));
  }

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("topicId", topicId);
    fd.set("goalId", goalId);
    fd.set("title", title);
    fd.set("content", content);
    startTransition(async () => {
      const res = await createLessonAction(fd);
      if (res.ok) {
        setTitle("");
        setContent("");
      } else {
        setError(res.error);
      }
    });
  }

  function remove(id: string) {
    setError(null);
    startDelete(async () => {
      const res = await deleteLessonAction(id, goalId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`Aulas de ${topicTitle}: ${lessons.length}`}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <BookOpen size={14} /> {lessons.length}
      </button>

      <dialog
        ref={dialogRef}
        aria-label={`Aulas de ${topicTitle}`}
        className="m-auto w-[min(92vw,560px)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-medium">
            Aulas · <span className="text-muted">{topicTitle}</span>
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

        <div className="max-h-[46vh] overflow-y-auto px-5 py-4">
          {lessons.length === 0 ? (
            <EmptyState
              bordered={false}
              icon={BookOpen}
              title="Nenhuma aula ainda"
              hint="Cole o markdown de uma aula (ou envie um .md) abaixo para lê-la aqui dentro."
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {lessons.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <Link
                    href={`/lessons/${l.id}`}
                    className="press flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2"
                  >
                    <BookOpen size={14} className="shrink-0 text-faint" />
                    <span className="truncate font-medium">{l.title}</span>
                    <ExternalLink size={12} className="ml-auto shrink-0 text-faint" />
                  </Link>
                  <button
                    onClick={() => remove(l.id)}
                    disabled={deleting}
                    aria-label={`Remover ${l.title}`}
                    className="shrink-0 text-faint transition-colors hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={add} className="flex flex-col gap-2 border-t border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da aula"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
            <label className="press inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2">
              <Upload size={14} /> .md
              <input type="file" accept=".md,.mdx,text/markdown" onChange={onFile} className="hidden" />
            </label>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Cole o conteúdo markdown da aula aqui…"
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            <Plus size={16} /> {pending ? "Salvando…" : "Adicionar aula"}
          </button>
        </form>
      </dialog>
    </>
  );
}
