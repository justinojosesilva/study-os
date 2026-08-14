import { db } from "@/infra/db/client";
import { studySessions, topics } from "@/infra/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { toDateKey, addDays } from "@/lib/date";
import { PRACTICING_CREDIT } from "@/lib/progress";

/**
 * Everything here is DERIVED from the study_sessions event log and the topics
 * table — nothing is a stored counter. This is the core thesis of the model:
 * facts are append-only; metrics are computed on read.
 */

export { PRACTICING_CREDIT } from "@/lib/progress";

/** Total minutes studied since a given instant (e.g. start of the week). */
export async function minutesStudiedSince(ownerId: string, since: Date) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${studySessions.durationMin}), 0)` })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.ownerId, ownerId),
        gte(studySessions.startedAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * Sequência de estudo, TOLERANTE a falhas isoladas.
 *
 * POR QUE NÃO É DIA-A-DIA ESTRITO. A regra anterior quebrava a sequência em
 * qualquer dia faltado. Medido na base real: 23 dias de estudo em 25 corridos —
 * 92% de constância — viravam "1 dia seguido" no painel, porque dois dias
 * isolados picotaram o recorde em pedaços de 11 e 2. A conquista de 30 dias
 * seguidos era inalcançável para alguém tão constante quanto isso. O número não
 * estava medindo constância, estava medindo ausência de imprevisto.
 *
 * A REGRA. Caminhando para trás, um dia faltado não quebra a sequência se, na
 * janela de 7 dias terminando nele, houver ao menos 6 dias estudados. Cair para
 * 5 de 7 quebra. Dia perdoado NÃO conta como dia estudado: ele só não
 * interrompe a contagem.
 *
 * Isso é derivado, não guardado — não há saldo de congelamento para
 * administrar, no mesmo espírito do resto do app, onde progresso vem do log de
 * eventos e nunca de um contador.
 *
 * `span` é a distância da âncora até o último dia estudado da corrente, e
 * `constancia` é `dias / span`. São eles que explicam o número na tela: "23 de
 * 25 · 92%" torna óbvio por que a sequência não quebrou.
 */
const TOLERANCIA_JANELA = 7;
const TOLERANCIA_MINIMO = 6;
/** Teto de segurança do caminhamento — a sequência não olha além de um ano. */
const TOLERANCIA_LIMITE = 365;

export type Sequencia = {
  /** Dias efetivamente estudados na corrente. */
  dias: number;
  /** Dias corridos da âncora até o último dia estudado da corrente. */
  span: number;
  /** `dias / span`, de 0 a 1. */
  constancia: number;
};

/**
 * A regra, isolada do banco. Recebe o conjunto de dias com estudo (chaves
 * locais) e a data de referência; devolve a sequência.
 *
 * Separada porque a regra é o que pode estar errado — a consulta não. Assim ela
 * se testa com conjuntos sintéticos, sem precisar semear banco.
 */
export function calcularSequencia(days: Set<string>, hoje: Date): Sequencia {
  let ancora = hoje;
  // Allow the streak to count today OR yesterday as the anchor.
  if (!days.has(toDateKey(ancora))) ancora = addDays(ancora, -1);
  if (!days.has(toDateKey(ancora))) return { dias: 0, span: 0, constancia: 0 };

  const estudadosNaJanela = (fim: Date) => {
    let n = 0;
    for (let i = 0; i < TOLERANCIA_JANELA; i++) {
      if (days.has(toDateKey(addDays(fim, -i)))) n += 1;
    }
    return n;
  };

  let dias = 0;
  let ultimoEstudado: Date | null = null;
  let cursor = ancora;

  for (let i = 0; i < TOLERANCIA_LIMITE; i++) {
    if (days.has(toDateKey(cursor))) {
      dias += 1;
      ultimoEstudado = cursor;
    } else if (estudadosNaJanela(cursor) < TOLERANCIA_MINIMO) {
      break;
    }
    cursor = addDays(cursor, -1);
  }

  // O span termina no último dia ESTUDADO, não onde o caminhamento parou —
  // senão uma falha perdoada logo antes da quebra entraria na conta e afundaria
  // a constância sem motivo.
  const span = ultimoEstudado
    ? Math.round((ancora.getTime() - ultimoEstudado.getTime()) / 86_400_000) + 1
    : 0;

  return { dias, span, constancia: span > 0 ? dias / span : 0 };
}

export async function streakDetail(ownerId: string): Promise<Sequencia> {
  const rows = await db
    .select({ startedAt: studySessions.startedAt })
    .from(studySessions)
    .where(eq(studySessions.ownerId, ownerId));

  // Bucketed in JS rather than SQL date(): the database session runs in UTC, so
  // date() files an evening session under the next day and silently breaks the
  // streak. Same approach — and the same personal-scale volume argument — as
  // dailyStudyMinutes below.
  const days = new Set(rows.map((r) => toDateKey(r.startedAt)));
  return calcularSequencia(days, new Date());
}

/** Só o número de dias — o que conquistas e currículo consomem. */
export async function currentStreak(ownerId: string): Promise<number> {
  return (await streakDetail(ownerId)).dias;
}

/**
 * Weighted credit a topic contributes to its goal's progress: full for a
 * mastered topic, half while it is being practised. Practising is real
 * advancement, so a bar that ignored it would sit still through the longest
 * part of the work — but it isn't mastery either, which the exam decides.
 *
 * Written as SQL so the two callers (a single goal, and the dashboard's
 * grouped query) can't drift apart on what progress means.
 */
export const earnedWeightSql = sql<number>`coalesce(sum(
  case ${topics.status}
    when 'mastered' then ${topics.weight}::numeric
    when 'praticando' then ${topics.weight}::numeric * ${PRACTICING_CREDIT}
    else 0
  end
), 0)`;

/**
 * Goal progress as the weighted share of topics done, counting practice at
 * half credit. Returns 0..100. Derived, never stored.
 */
export async function goalProgressPct(goalId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${topics.weight}), 0)`,
      earned: earnedWeightSql,
    })
    .from(topics)
    .where(eq(topics.goalId, goalId));

  const total = Number(row?.total ?? 0);
  const earned = Number(row?.earned ?? 0);
  if (total === 0) return 0;
  return Math.round((earned / total) * 100);
}

/**
 * Minutes studied per local calendar day since `since`, keyed "YYYY-MM-DD".
 * Bucketed in JS (not SQL date()) so days align to the user's local timezone,
 * matching how the heatmap grid is built. Volume is personal-scale, so pulling
 * rows and summing here is cheap and timezone-correct.
 */
export async function dailyStudyMinutes(
  ownerId: string,
  since: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      startedAt: studySessions.startedAt,
      durationMin: studySessions.durationMin,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.ownerId, ownerId),
        gte(studySessions.startedAt, since),
      ),
    );

  const map = new Map<string, number>();
  for (const r of rows) {
    const key = toDateKey(r.startedAt);
    map.set(key, (map.get(key) ?? 0) + r.durationMin);
  }
  return map;
}
