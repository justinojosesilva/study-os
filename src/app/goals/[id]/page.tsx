import { notFound } from "next/navigation";
import { Archive, ListChecks, Library, Award, ChevronRight } from "lucide-react";
import Link from "next/link";
import { scoped } from "@/domain/auth";
import { getGoalWithTopics } from "@/domain/goals/repository";
import { listFlashcardsForGoal } from "@/domain/flashcards/repository";
import { listMaterialsForGoal } from "@/domain/materials/repository";
import { listLessonsForGoal } from "@/domain/lessons/repository";
import { listExamsForGoal } from "@/domain/exams/repository";
import { PRACTICING_CREDIT } from "@/lib/progress";
import { ExamCard } from "@/app/_components/ExamCard";
import {
  listCertificationsForGoal,
  type CertificationView,
} from "@/domain/certifications/repository";
import { CATEGORY } from "@/lib/categories";
import { formatMonthYear, daysUntil, toDateKey } from "@/lib/date";
import { TopicGroups } from "@/app/_components/TopicGroups";
import { AddTopicForm } from "@/app/_components/AddTopicForm";
import { GoalActions } from "@/app/_components/GoalActions";
import { MaterialRow } from "@/app/_components/MaterialRow";
import { AddMaterialForm } from "@/app/_components/AddMaterialForm";
import { GapAnalysis } from "@/app/_components/GapAnalysis";
import { TopicWaffle } from "@/app/_components/TopicWaffle";
import { EmptyState } from "@/app/_components/EmptyState";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return scoped(async (ownerId) => {
  const goal = await getGoalWithTopics(ownerId, id);
  if (!goal) notFound();

  const [allCards, materials, certs, allLessons, examAttempts] = await Promise.all([
    listFlashcardsForGoal(ownerId, id),
    listMaterialsForGoal(ownerId, id),
    listCertificationsForGoal(ownerId, id),
    listLessonsForGoal(ownerId, id),
    listExamsForGoal(ownerId, id),
  ]);
  const cardsByTopic = new Map<string, { id: string; front: string; back: string }[]>();
  for (const c of allCards) {
    const list = cardsByTopic.get(c.topicId) ?? [];
    list.push({ id: c.id, front: c.front, back: c.back });
    cardsByTopic.set(c.topicId, list);
  }
  const lessonsByTopic = new Map<string, { id: string; title: string }[]>();
  for (const l of allLessons) {
    const list = lessonsByTopic.get(l.topicId) ?? [];
    list.push({ id: l.id, title: l.title });
    lessonsByTopic.set(l.topicId, list);
  }

  const cat = CATEGORY[goal.category];
  const Icon = cat.Icon;

  // Same credit rule as goalProgressPct and the dashboard: practice counts half.
  const totalWeight = goal.topics.reduce((s, t) => s + t.weight, 0);
  const earnedWeight = goal.topics.reduce(
    (s, t) =>
      s +
      (t.status === "mastered"
        ? t.weight
        : t.status === "praticando"
          ? t.weight * PRACTICING_CREDIT
          : 0),
    0,
  );
  const progressPct = totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: goal.title }]} />

      <header className="mb-6">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Icon size={20} className={cat.text} />
            <h1 className="text-xl font-medium">{goal.title}</h1>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${cat.soft} ${cat.text}`}>
              {cat.label}
            </span>
          </div>
          <GoalActions
            id={goal.id}
            title={goal.title}
            why={goal.why}
            category={goal.category}
            targetDate={goal.targetDate ? toDateKey(goal.targetDate) : ""}
            archived={goal.status === "archived"}
          />
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          {goal.targetDate && <TargetDate date={goal.targetDate} />}
          {goal.why && <span className="border-l border-line pl-3">{goal.why}</span>}
        </div>
      </header>

      {goal.status === "archived" && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2.5 text-sm text-muted">
          <Archive size={15} /> Este objetivo está arquivado e não aparece no dashboard.
        </div>
      )}

      <section className="mb-8">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm text-muted">Progresso</span>
          <span className="text-sm font-medium tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full origin-left ${cat.bar} motion-safe:animate-grow-x`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {goal.topics.length > 0 && (
          <div className="mt-4">
            <TopicWaffle topics={goal.topics} />
          </div>
        )}
      </section>

      {certs.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted">Certificações</h2>
          <ul className="flex flex-col gap-2">
            {certs.map((c) => (
              <GoalCertRow key={c.id} cert={c} />
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface px-5 py-4">
        {goal.topics.length === 0 ? (
          <>
            <h2 className="mb-1 text-base font-medium">Tópicos</h2>
            <EmptyState
              bordered={false}
              icon={ListChecks}
              title="Nenhum tópico ainda"
              hint="Quebre o objetivo em partes estudáveis abaixo."
            />
          </>
        ) : (
          <TopicGroups
            goalId={goal.id}
            topics={goal.topics}
            cardsByTopic={cardsByTopic}
            lessonsByTopic={lessonsByTopic}
          />
        )}
        <AddTopicForm goalId={goal.id} />
      </section>

      <GapAnalysis goalId={goal.id} />

      <div className="mt-4">
        <ExamCard goalId={goal.id} progressPct={progressPct} attempts={examAttempts} />
      </div>

      <section className="mt-6 rounded-xl border border-line bg-surface px-5 py-4">
        <h2 className="mb-1 text-base font-medium">Materiais</h2>
        {materials.length === 0 ? (
          <EmptyState
            bordered={false}
            icon={Library}
            title="Nenhum material ainda"
            hint="Adicione cursos, livros, vídeos ou links de referência abaixo."
          />
        ) : (
          <ul className="flex flex-col">
            {materials.map((m) => (
              <MaterialRow key={m.id} material={m} goalId={goal.id} />
            ))}
          </ul>
        )}
        <AddMaterialForm goalId={goal.id} />
      </section>
    </main>
  );
  });
}

function TargetDate({ date }: { date: Date }) {
  const days = daysUntil(date);
  const soon = days >= 0 && days <= 14;
  return (
    <span className={soon ? "text-warning" : undefined}>
      {soon ? `em ${days} dias` : formatMonthYear(date)}
    </span>
  );
}

const CERT_STATUS_LABEL: Record<CertificationView["status"], string> = {
  planned: "Planejada",
  scheduled: "Agendada",
  passed: "Conquistada",
  failed: "Não passou",
  expired: "Expirada",
};

function GoalCertRow({ cert }: { cert: CertificationView }) {
  const days = cert.examDate ? daysUntil(cert.examDate) : null;
  const pending = cert.status === "planned" || cert.status === "scheduled";
  return (
    <li>
      <Link
        href="/certifications"
        className="press flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 hover:bg-surface-2"
      >
        <Award size={16} className="shrink-0 text-certificacao" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{cert.title}</p>
          <p className="text-xs text-muted">
            {cert.provider}
            {pending && days != null && days >= 0 && ` · prova em ${days} ${days === 1 ? "dia" : "dias"}`}
            {cert.status === "passed" && " · conquistada"}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted">{CERT_STATUS_LABEL[cert.status]}</span>
        <ChevronRight size={15} className="shrink-0 text-faint" />
      </Link>
    </li>
  );
}
