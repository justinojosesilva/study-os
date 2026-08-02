import Link from "next/link";
import { CalendarDays, RefreshCw, Play, Check } from "lucide-react";
import { scoped } from "@/domain/auth";
import { getWeekPlan, type PlanDay } from "@/domain/schedule/planner";
import { getAvailability } from "@/domain/user/repository";
import { listTopicsForPicker, type PickerTopic } from "@/domain/topics/repository";
import { listSessionsBetween } from "@/domain/sessions/repository";
import { listNotesBySessions } from "@/domain/notes/repository";
import { toDateKey, addDays, startOfToday, formatTime } from "@/lib/date";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { AvailabilitySettings } from "@/app/_components/AvailabilitySettings";
import { SessionLogger } from "@/app/_components/SessionLogger";
import { SessionNote } from "@/app/_components/SessionNote";
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

    // Notes now live in their own table; the session only points at the moment
    // they were written. One extra query keyed by session id, rather than a
    // join, so the session list keeps its shape.
    const noteBySession = await listNotesBySessions(
      ownerId,
      monthSessions.map((s) => s.id),
    );

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
        startedAt: s.startedAt,
        note: noteBySession.get(s.id) ?? null,
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
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
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

            {/* Mobile: the 7-day list, then what actually happened. The plan
                only looks forward, so history needs its own section here —
                on desktop it lives inside each day of the calendar. */}
            <div className="flex flex-col gap-3 lg:hidden">
              {plan.days.map((day) => (
                <DayCard key={day.date.toISOString()} day={day} topics={topics} />
              ))}
              {hasPast && (
                <RecentHistory sessions={monthSessions} noteBySession={noteBySession} />
              )}
            </div>
          </>
        )}
      </main>
    );
  });
}

type MonthSession = Awaited<ReturnType<typeof listSessionsBetween>>[number];

/** This month's sessions, newest first, grouped by the day they happened on. */
function RecentHistory({
  sessions,
  noteBySession,
}: {
  sessions: MonthSession[];
  noteBySession: Map<string, { id: string; title: string; content: string }>;
}) {
  const byDay = new Map<string, MonthSession[]>();
  for (const s of sessions) {
    const key = toDateKey(s.startedAt);
    const list = byDay.get(key) ?? [];
    list.push(s);
    byDay.set(key, list);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <section className="mt-3 rounded-xl border border-line bg-surface px-5 py-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Check size={15} className="text-emerald-500" />
        Histórico
      </h2>
      <div className="flex flex-col gap-4">
        {days.map(([key, list]) => {
          const total = list.reduce((sum, s) => sum + s.durationMin, 0);
          return (
            <div key={key}>
              <p className="mb-1.5 flex items-baseline justify-between gap-2 text-xs text-muted">
                <span className="font-medium capitalize text-ink">{dayLabelFromKey(key)}</span>
                <span className="tabular-nums">{fmtMin(total)}</span>
              </p>
              <ul className="flex flex-col gap-1.5">
                {list.map((s) => (
                  <li key={s.id} className="rounded-lg border border-line px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {s.topicTitle ?? "Estudo livre"}
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5 text-xs text-muted tabular-nums">
                        {s.comprehension != null && <span>{s.comprehension}/10</span>}
                        <span>{formatTime(s.startedAt)}</span>
                        <span className="font-medium text-ink">{fmtMin(s.durationMin)}</span>
                      </span>
                    </div>
                    {noteBySession.get(s.id) && (
                      <SessionNote
                        content={noteBySession.get(s.id)!.content}
                        href={`/notes/${noteBySession.get(s.id)!.id}`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** "seg · 21/jul" from a "YYYY-MM-DD" key. */
function dayLabelFromKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY[date.getDay()]} · ${d}/${MONTHS_SHORT[m - 1]}`;
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
