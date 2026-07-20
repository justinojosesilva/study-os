import Link from "next/link";
import { CalendarDays, RefreshCw, Play } from "lucide-react";
import { scoped } from "@/domain/auth";
import { getWeekPlan, type PlanDay } from "@/domain/schedule/planner";
import { getAvailability } from "@/domain/user/repository";
import { listTopicsForPicker, type PickerTopic } from "@/domain/topics/repository";
import { listSessionsBetween } from "@/domain/sessions/repository";
import { toDateKey, addDays, startOfToday } from "@/lib/date";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { AvailabilitySettings } from "@/app/_components/AvailabilitySettings";
import { SessionLogger } from "@/app/_components/SessionLogger";
import { WeekStrategy } from "@/app/_components/WeekStrategy";
import { EmptyState } from "@/app/_components/EmptyState";
import {
  MonthCalendar,
  type DayCell,
  type CalBlock,
  type PastSession,
} from "@/app/_components/MonthCalendar";

export const dynamic = "force-dynamic";

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtMin(m: number): string {
  if (m <= 0) return "0";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}min`;
  return mm === 0 ? `${h}h` : `${h}h${String(mm).padStart(2, "0")}`;
}

export default async function AgendaPage() {
  return scoped(async (ownerId) => {
    const today = startOfToday();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [plan, availability, topics, monthSessions] = await Promise.all([
      getWeekPlan(ownerId),
      getAvailability(ownerId),
      listTopicsForPicker(ownerId),
      listSessionsBetween(ownerId, monthStart, monthEnd),
    ]);

    const hasAnyBlocks = plan.days.some((d) => d.blocks.length > 0);

    // The 7-day plan and the month's actual sessions, both keyed by local date.
    const planByDate: Record<string, CalBlock[]> = {};
    for (const day of plan.days) {
      if (day.blocks.length > 0) planByDate[toDateKey(day.date)] = day.blocks;
    }
    const pastByDate: Record<string, PastSession[]> = {};
    for (const s of monthSessions) {
      const key = toDateKey(s.startedAt);
      (pastByDate[key] ??= []).push({
        topicTitle: s.topicTitle,
        durationMin: s.durationMin,
        comprehension: s.comprehension,
      });
    }
    const hasPast = Object.keys(pastByDate).length > 0;

    // Month grid: whole weeks (Sun–Sat) covering the current month.
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const gridStart = addDays(monthStart, -firstWeekday);
    const todayKey = toDateKey(today);
    const cells: DayCell[] = Array.from({ length: totalCells }, (_, i) => {
      const d = addDays(gridStart, i);
      const key = toDateKey(d);
      const blocks = planByDate[key] ?? [];
      return {
        dateKey: key,
        dayNum: d.getDate(),
        inMonth: d.getMonth() === monthStart.getMonth(),
        isToday: key === todayKey,
        reviews: blocks.filter((b) => b.kind === "review").length,
        topics: blocks.filter((b) => b.kind === "topic").length,
        pastMinutes: (pastByDate[key] ?? []).reduce((sum, x) => sum + x.durationMin, 0),
      };
    });
    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(today);

    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Agenda" }]} />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-medium">
              <CalendarDays size={20} className="text-profissional" />
              Agenda da semana
            </h1>
            <p className="mt-1 text-sm text-muted">
              {fmtMin(plan.totalPlannedMin)} planejados de {fmtMin(plan.totalAvailableMin)}{" "}
              disponíveis · revisões e tópicos priorizados por prazo.
            </p>
          </div>
          <AvailabilitySettings availability={availability} />
        </div>

        {!plan.hasCandidates && !hasAnyBlocks && !hasPast ? (
          <EmptyState
            icon={CalendarDays}
            title="Nada para agendar ainda"
            hint="Crie objetivos com tópicos (ou flashcards para revisar) e a agenda monta seu plano da semana automaticamente."
          />
        ) : (
          <>
            {hasAnyBlocks && <WeekStrategy />}

            {/* Desktop: month calendar; click a day for its panels. */}
            <div className="hidden lg:block">
              <MonthCalendar
                monthLabel={monthLabel}
                cells={cells}
                planByDate={planByDate}
                pastByDate={pastByDate}
                topics={topics}
              />
            </div>

            {/* Mobile: the 7-day list. */}
            <div className="flex flex-col gap-3 lg:hidden">
              {plan.days.map((day) => (
                <DayCard key={day.date.toISOString()} day={day} topics={topics} />
              ))}
            </div>
          </>
        )}
      </main>
    );
  });
}

function DayCard({ day, topics }: { day: PlanDay; topics: PickerTopic[] }) {
  const label = `${WEEKDAY[day.date.getDay()]} · ${day.date.getDate()}/${MONTHS_SHORT[day.date.getMonth()]}`;
  const fillPct = day.availableMin > 0 ? Math.round((day.plannedMin / day.availableMin) * 100) : 0;

  return (
    <section
      className={`rounded-xl border bg-surface px-5 py-4 ${
        day.isToday ? "border-profissional/40" : "border-line"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize">{label}</span>
          {day.isToday && (
            <span className="rounded-md bg-profissional-soft px-1.5 py-0.5 text-[11px] font-medium text-profissional">
              hoje
            </span>
          )}
        </div>
        <span className="text-xs text-muted tabular-nums">
          {day.availableMin > 0 ? `${fmtMin(day.plannedMin)} / ${fmtMin(day.availableMin)}` : "sem tempo"}
        </span>
      </div>

      {day.availableMin > 0 && (
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full origin-left rounded-full bg-profissional motion-safe:animate-grow-x"
            style={{ width: `${Math.min(100, fillPct)}%` }}
          />
        </div>
      )}

      {day.blocks.length === 0 ? (
        <p className="text-sm text-faint">{day.availableMin > 0 ? "Dia livre" : "Sem disponibilidade"}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {day.blocks.map((block, i) =>
            block.kind === "review" ? (
              <li key={i}>
                <Link
                  href="/review"
                  className="press flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface-2"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-faculdade-soft text-faculdade">
                    <RefreshCw size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{block.label}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">{fmtMin(block.minutes)}</span>
                </Link>
              </li>
            ) : (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted text-xs font-medium tabular-nums">
                  {block.minutes}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{block.label}</p>
                  {block.goalTitle && <p className="truncate text-xs text-muted">{block.goalTitle}</p>}
                </div>
                <SessionLogger
                  topics={topics}
                  initialTopicId={block.topicId}
                  initialMinutes={block.minutes}
                  triggerLabel="Iniciar"
                  triggerClassName="press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
                />
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
