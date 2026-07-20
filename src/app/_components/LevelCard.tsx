import Link from "next/link";
import { Trophy, ChevronRight } from "lucide-react";
import type { Gamification } from "@/domain/gamification";

export function LevelCard({ g }: { g: Gamification }) {
  const unlocked = g.achievements.filter((a) => a.unlocked).length;

  return (
    <Link
      href="/progress"
      className="mb-8 block rounded-xl border border-line bg-surface px-5 py-4 transition-colors hover:bg-surface-2"
    >
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-certificacao-soft text-certificacao">
          <span className="text-[10px] uppercase leading-none">nível</span>
          <span className="text-lg font-medium leading-tight tabular-nums">{g.level}</span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{g.title}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Trophy size={13} className="text-warning" />
              {unlocked}/{g.achievements.length}
              <ChevronRight size={14} className="text-faint" />
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-certificacao" style={{ width: `${g.progressPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {g.xpInLevel.toLocaleString("pt-BR")} / {g.xpForNext.toLocaleString("pt-BR")} XP para o
            nível {g.level + 1} · {g.totalXp.toLocaleString("pt-BR")} XP total
          </p>
        </div>
      </div>
    </Link>
  );
}
