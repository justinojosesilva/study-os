import Link from "next/link";
import { Library } from "lucide-react";
import { scoped } from "@/domain/auth";
import { listAllMaterials, type MaterialWithGoal } from "@/domain/materials/repository";
import { listActiveGoalOptions } from "@/domain/goals/repository";
import { MaterialRow } from "@/app/_components/MaterialRow";
import { materialUsage } from "@/domain/materials/repository";
import { AddMaterialForm } from "@/app/_components/AddMaterialForm";
import { EmptyState } from "@/app/_components/EmptyState";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";

export const dynamic = "force-dynamic";

const UNATTACHED = "__none__";

export default async function MaterialsPage() {
  return scoped(async (ownerId) => {
  const [materials, goals, usage] = await Promise.all([
    listAllMaterials(ownerId),
    listActiveGoalOptions(ownerId),
    materialUsage(ownerId),
  ]);

  // Group by goal, preserving first-seen order; unattached goes last.
  const groups = new Map<string, { goalId: string | null; title: string; items: MaterialWithGoal[] }>();
  for (const m of materials) {
    const key = m.goalId ?? UNATTACHED;
    if (!groups.has(key)) {
      groups.set(key, {
        goalId: m.goalId,
        title: m.goalTitle ?? "Sem objetivo",
        items: [],
      });
    }
    groups.get(key)!.items.push(m);
  }
  const ordered = [...groups.values()].sort((a, b) => {
    if (a.goalId === null) return 1;
    if (b.goalId === null) return -1;
    return 0;
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Materiais" }]} />

      <h1 className="mb-6 text-xl font-medium">Materiais</h1>

      <div className="mb-8 rounded-xl border border-line bg-surface px-5 py-4">
        <h2 className="text-sm font-medium">Adicionar material</h2>
        <AddMaterialForm goals={goals} />
      </div>

      {materials.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Nenhum material ainda"
          hint="Cadastre cursos, livros, vídeos e links — com ou sem objetivo associado."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {ordered.map((g) => (
            <section key={g.goalId ?? UNATTACHED}>
              <div className="mb-2 px-1 text-sm font-medium text-muted">
                {g.goalId ? (
                  <Link href={`/goals/${g.goalId}`} className="hover:text-ink">
                    {g.title}
                  </Link>
                ) : (
                  g.title
                )}
              </div>
              <ul className="rounded-xl border border-line bg-surface px-5 py-1">
                {g.items.map((m) => (
                  <MaterialRow
                    key={m.id}
                    material={{
                      id: m.id,
                      type: m.type,
                      title: m.title,
                      url: m.url,
                      progressPct: m.progressPct,
                    }}
                    goalId={m.goalId}
                    usage={usage.get(m.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
  });
}
