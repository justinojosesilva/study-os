"use client";

import { useState, useTransition } from "react";
import { Trash2, Lock } from "lucide-react";
import {
  setTopicStatusAction,
  setTopicPhaseAction,
  deleteTopicAction,
} from "@/app/_actions/topics";
import { FlashcardsDialog } from "./FlashcardsDialog";
import { TutorDialog } from "./TutorDialog";
import { LessonsDialog } from "./LessonsDialog";
import { TOPIC_STATUS, STATUS_FLOW, MANUAL_STATUSES, type TopicStatus } from "@/lib/topic-status";
import type { Topic } from "@/infra/db/schema";

type TopicLite = Pick<Topic, "id" | "title" | "weight" | "status" | "phase">;
type CardLite = { id: string; front: string; back: string };
type LessonLite = { id: string; title: string };

const NEW_PHASE = "__nova__";

export function TopicCard({
  topic,
  goalId,
  cards,
  lessons,
  phases = [],
}: {
  topic: TopicLite;
  goalId: string;
  cards: CardLite[];
  lessons: LessonLite[];
  /** Phases already in use on this goal, offered as options. */
  phases?: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [newPhase, setNewPhase] = useState("");
  const style = TOPIC_STATUS[topic.status];

  function movePhase(phase: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await setTopicPhaseAction(topic.id, phase);
      if (res.ok) {
        setNaming(false);
        setNewPhase("");
      } else {
        setError(res.error);
      }
    });
  }

  function setStatus(status: TopicStatus) {
    if (status === topic.status || !MANUAL_STATUSES.includes(status)) return;
    setError(null);
    startTransition(async () => {
      const res = await setTopicStatusAction(topic.id, status as "todo" | "learning" | "praticando");
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
    <li
      className={`flex flex-col gap-3 rounded-xl border bg-surface px-4 py-3 transition-colors ${
        topic.status === "mastered" ? "border-emerald-500/30" : "border-line"
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium">{topic.title}</p>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${style.soft} ${style.text}`}
        >
          {style.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={`Status: ${topic.title}`}
          className="flex overflow-hidden rounded-lg border border-line text-xs"
        >
          {STATUS_FLOW.map((s) => {
            const active = topic.status === s;
            const earned = s === "mastered";
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={pending || earned}
                aria-pressed={active}
                // Mastery is awarded by the exam, so its segment is a readout,
                // never a control. Leaving it visible keeps the path legible.
                aria-label={earned ? "Dominado é conquistado na prova" : undefined}
                className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                  active
                    ? `${TOPIC_STATUS[s].soft} ${TOPIC_STATUS[s].text}`
                    : "text-muted hover:text-ink"
                } ${earned ? "tip cursor-default" : ""}`}
              >
                {earned && <Lock size={10} />}
                {TOPIC_STATUS[s].label}
              </button>
            );
          })}
        </div>

        {naming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newPhase.trim()) movePhase(newPhase);
            }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={newPhase}
              onChange={(e) => setNewPhase(e.target.value)}
              onBlur={() => !newPhase.trim() && setNaming(false)}
              placeholder="Nome da fase"
              maxLength={60}
              className="w-32 rounded-lg border border-line bg-surface px-2 py-1 text-xs"
            />
            <button
              type="submit"
              disabled={pending || !newPhase.trim()}
              className="rounded-lg border border-line px-2 py-1 text-xs font-medium disabled:opacity-50"
            >
              Mover
            </button>
          </form>
        ) : (
          <select
            value={topic.phase ?? ""}
            disabled={pending}
            aria-label={`Fase de ${topic.title}`}
            onChange={(e) => {
              const v = e.target.value;
              if (v === NEW_PHASE) setNaming(true);
              else movePhase(v || null);
            }}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-muted"
          >
            <option value="">Sem fase</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={NEW_PHASE}>+ Nova fase…</option>
          </select>
        )}

        <span className="text-xs text-faint">peso {topic.weight}</span>

        <div className="ml-auto flex items-center gap-1">
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
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Remover tópico"
            className="tip tip-left p-1 text-faint transition-colors hover:text-red-600"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}
