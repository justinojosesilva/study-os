import Link from "next/link";
import { Flame, Target, RefreshCw, Sparkles, Award, CalendarClock, CalendarDays } from "lucide-react";
import { scoped, getCurrentUser } from "@/domain/auth";
import { getDashboardData } from "@/domain/dashboard";
import { dailyStudyMinutes } from "@/domain/metrics";
import { listArchivedGoals } from "@/domain/goals/repository";
import { listTopicsForPicker } from "@/domain/topics/repository";
import { listMaterialsForPicker } from "@/domain/materials/repository";
import { listRecentSessions } from "@/domain/sessions/repository";
import { countDueCards } from "@/domain/reviews/repository";
import { getGamification } from "@/domain/gamification";
import { getUpcomingExam, type CertificationView } from "@/domain/certifications/repository";
import { getWeekPlan, type PlanDay } from "@/domain/schedule/planner";
import { continueReading } from "@/domain/reading/repository";
import { CATEGORY } from "@/lib/categories";
import { daysUntil, startOfWeek, addDays, toDateKey } from "@/lib/date";
import { SessionLogger } from "./_components/SessionLogger";
import { NewGoalForm } from "./_components/NewGoalForm";
import { GoalCard } from "./_components/GoalCard";
import { Heatmap } from "./_components/Heatmap";
import { WeeklyCard } from "./_components/WeeklyCard";
import { LevelCard } from "./_components/LevelCard";
import { ContinueReadingCard } from "./_components/ContinueReadingCard";
import { StudyTrend } from "./_components/StudyTrend";
import { EmptyState } from "./_components/EmptyState";

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return scoped(async (ownerId) => {
  const heatmapStart = addDays(startOfWeek(), -25 * 7);
  const [data, topics, materials, sessions, minutesByDay, user, archived, dueCount, gamification, upcomingExam, weekPlan, reading] =
    await Promise.all([
      getDashboardData(ownerId),
      listTopicsForPicker(ownerId),
      listMaterialsForPicker(ownerId),
      listRecentSessions(ownerId, 6),
      dailyStudyMinutes(ownerId, heatmapStart),
      getCurrentUser(),
      listArchivedGoals(ownerId),
      countDueCards(ownerId),
      getGamification(ownerId),
      getUpcomingExam(ownerId),
      getWeekPlan(ownerId),
      continueReading(ownerId),
    ]);
  const todayPlan = weekPlan.days[0];

  const TREND_WEEKS = 12;
  const trend = Array.from({ length: TREND_WEEKS }, (_, i) => {
    const weekStart = addDays(startOfWeek(), -(TREND_WEEKS - 1 - i) * 7);
    let mins = 0;
    for (let d = 0; d < 7; d++) mins += minutesByDay.get(toDateKey(addDays(weekStart, d))) ?? 0;
    return {
      label: `${weekStart.getDate()}/${MONTHS_SHORT[weekStart.getMonth()]}`,
      hours: Math.round((mins / 60) * 10) / 10,
    };
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            {greeting()}
            {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-muted">Aqui está seu progresso de hoje.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Flame size={16} className="text-warning" />
            <strong className="font-medium text-ink">{data.streak}</strong> dias
          </span>
          {dueCount > 0 && (
            <Link
              href="/review"
              className="press inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2"
            >
              <RefreshCw size={15} /> Revisar
              <span className="rounded-full bg-faculdade-soft px-1.5 text-xs text-faculdade">
                {dueCount}
              </span>
            </Link>
          )}
          <SessionLogger topics={topics} materials={materials} />
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <WeeklyCard hours={data.weekHours} goal={data.weekGoalHours} />
        <Metric label="Sequência" value={`${data.streak}`} hint="dias seguidos" />
        <Metric label="Objetivos ativos" value={`${data.activeGoals}`} />
        <Metric
          label="Tópicos dominados"
          value={`${data.masteredTopics}`}
          hint={`de ${data.totalTopics}`}
        />
      </section>

      {upcomingExam && <UpcomingExamCard exam={upcomingExam} />}

      {todayPlan.blocks.length > 0 && <TodayPlanCard day={todayPlan} />}

      <ContinueReadingCard items={reading} />

      <LevelCard g={gamification} />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-medium">Seus objetivos</h2>
        <div className="flex items-center gap-2">
          <Link
            href="/mentor"
            className="press inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2"
          >
            <Sparkles size={15} className="text-certificacao" /> Mentor
          </Link>
          <NewGoalForm />
        </div>
      </div>

      {data.goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Comece pelo seu primeiro objetivo"
          hint="Defina uma meta de carreira e quebre em tópicos para acompanhar a evolução."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.goals.map((g, i) => (
            <GoalCard key={g.id} goal={g} index={i} />
          ))}
        </ul>
      )}

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-medium">Ritmo de estudo</h2>
          <span className="text-sm text-muted">horas por semana · últimas {TREND_WEEKS}</span>
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-4">
          <StudyTrend data={trend} />
        </div>
      </section>

      <Heatmap minutesByDay={minutesByDay} />

      {sessions.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-medium">Sessões recentes</h2>
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {sessions.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0 motion-safe:animate-fade-in"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.topicTitle ?? "Estudo livre"}
                  </p>
                  <p className="text-xs text-muted">{formatSessionDate(s.startedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted tabular-nums">
                  {s.comprehension != null && <span>{s.comprehension}/10</span>}
                  <span className="font-medium text-ink">{formatDuration(s.durationMin)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-muted">Arquivados</h2>
          <ul className="flex flex-col gap-2">
            {archived.map((g) => {
              const cat = CATEGORY[g.category];
              const Icon = cat.Icon;
              return (
                <li key={g.id}>
                  <Link
                    href={`/goals/${g.id}`}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <Icon size={15} className="text-faint" />
                    <span className="truncate">{g.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
  });
}

function formatSessionDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function TodayPlanCard({ day }: { day: PlanDay }) {
  return (
    <Link
      href="/agenda"
      className="press mb-8 block rounded-xl border border-line bg-surface px-5 py-4 transition-colors hover:bg-surface-2"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays size={16} className="text-profissional" /> Hoje no plano
        </span>
        <span className="text-xs text-muted tabular-nums">
          {Math.round(day.plannedMin)} min · {day.blocks.length} blocos
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {day.blocks.map((b, i) => (
          <li
            key={i}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
              b.kind === "review" ? "bg-faculdade-soft text-faculdade" : "bg-surface-2 text-muted"
            }`}
          >
            {b.label}
            <span className="text-faint tabular-nums">{b.minutes}min</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function UpcomingExamCard({ exam }: { exam: CertificationView }) {
  const days = exam.examDate ? daysUntil(exam.examDate) : null;
  return (
    <Link
      href="/certifications"
      className="press mb-8 flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4 transition-colors hover:bg-surface-2"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-certificacao-soft text-certificacao">
        <CalendarClock size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-faint">Próxima prova</p>
        <p className="truncate text-sm font-medium">
          <span className="text-muted">{exam.provider}</span> · {exam.title}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {days != null && (
          <p className={`text-sm font-medium tabular-nums ${days <= 14 ? "text-warning" : ""}`}>
            {days >= 0 ? `em ${days} ${days === 1 ? "dia" : "dias"}` : "vencida"}
          </p>
        )}
        {exam.readinessPct != null && (
          <p className="text-xs text-muted tabular-nums">{exam.readinessPct}% pronto</p>
        )}
      </div>
    </Link>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums">
        {value}
        {hint && <span className="ml-1 text-sm font-normal text-muted">{hint}</span>}
      </p>
    </div>
  );
}


