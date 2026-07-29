import { TOPIC_STATUS, STATUS_FLOW, type TopicStatus } from "@/lib/topic-status";
import type { Topic } from "@/infra/db/schema";

/**
 * Proportional "waffle" of topic progress — one cell per topic, coloured by
 * status. Reads right-to-left along the path a topic walks (mastered first),
 * so the finished share is what the eye lands on.
 *
 * Statuses come from the shared list rather than being spelled out here: the
 * previous version hard-coded three of them, so adding a fourth would have
 * silently dropped those topics from both the grid and the legend.
 */

const ORDER: TopicStatus[] = [...STATUS_FLOW].reverse();

export function TopicWaffle({ topics }: { topics: Pick<Topic, "status" | "title">[] }) {
  if (topics.length === 0) return null;

  const counts = Object.fromEntries(
    STATUS_FLOW.map((s) => [s, topics.filter((t) => t.status === s).length]),
  ) as Record<TopicStatus, number>;

  const cells = ORDER.flatMap((status) =>
    topics.filter((t) => t.status === status).map((t) => ({ status, title: t.title })),
  );

  const summary = ORDER.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${TOPIC_STATUS[s].label.toLowerCase()}`)
    .join(", ");

  return (
    <div role="img" aria-label={`${topics.length} tópicos: ${summary}.`}>
      <div className="flex flex-wrap gap-1.5">
        {cells.map((c, i) => (
          <span
            key={i}
            title={`${TOPIC_STATUS[c.status].label} · ${c.title}`}
            className={`size-4 rounded-[3px] ${TOPIC_STATUS[c.status].bar}`}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {ORDER.map((status) =>
          counts[status] > 0 ? (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-[2px] ${TOPIC_STATUS[status].bar}`} />
              {TOPIC_STATUS[status].label}
              <span className="tabular-nums text-faint">{counts[status]}</span>
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
