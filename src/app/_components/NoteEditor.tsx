"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Eye, Save, Trash2, X, ArrowRight } from "lucide-react";
import { updateNoteAction, deleteNoteAction } from "@/app/_actions/notes";
import { LessonContent } from "./LessonContent";

/**
 * Read-first, edit on demand.
 *
 * The note is read far more often than it is written, and the whole point of
 * this screen is that a synthesis finally renders as one — so the rendered
 * version is what opens, and the editor is one click away. That click is also
 * the feature that did not exist at all before: a saved note used to be frozen,
 * which is why the same synthesis appears twice in the history, retyped.
 */
export function NoteEditor({
  noteId,
  goalId,
  initialTitle,
  initialContent,
  initialNextStep,
}: {
  noteId: string;
  goalId: string;
  initialTitle: string;
  initialContent: string;
  initialNextStep: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [nextStep, setNextStep] = useState(initialNextStep ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [removing, startRemove] = useTransition();

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("content", content);
    fd.set("nextStep", nextStep);
    startSave(async () => {
      const res = await updateNoteAction(noteId, goalId, fd);
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  function cancel() {
    setTitle(initialTitle);
    setContent(initialContent);
    setNextStep(initialNextStep ?? "");
    setError(null);
    setEditing(false);
  }

  function remove() {
    if (!confirm("Remover esta anotação? Não dá para desfazer.")) return;
    setError(null);
    startRemove(async () => {
      const res = await deleteNoteAction(noteId, goalId);
      if (res.ok) router.push(goalId ? `/goals/${goalId}` : "/agenda");
      else setError(res.error);
    });
  }

  if (!editing) {
    return (
      <>
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
          >
            <Pencil size={14} /> Editar
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={removing}
            className="press inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-faint hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={14} /> Remover
          </button>
        </div>

        {initialNextStep && <NextStepCard text={initialNextStep} />}
        <LessonContent content={initialContent} />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="press inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-50"
        >
          <Save size={14} /> {saving ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2"
        >
          <X size={14} /> Cancelar
        </button>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-faint">
          <Eye size={13} /> pré-visualização ao lado
        </span>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título (em branco usa a primeira linha)"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium"
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Próximo passo</span>
        <input
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="Onde retomar na próxima sessão"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>

      {/* Lado a lado no monitor, empilhado no celular: escrever markdown sem
          ver o resultado é justamente o que tornava a anotação ruim de fazer. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck
          className="min-h-[60vh] w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs leading-relaxed"
        />
        <div className="min-h-[60vh] overflow-y-auto rounded-lg border border-line bg-surface px-4 py-3">
          <LessonContent content={content} compact />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function NextStepCard({ text }: { text: string }) {
  return (
    <p className="mb-5 flex items-start gap-2 rounded-lg border border-profissional/30 bg-profissional-soft px-3 py-2 text-sm">
      <ArrowRight size={15} className="mt-0.5 shrink-0 text-profissional" />
      <span>
        <span className="font-medium text-profissional">Próximo passo · </span>
        {text}
      </span>
    </p>
  );
}
