import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CATEGORY } from "@/lib/categories";
import { daysUntil, formatMonthYear } from "@/lib/date";
import type { DashboardGoal } from "@/domain/dashboard";

/** Shared between the dashboard and the goals index. */
export function GoalCard({
  goal,
  index = 0,
  muted = false,
}: {
  goal: DashboardGoal;
  index?: number;
  /** Dimmed treatment for goals that aren't active (paused/done/archived). */
  muted?: boolean;
}) {
  const cat = CATEGORY[goal.category];
  const Icon = cat.Icon;

  return (
    <li className="motion-safe:animate-fade-in" style={{ animationDelay: `${index * 60}ms` }}>
      <Link
        href={`/goals/${goal.id}`}
        className={`press block rounded-xl border border-line bg-surface px-5 py-4 hover:bg-surface-2 ${
          muted ? "opacity-60" : ""
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Icon size={18} className={cat.text} />
            <span className="truncate font-medium">{goal.title}</span>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${cat.soft} ${cat.text}`}
            >
              {cat.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TargetDate date={goal.targetDate} />
            <ChevronRight size={16} className="text-faint" />
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full origin-left ${cat.bar} motion-safe:animate-grow-x`}
            style={{ width: `${goal.progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          {goal.progressPct}% — {goal.masteredTopics} de {goal.totalTopics} tópicos dominados
        </p>
      </Link>
    </li>
  );
}

function TargetDate({ date }: { date: Date | null }) {
  if (!date) return null;
  const days = daysUntil(date);
  const soon = days >= 0 && days <= 14;
  return (
    <span className={`shrink-0 text-xs ${soon ? "text-warning" : "text-muted"}`}>
      {soon ? `em ${days} dias` : formatMonthYear(date)}
    </span>
  );
}
