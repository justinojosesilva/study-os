import type { Topic } from "@/infra/db/schema";

export type TopicStatus = Topic["status"];

/**
 * One place for what each status is called and how it looks. The AI prompts and
 * the UI both read from here so a topic never reads as "estudando" in one
 * screen and something else in another.
 */
export const TOPIC_STATUS: Record<
  TopicStatus,
  { label: string; text: string; soft: string; bar: string }
> = {
  todo: { label: "A fazer", text: "text-faint", soft: "bg-surface-2", bar: "bg-line" },
  learning: {
    label: "Estudando",
    text: "text-profissional",
    soft: "bg-profissional-soft",
    bar: "bg-profissional",
  },
  praticando: {
    label: "Praticando",
    text: "text-faculdade",
    soft: "bg-faculdade-soft",
    bar: "bg-faculdade",
  },
  mastered: {
    label: "Dominado",
    text: "text-emerald-500",
    soft: "bg-emerald-500/10",
    bar: "bg-emerald-500",
  },
};

/** The order a topic walks through — drives the UI controls. */
export const STATUS_FLOW: TopicStatus[] = ["todo", "learning", "praticando", "mastered"];

/**
 * Statuses a person can set by hand. `mastered` is earned by passing the exam,
 * so it is never offered as a click. Mirrors the guard in the topics action.
 */
export const MANUAL_STATUSES: TopicStatus[] = ["todo", "learning", "praticando"];

/** Lowercase label for AI prompts. */
export function statusLabelPt(status: string): string {
  return (TOPIC_STATUS[status as TopicStatus]?.label ?? "a fazer").toLowerCase();
}
