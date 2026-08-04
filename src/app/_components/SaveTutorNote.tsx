"use client";

import { useState } from "react";
import Link from "next/link";
import { NotebookPen, Check, ExternalLink } from "lucide-react";
import { saveTutorNoteAction, type TutorContext } from "@/app/_actions/ai";
import type { TutorMode } from "@/domain/ai/tutor";

/**
 * Files a tutor answer as a note, on demand.
 *
 * Deliberate rather than automatic: the tutor gets asked casually, and saving
 * every passing question would bury the syntheses written on purpose. The
 * answer is already logged for the quiz either way — this is the copy that
 * shows up in the notes list, in the search, and can be edited.
 */
export function SaveTutorNote({
  topicId,
  mode,
  question,
  answer,
  context,
}: {
  topicId: string;
  mode: TutorMode;
  question: string | null;
  answer: string;
  context?: TutorContext;
}) {
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (saved) {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-emerald-500">
        <Check size={15} /> Salva nas anotações
        <Link
          href={`/notes/${saved}`}
          className="inline-flex items-center gap-1 font-medium text-profissional hover:underline"
        >
          abrir <ExternalLink size={12} />
        </Link>
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          const res = await saveTutorNoteAction({ topicId, mode, question, answer, context });
          if (res.ok) setSaved(res.id);
          else setError(res.error);
          setSaving(false);
        }}
        className="press mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
      >
        <NotebookPen size={14} /> {saving ? "Salvando…" : "Salvar como anotação"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  );
}
