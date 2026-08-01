"use client";

import { useTransition } from "react";
import { Check, Circle } from "lucide-react";
import { setLessonCompletedAction } from "@/app/_actions/lessons";

/**
 * Sits at the end of the lesson, which is where finishing actually happens —
 * having to go back to the topic dialog to tick a box is the friction that sends
 * people to a paper checklist instead.
 */
export function LessonDoneButton({
  lessonId,
  goalId,
  completedAt,
}: {
  lessonId: string;
  goalId: string;
  completedAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const done = completedAt !== null;

  function toggle() {
    startTransition(async () => {
      await setLessonCompletedAction(lessonId, goalId, !done);
    });
  }

  return (
    <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={done}
        className={`press inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          done
            ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            : "bg-ink text-canvas"
        }`}
      >
        {done ? <Check size={16} /> : <Circle size={16} />}
        {pending ? "Salvando…" : done ? "Concluída" : "Marcar como concluída"}
      </button>

      {done && completedAt && (
        <span className="text-xs text-muted">
          em{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          }).format(completedAt)}
        </span>
      )}
    </div>
  );
}
