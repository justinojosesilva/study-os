import Link from "next/link";
import { Target, Layers3, Brain, Scale, TrendingUp } from "lucide-react";
import { CATEGORY } from "@/lib/categories";
import { EmptyState } from "./EmptyState";
import type {
  GoalPerformance,
  PhasePerformance,
  RetentionPoint,
  Calibration,
} from "@/domain/performance";

/**
 * Measurement half of the progress page: is the studying working?
 *
 * Every empty state here says what to do to fill it. Most of this data only
 * appears after quizzes are taken, so a bare "nenhum dado" would read as a
 * broken screen rather than an unstarted one.
 */
export function PerformancePanel({
  goals,
  phases,
  retention,
  calibrations,
}: {
  goals: GoalPerformance[];
  phases: PhasePerformance[];
  retention: RetentionPoint[];
  calibrations: Calibration[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-medium">
          <Target size={17} className="text-profissional" /> Por objetivo
        </h2>
        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Nenhum objetivo ativo"
            hint="Crie um objetivo para começar a acompanhar sua evolução."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {goals.map((g) => {
              const cat = CATEGORY[g.category];
              return (
                <li key={g.goalId}>
                  <Link
                    href={`/goals/${g.goalId}`}
                    className="press flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {g.title}
                    </span>
                    <Score label="Prova" value={g.examAvg} count={g.examCount} />
                    <Score label="Questionários" value={g.quizAvg} count={g.quizCount} />
                    <Stat label="Horas" value={`${g.hours.toLocaleString("pt-BR")}h`} />
                    <Stat label="Progresso" value={`${g.progressPct}%`} accent={cat.text} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-faint">
          Prova mede o objetivo inteiro; questionário mede um tópico. Escalas diferentes ficam
          separadas de propósito — ir bem nas partes não é o mesmo que ir bem no todo.
        </p>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-medium">
          <Layers3 size={17} className="text-faint" /> Por fase
        </h2>
        {phases.length === 0 ? (
          <EmptyState
            bordered
            icon={Layers3}
            title="Nenhum objetivo agrupado em fases"
            hint="Use “Organizar em fases” dentro de um objetivo para ver a média por etapa."
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {phases.map((p) => (
              <li
                key={`${p.goalId}-${p.phase}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{p.phase}</span>
                  {/* Phase names repeat across goals ("Fundamentos" in two of
                      them), so the goal has to travel with the name. */}
                  <span className="ml-2 text-xs text-faint">{p.goalTitle}</span>
                </span>
                <span className="text-xs text-muted tabular-nums">
                  {p.topics} {p.topics === 1 ? "tópico" : "tópicos"}
                </span>
                <Score label="Média" value={p.avgScore} count={p.avgScore === null ? 0 : 1} compact />
                <span className="w-24 shrink-0">
                  <span className="mb-1 block text-right text-xs tabular-nums text-muted">
                    {p.progressPct}%
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-profissional"
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-medium">
          <Brain size={17} className="text-faculdade" /> Retenção nas revisões
        </h2>
        {retention.length === 0 ? (
          <EmptyState
            bordered
            icon={Brain}
            title="Nenhuma revisão ainda"
            hint="Revise flashcards para ver sua curva de retenção ao longo das semanas."
          />
        ) : (
          <>
            <div className="flex items-end gap-2 rounded-xl border border-line bg-surface px-4 py-4">
              {retention.map((r) => (
                <div key={r.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="relative flex h-28 w-full max-w-10 items-end justify-center rounded-md bg-surface-2">
                    <span
                      className="absolute inset-x-0 bottom-0 rounded-md bg-faculdade/30"
                      style={{ height: `${r.pct}%` }}
                    />
                    <span
                      className="absolute inset-x-0 bottom-0 rounded-md bg-faculdade"
                      style={{ height: `${r.easyPct}%` }}
                    />
                  </span>
                  <span className="truncate text-[11px] text-faint">{r.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <Legend className="bg-faculdade/30" label="Lembrou" />
              <Legend className="bg-faculdade" label="Lembrou sem esforço" />
              <span className="text-faint">
                “Difícil” conta como lembrar — só “de novo” é falha. A distância entre as duas
                faixas é o esforço que a lembrança ainda custa.
              </span>
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-medium">
          <Scale size={17} className="text-warning" /> Percepção × resultado
        </h2>
        {calibrations.length === 0 ? (
          <EmptyState
            bordered
            icon={Scale}
            title="Ainda não dá para comparar"
            hint="Precisa de um tópico com compreensão anotada numa sessão e ao menos um questionário respondido."
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {calibrations.map((c) => {
              const over = c.gap > 15;
              const under = c.gap < -15;
              return (
                <li
                  key={c.topicId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{c.topicTitle}</span>
                    <span className="ml-2 text-xs text-faint">{c.goalTitle}</span>
                  </span>
                  <Stat label="Você acha" value={`${c.declaredPct}%`} />
                  <Stat label="Você tirou" value={`${c.verifiedPct}%`} />
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                      over
                        ? "bg-warning/15 text-warning"
                        : under
                          ? "bg-faculdade-soft text-faculdade"
                          : "bg-emerald-500/10 text-emerald-500"
                    }`}
                  >
                    {over ? "superestima" : under ? "subestima" : "calibrado"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 flex items-start gap-1.5 text-xs text-faint">
          <TrendingUp size={13} className="mt-0.5 shrink-0" />
          Superestimar aponta onde revisar; subestimar aponta onde você já pode seguir em frente.
        </p>
      </section>
    </div>
  );
}

function Score({
  label,
  value,
  count,
  compact = false,
}: {
  label: string;
  value: number | null;
  count: number;
  compact?: boolean;
}) {
  return (
    <span className="shrink-0">
      {!compact && <span className="block text-[11px] text-faint">{label}</span>}
      <span className="text-sm font-medium tabular-nums">
        {value === null ? <span className="text-faint">—</span> : `${value}%`}
      </span>
      {!compact && count > 0 && (
        <span className="ml-1 text-[11px] text-faint">({count})</span>
      )}
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <span className="shrink-0">
      <span className="block text-[11px] text-faint">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${accent ?? ""}`}>{value}</span>
    </span>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-[2px] ${className}`} />
      {label}
    </span>
  );
}
