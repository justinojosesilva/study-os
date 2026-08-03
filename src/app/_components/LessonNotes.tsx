"use client";

import Link from "next/link";
import { NotebookPen, CornerDownRight } from "lucide-react";
import type { LessonNote } from "@/domain/notes/repository";
import { formatDayMonth } from "@/lib/date";

/**
 * The annotations written over this lesson, in reading order.
 *
 * Listed rather than drawn in the margin next to their passage: restoring an
 * exact text range means finding the quote again in ~85k characters of
 * markdown, and the moment a paragraph is edited that search starts landing on
 * the wrong occurrence. The anchor takes you to the section; the quote tells
 * you which passage it was.
 */
export function LessonNotes({
  notes,
  onJump,
}: {
  notes: LessonNote[];
  onJump: (slug: string) => void;
}) {
  if (notes.length === 0) return null;

  return (
    <section className="mt-10 rounded-xl border border-line bg-surface px-5 py-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <NotebookPen size={16} className="text-faculdade" />
        Suas anotações nesta aula
        <span className="text-xs font-normal text-faint">({notes.length})</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded-lg border border-line px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/notes/${n.id}`}
                className="min-w-0 flex-1 text-sm font-medium hover:underline"
              >
                {n.title}
              </Link>
              <span className="shrink-0 text-[11px] tabular-nums text-faint">
                {formatDayMonth(n.createdAt)}
              </span>
            </div>
            {n.quote && (
              <p className="mt-1 line-clamp-2 border-l-2 border-line pl-2 text-xs italic text-muted">
                {n.quote}
              </p>
            )}
            {n.anchorSlug && (
              <button
                type="button"
                onClick={() => onJump(n.anchorSlug!)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-profissional hover:underline"
              >
                <CornerDownRight size={12} /> Ir para o trecho
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
