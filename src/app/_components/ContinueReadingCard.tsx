import Link from "next/link";
import { BookOpen, FlaskConical } from "lucide-react";
import type { ContinueReading } from "@/domain/reading/repository";

/**
 * Half-read lessons, most recent first.
 *
 * At ~85k characters and about an hour each, a lesson is never finished in one
 * sitting — so the interrupted one is the most likely thing to open next, and
 * until now nothing on the dashboard knew it existed.
 */
export function ContinueReadingCard({ items }: { items: ContinueReading[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border border-line bg-surface px-5 py-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <BookOpen size={16} className="text-faculdade" /> Continuar lendo
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const Icon = item.kind === "lab" ? FlaskConical : BookOpen;
          return (
            <li key={item.lessonId}>
              <Link
                href={`/lessons/${item.lessonId}`}
                className="press flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface-2"
              >
                <Icon
                  size={15}
                  className={`shrink-0 ${item.kind === "lab" ? "text-certificacao" : "text-faint"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.lessonTitle}</span>
                  <span className="block truncate text-xs text-muted">
                    {item.topicTitle} · {item.goalTitle}
                  </span>
                </span>
                <span className="w-20 shrink-0">
                  <span className="mb-1 block text-right text-xs tabular-nums text-muted">
                    {item.percent}%
                  </span>
                  <span className="block h-1 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-faculdade"
                      style={{ width: `${item.percent}%` }}
                    />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
