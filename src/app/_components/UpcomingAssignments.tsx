import Link from "next/link";
import { ClipboardList, AlertTriangle } from "lucide-react";
import type { AssignmentView } from "@/domain/assignments/repository";

/**
 * Prazos de entrega que se aproximam, para a agenda e o dashboard.
 *
 * Fica FORA do plano da semana de propósito: o planner reserva blocos de
 * ESTUDO, e entrega não é estudo — é uma data com consequência. Misturar as
 * duas coisas faria o plano prometer que a entrega vai acontecer sozinha se
 * você cumprir os blocos.
 */
export function UpcomingAssignments({ items }: { items: AssignmentView[] }) {
  if (items.length === 0) return null;

  const atrasadas = items.filter((a) => a.atrasada);

  return (
    <section className="mb-6 rounded-xl border border-line bg-surface px-5 py-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <ClipboardList size={15} className="text-faculdade" />
        Entregas a vencer
        {atrasadas.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-normal text-red-600">
            <AlertTriangle size={12} />
            {atrasadas.length} atrasada{atrasadas.length === 1 ? "" : "s"}
          </span>
        )}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {items.map((a) => {
          const dias = Math.round(
            (new Date(a.dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
              86_400_000,
          );
          const quando =
            dias < 0
              ? `atrasada ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`
              : dias === 0
                ? "hoje"
                : dias === 1
                  ? "amanhã"
                  : `em ${dias} dias`;
          return (
            <li key={a.id}>
              <Link
                href={`/goals/${a.goalId}`}
                className="press flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2"
              >
                <span className="min-w-0 truncate">
                  {a.title}
                  <span className="ml-2 text-xs text-faint">{a.goalTitle}</span>
                </span>
                <span
                  className={`shrink-0 text-xs tabular-nums ${
                    dias < 0 ? "text-red-600" : dias <= 1 ? "text-warning" : "text-muted"
                  }`}
                >
                  {quando}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
