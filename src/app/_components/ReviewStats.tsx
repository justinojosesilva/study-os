import type { ReviewStats as Stats } from "@/domain/reviews/stats";

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function ReviewStats({ stats }: { stats: Stats }) {
  const hasReviews = stats.totalReviews > 0;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-base font-medium">Estatísticas de revisão</h2>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Cards" value={stats.totalCards} />
        <Metric label="Revisões" value={stats.totalReviews} />
        <Metric label="Retenção" value={hasReviews ? `${stats.retentionPct}%` : "—"} />
        <Metric label="Hoje" value={stats.reviewedToday} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Revisões por dia" sub="últimos 14 dias">
          <VBars
            data={stats.perDay.map((d) => ({
              value: d.count,
              label: String(d.date.getDate()),
            }))}
            color="var(--faculdade)"
            unit="revisões"
          />
        </Card>

        <Card title="Próximas revisões" sub="próximos 7 dias">
          <VBars
            data={stats.forecast.map((d, i) => ({
              value: d.count,
              label: i === 0 ? "hoje" : WEEKDAY[d.date.getDay()],
            }))}
            color="var(--profissional)"
            unit="cards"
          />
        </Card>
      </div>

      <Card title="Como você avaliou" sub="últimos 30 dias" className="mt-3">
        <RatingMix mix={stats.ratingMix} />
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Card({
  title,
  sub,
  className = "",
  children,
}: {
  title: string;
  sub: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-line bg-surface px-5 py-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-faint">{sub}</span>
      </div>
      {children}
    </div>
  );
}

function VBars({
  data,
  color,
  unit,
}: {
  data: { value: number; label: string }[];
  color: string;
  unit: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center gap-1">
          <div
            className="flex w-full flex-1 items-end"
            title={`${d.label} · ${d.value} ${unit}`}
          >
            <div
              className="w-full rounded-[3px] transition-opacity group-hover:opacity-80"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? 3 : 0,
                background: d.value > 0 ? color : "var(--surface-2)",
              }}
            />
          </div>
          <span className="text-[9px] leading-none text-faint">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const RATING_ROWS = [
  { key: "again", label: "Esqueci", color: "#e24b4a" },
  { key: "hard", label: "Difícil", color: "var(--warning)" },
  { key: "good", label: "Bom", color: "var(--faculdade)" },
  { key: "easy", label: "Fácil", color: "var(--profissional)" },
] as const;

function RatingMix({ mix }: { mix: Stats["ratingMix"] }) {
  const total = mix.again + mix.hard + mix.good + mix.easy;
  return (
    <div className="flex flex-col gap-2.5">
      {RATING_ROWS.map((r) => {
        const value = mix[r.key];
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={r.key} className="flex items-center gap-3 text-sm">
            <span className="w-16 shrink-0 text-muted">{r.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
            </div>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted">{value}</span>
          </div>
        );
      })}
    </div>
  );
}
