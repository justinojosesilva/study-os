import {
  Play,
  Flame,
  CalendarCheck,
  Clock,
  Timer,
  CircleCheckBig,
  Award,
  Brain,
  BookOpen,
  Layers,
  Lock,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { scoped } from "@/domain/auth";
import { getGamification } from "@/domain/gamification";
import {
  goalPerformance,
  phasePerformance,
  retentionTrend,
  calibration,
} from "@/domain/performance";
import { PerformancePanel } from "@/app/_components/PerformancePanel";
import Link from "next/link";
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
  lessons_10: BookOpen,
  reviews_100: Brain,
  cards_20: Layers,
};

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  // The tab lives in the URL rather than in client state so a view can be
  // linked to and survives a reload.
  const { aba } = await searchParams;
  const showGame = aba === "xp";

  return scoped(async (ownerId) => {
  const [g, goals, phases, retention, calibrations] = await Promise.all([
    getGamification(ownerId),
    showGame ? Promise.resolve([]) : goalPerformance(ownerId),
    showGame ? Promise.resolve([]) : phasePerformance(ownerId),
    showGame ? Promise.resolve([]) : retentionTrend(ownerId),
    showGame ? Promise.resolve([]) : calibration(ownerId),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Progresso" }]} />

      {/* O h1 é da PÁGINA, não da aba. Ele vivia dentro do ramo `showGame`, e
          a aba padrão (Desempenho) renderizava zero h1 — para leitor de tela a
          página não tinha título. O título de nível vira h2 dentro do painel. */}
      <h1 className="mb-1 flex items-center gap-2 text-xl font-medium">
        <Trophy size={20} className="text-certificacao" />
        Progresso
      </h1>
      <p className="mb-5 text-sm text-muted">
        {showGame
          ? "XP, nível e conquistas acumulados."
          : "Se o estudo está funcionando: notas, retenção e calibragem."}
      </p>

      <nav className="mb-6 flex gap-1 border-b border-line">
        <Tab href="/progress" active={!showGame} label="Desempenho" />
        <Tab href="/progress?aba=xp" active={showGame} label="XP e conquistas" />
      </nav>

      {!showGame && (
        <PerformancePanel
          goals={goals}
          phases={phases}
          retention={retention}
          calibrations={calibrations}
        />
      )}

      {showGame && (
      <>
      <header className="mb-8 flex items-center gap-4">
        <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-certificacao-soft text-certificacao">
          <span className="text-[11px] uppercase leading-none">nível</span>
          <span className="text-2xl font-medium leading-tight tabular-nums">{g.level}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-medium">{g.title}</h2>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <XpStat label="Estudo" value={g.breakdown.studyXp} hint={`${Math.round(g.stats.minutes / 60)}h`} />
          <XpStat label="Revisões" value={g.breakdown.reviewXp} hint={`${g.stats.reviews} revis.`} />
          <XpStat
            label="Domínio"
            value={g.breakdown.masteryXp}
            hint={`${g.stats.mastered} ${g.stats.mastered === 1 ? "dominado" : "dominados"} · ${g.stats.practicing} praticando`}
          />
          <XpStat
            label="Aulas"
            value={g.breakdown.lessonXp}
            hint={`${g.stats.lessons} ${g.stats.lessons === 1 ? "concluída" : "concluídas"}`}
          />
          <XpStat label="Certificações" value={g.breakdown.certXp} hint={`${g.stats.certs} conquist.`} />
        </div>
        <p className="mt-2 text-xs text-faint">
          Praticar um tópico já vale metade do XP de dominá-lo — a mesma metade que ele conta no
          progresso do objetivo. Questionário não paga XP à parte: passar num já promove o tópico e
          paga pelo domínio.
        </p>
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
      </>
      )}
    </main>
  );
  });
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-ink text-ink"
          : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
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
