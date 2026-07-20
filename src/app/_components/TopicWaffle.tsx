import type { Topic } from "@/infra/db/schema";

/**
 * Proportional "waffle" of topic mastery — one cell per topic, colored by
 * status. Fills mastered → learning → todo so progress reads left-to-right.
 * A clearer proportion view than a single bar for the topic distribution.
 */

const STATUS_META = {
  mastered: { cls: "bg-faculdade", label: "Dominado" },
  learning: { cls: "bg-warning", label: "Estudando" },
  todo: { cls: "bg-surface-2", label: "A fazer" },
} as const;

const ORDER = ["mastered", "learning", "todo"] as const;

export function TopicWaffle({ topics }: { topics: Pick<Topic, "status" | "title">[] }) {
  if (topics.length === 0) return null;

  const counts = {
    mastered: topics.filter((t) => t.status === "mastered").length,
    learning: topics.filter((t) => t.status === "learning").length,
    todo: topics.filter((t) => t.status === "todo").length,
  };

  const cells = ORDER.flatMap((status) =>
    topics
      .filter((t) => t.status === status)
      .map((t) => ({ status, title: t.title })),
  );

  return (
    <div
      role="img"
      aria-label={`${counts.mastered} de ${topics.length} tópicos dominados, ${counts.learning} em estudo, ${counts.todo} a fazer.`}
    >
      <div className="flex flex-wrap gap-1.5">
        {cells.map((c, i) => (
          <span
            key={i}
            title={`${STATUS_META[c.status].label} · ${c.title}`}
            className={`size-4 rounded-[3px] ${STATUS_META[c.status].cls}`}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {ORDER.map((status) =>
          counts[status] > 0 ? (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-[2px] ${STATUS_META[status].cls}`} />
              {STATUS_META[status].label}
              <span className="tabular-nums text-faint">{counts[status]}</span>
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
