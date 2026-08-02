import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { NextStep } from "@/domain/notes/repository";

/**
 * "Onde retomar" on a planned block — the last thing written about this topic.
 *
 * This is what three of the shortest real notes were already doing informally
 * ("Parei aqui 10. Exemplo intermediário", "Estudei até 5. Fluxograma"): the
 * plan says what to study, and this says where the last session stopped.
 */
export function NextStepHint({ step }: { step: NextStep | undefined }) {
  if (!step) return null;
  return (
    <Link
      href={`/notes/${step.noteId}`}
      title={step.text}
      className="mt-0.5 flex items-start gap-1 text-xs text-profissional hover:underline"
    >
      <ArrowRight size={12} className="mt-0.5 shrink-0" />
      <span className="line-clamp-1">{step.text}</span>
    </Link>
  );
}
