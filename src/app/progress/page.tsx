import {
  Play,
  Flame,
  CalendarCheck,
  Clock,
  Timer,
  CircleCheckBig,
  Award,
  Brain,
  Layers,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { scoped } from "@/domain/auth";
import { getGamification } from "@/domain/gamification";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";

export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  first_session: Play,
  streak_7: Flame,
  streak_30: CalendarCheck,
  hours_10: Clock,
  hours_50: Timer,
  first_mastered: CircleCheckBig,
  mastered_10: Award,
  reviews_100: Brain,
  cards_20: Layers,
};

export default async function ProgressPage() {
  return scoped(async (ownerId) => {
  const g = await getGamification(ownerId);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Progresso" }]} />

      <header className="mb-8 flex items-center gap-4">
        <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-certificacao-soft text-certificacao">
          <span className="text-[11px] uppercase leading-none">nível</span>
          <span className="text-2xl font-medium leading-tight tabular-nums">{g.level}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-medium">{g.title}</h1>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-certificacao" style={{ width: `${g.progressPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {g.xpInLevel.toLocaleString("pt-BR")} / {g.xpForNext.toLocaleString("pt-BR")} XP para o
            nível {g.level + 1} · {g.totalXp.toLocaleString("pt-BR")} XP total
          </p>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-medium">De onde vem seu XP</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <XpStat label="Estudo" value={g.breakdown.studyXp} hint={`${Math.round(g.stats.minutes / 60)}h`} />
          <XpStat label="Revisões" value={g.breakdown.reviewXp} hint={`${g.stats.reviews} revis.`} />
          <XpStat label="Domínio" value={g.breakdown.masteryXp} hint={`${g.stats.mastered} tópicos`} />
          <XpStat label="Certificações" value={g.breakdown.certXp} hint={`${g.stats.certs} conquist.`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-medium">Conquistas</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {g.achievements.map((a) => {
            const Icon = ICONS[a.id] ?? Award;
            return (
              <li
                key={a.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  a.unlocked ? "border-line bg-surface" : "border-dashed border-line bg-surface/50"
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    a.unlocked ? "bg-warning/15 text-warning" : "bg-surface-2 text-faint"
                  }`}
                >
                  {a.unlocked ? <Icon size={18} /> : <Lock size={16} />}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${a.unlocked ? "" : "text-muted"}`}>
                    {a.label}
                  </p>
                  <p className="text-xs text-muted">{a.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
  });
}

function XpStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">
        {value.toLocaleString("pt-BR")} <span className="text-xs font-normal text-muted">XP</span>
      </p>
      <p className="text-[11px] text-faint">{hint}</p>
    </div>
  );
}
