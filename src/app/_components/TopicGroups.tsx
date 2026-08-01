"use client";

import { useState, useTransition } from "react";
import { Layers3, Sparkles } from "lucide-react";
import { groupTopicsIntoPhasesAction } from "@/app/_actions/ai";
import { TopicCard } from "./TopicCard";
import { PRACTICING_CREDIT } from "@/lib/progress";
import type { Topic } from "@/infra/db/schema";

type TopicLite = Pick<Topic, "id" | "title" | "weight" | "status" | "phase">;
type CardLite = { id: string; front: string; back: string };
type LessonLite = { id: string; title: string; kind: "aula" | "lab"; completedAt: Date | null };

/**
 * Topic list grouped by learning phase.
 *
 * Grouping is what makes cards viable: a goal here can hold 35 topics, and 35
 * cards in one column is a longer wall than the list it replaced. Phases turn
 * that into a handful of readable stages — and give each stage its own progress,
 * which a flat list can't show.
 */
export function TopicGroups({
  goalId,
  topics,
  cardsByTopic,
  lessonsByTopic,
}: {
  goalId: string;
  topics: TopicLite[];
  cardsByTopic: Map<string, CardLite[]>;
  lessonsByTopic: Map<string, LessonLite[]>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Topics arrive ordered by sortOrder, which already encodes the phase
  // sequence — so first-seen order is the right order for the groups too.
  const groups = new Map<string, TopicLite[]>();
  for (const t of topics) {
    const key = t.phase?.trim() || "";
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  // Ungrouped last: it's a staging area, not a stage.
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === "" ? 1 : b === "" ? -1 : 0,
  );
  const grouped = ordered.some(([name]) => name !== "");
  // Offered by each card's selector, so moving a topic never needs retyping.
  const phaseNames = ordered.map(([name]) => name).filter(Boolean);

  function organize() {
    setError(null);
    startTransition(async () => {
      const res = await groupTopicsIntoPhasesAction(goalId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">Tópicos</h2>
        {topics.length >= 2 && (
          <button
            type="button"
            onClick={organize}
            disabled={pending}
            className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
          >
            <Sparkles size={14} className="text-certificacao" />
            {pending ? "Organizando…" : grouped ? "Reorganizar fases" : "Organizar em fases"}
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-5">
        {ordered.map(([name, list]) => (
          <section key={name || "sem-fase"}>
            {grouped && (
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <Layers3 size={14} className="text-faint" />
                  {name || "Sem fase"}
                </h3>
                <span className="text-xs text-muted tabular-nums">
                  {phaseProgress(list)}%
                </span>
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {list.map((t) => (
                <TopicCard
                  key={t.id}
                  topic={t}
                  goalId={goalId}
                  cards={cardsByTopic.get(t.id) ?? []}
                  lessons={lessonsByTopic.get(t.id) ?? []}
                  phases={phaseNames}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

/** Same credit rule as the goal bar, applied to one phase. */
function phaseProgress(list: TopicLite[]): number {
  const total = list.reduce((s, t) => s + t.weight, 0);
  if (total === 0) return 0;
  const earned = list.reduce(
    (s, t) =>
      s +
      (t.status === "mastered"
        ? t.weight
        : t.status === "praticando"
          ? t.weight * PRACTICING_CREDIT
          : 0),
    0,
  );
  return Math.round((earned / total) * 100);
}
