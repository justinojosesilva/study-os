"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { setTopicStatusAction, deleteTopicAction } from "@/app/_actions/topics";
import { FlashcardsDialog } from "./FlashcardsDialog";
import { TutorDialog } from "./TutorDialog";
import { LessonsDialog } from "./LessonsDialog";
import type { Topic } from "@/infra/db/schema";

const STATUSES = [
  { key: "todo", label: "A fazer", active: "bg-surface-2 text-ink" },
  { key: "learning", label: "Estudando", active: "bg-warning/15 text-warning" },
  { key: "mastered", label: "Dominado", active: "bg-faculdade-soft text-faculdade" },
] as const;

type TopicLite = Pick<Topic, "id" | "title" | "weight" | "status">;
type CardLite = { id: string; front: string; back: string };
type LessonLite = { id: string; title: string };

export function TopicRow({
  topic,
  goalId,
  cards,
  lessons,
}: {
  topic: TopicLite;
  goalId: string;
  cards: CardLite[];
  lessons: LessonLite[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setStatus(status: TopicLite["status"]) {
    if (status === topic.status) return;
    setError(null);
    startTransition(async () => {
      const res = await setTopicStatusAction(topic.id, status);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteTopicAction(topic.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{topic.title}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <span className="hidden text-xs text-faint sm:inline">peso {topic.weight}</span>

      <TutorDialog topicId={topic.id} topicTitle={topic.title} />

      <LessonsDialog
        topicId={topic.id}
        topicTitle={topic.title}
        goalId={goalId}
        lessons={lessons}
      />

      <FlashcardsDialog
        topicId={topic.id}
        topicTitle={topic.title}
        goalId={goalId}
        cards={cards}
      />

      <div
        role="group"
        aria-label={`Status: ${topic.title}`}
        className={`flex overflow-hidden rounded-lg border border-line text-xs ${pending ? "opacity-60" : ""}`}
      >
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            disabled={pending}
            aria-pressed={topic.status === s.key}
            className={`px-2.5 py-1 transition-colors ${
              topic.status === s.key ? s.active : "text-muted hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        onClick={remove}
        disabled={pending}
        aria-label="Remover tópico"
        className="text-faint transition-colors hover:text-red-600"
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
