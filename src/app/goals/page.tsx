import Link from "next/link";
import { Target, Sparkles, Archive } from "lucide-react";
import { scoped } from "@/domain/auth";
import { goalsWithProgress } from "@/domain/dashboard";
import { listArchivedGoals } from "@/domain/goals/repository";
import { CATEGORY } from "@/lib/categories";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { EmptyState } from "@/app/_components/EmptyState";
import { GoalCard } from "@/app/_components/GoalCard";
import { NewGoalForm } from "@/app/_components/NewGoalForm";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  return scoped(async (ownerId) => {
    const [goals, archived] = await Promise.all([
      goalsWithProgress(ownerId),
      listArchivedGoals(ownerId),
    ]);

    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Objetivos" }]} />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-medium">
              <Target size={20} className="text-profissional" />
              Objetivos
            </h1>
            <p className="mt-1 text-sm text-muted">
              {goals.length === 0
                ? "Nenhum objetivo ativo."
                : `${goals.length} ${goals.length === 1 ? "objetivo ativo" : "objetivos ativos"} · progresso derivado dos tópicos dominados.`}
            </p>
          </div>
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

        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Comece pelo seu primeiro objetivo"
            hint="Defina uma meta de carreira e quebre em tópicos para acompanhar a evolução."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {goals.map((g, i) => (
              <GoalCard key={g.id} goal={g} index={i} />
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted">
              <Archive size={15} /> Arquivados
            </h2>
            <ul className="flex flex-col gap-2">
              {archived.map((g) => {
                const cat = CATEGORY[g.category];
                const Icon = cat.Icon;
                return (
                  <li key={g.id}>
                    <Link
                      href={`/goals/${g.id}`}
                      className="press flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 text-sm opacity-70 hover:bg-surface-2 hover:opacity-100"
                    >
                      <Icon size={15} className={cat.text} />
                      <span className="min-w-0 flex-1 truncate">{g.title}</span>
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
