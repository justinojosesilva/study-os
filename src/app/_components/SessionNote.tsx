"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LessonContent } from "./LessonContent";

/**
 * A session note as it appears in the agenda and the calendar dialog.
 *
 * These notes are written in markdown — glossary tables, headings, code — and
 * used to be rendered as one muted paragraph, which flattened the tables and
 * swallowed the blank lines. They are also long (most run past 2.000
 * characters, one reaches 7.898), so rendering all of it inline would bury the
 * rest of the day.
 *
 * Collapsed by default with a real character count instead of a fading edge:
 * the count says how much is hidden, which a gradient never does — and it
 * needs no assumption about the background colour behind it.
 */
export function SessionNote({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const text = content.trim();
  // Short notes have nothing to hide — three of them are a single line.
  const long = text.length > 320;

  if (!long) {
    return (
      <div className="mt-1.5 border-l-2 border-line pl-2.5">
        <LessonContent content={text} compact />
      </div>
    );
  }

  return (
    <div className="mt-1.5 border-l-2 border-line pl-2.5">
      {/* `overflow-clip` e não `overflow-hidden`: hidden cria um contêiner de
          rolagem, então um scrollIntoView (ou o foco chegando por teclado num
          link escondido) desloca o trecho visível e não há como voltar. clip
          não rola. */}
      <div className={open ? undefined : "max-h-36 overflow-clip"}>
        <LessonContent content={text} compact />
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
      >
        {open ? (
          <>
            <ChevronUp size={13} /> Recolher
          </>
        ) : (
          <>
            <ChevronDown size={13} /> Ver anotação completa (
            {text.length.toLocaleString("pt-BR")} caracteres)
          </>
        )}
      </button>
    </div>
  );
}
