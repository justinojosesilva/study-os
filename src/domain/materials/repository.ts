import { db } from "@/infra/db/client";
import {
  materials,
  goals,
  studySessions,
  lessons,
  type NewMaterial,
  type Material,
} from "@/infra/db/schema";
import { and, eq, asc, sql, isNotNull } from "drizzle-orm";

export async function listMaterialsForGoal(ownerId: string, goalId: string) {
  return db
    .select()
    .from(materials)
    .where(and(eq(materials.ownerId, ownerId), eq(materials.goalId, goalId)))
    .orderBy(asc(materials.createdAt));
}

export type MaterialWithGoal = {
  id: string;
  goalId: string | null;
  goalTitle: string | null;
  type: Material["type"];
  title: string;
  url: string | null;
  progressPct: number;
};

/** All of the user's materials with their goal name (null = unattached). */
export async function listAllMaterials(ownerId: string): Promise<MaterialWithGoal[]> {
  return db
    .select({
      id: materials.id,
      goalId: materials.goalId,
      goalTitle: goals.title,
      type: materials.type,
      title: materials.title,
      url: materials.url,
      progressPct: materials.progressPct,
    })
    .from(materials)
    .leftJoin(goals, eq(materials.goalId, goals.id))
    .where(eq(materials.ownerId, ownerId))
    .orderBy(asc(materials.createdAt));
}

export async function updateMaterial(
  ownerId: string,
  materialId: string,
  fields: { type: Material["type"]; title: string; url: string | null },
) {
  const [row] = await db
    .update(materials)
    .set(fields)
    .where(and(eq(materials.ownerId, ownerId), eq(materials.id, materialId)))
    .returning({ id: materials.id });
  return Boolean(row);
}

export async function createMaterial(input: NewMaterial) {
  const [row] = await db.insert(materials).values(input).returning();
  return row;
}

export async function updateMaterialProgress(
  ownerId: string,
  materialId: string,
  progressPct: number,
) {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPct)));
  const [row] = await db
    .update(materials)
    .set({ progressPct: clamped })
    .where(and(eq(materials.ownerId, ownerId), eq(materials.id, materialId)))
    .returning({ id: materials.id });
  return Boolean(row);
}

export async function deleteMaterial(ownerId: string, materialId: string) {
  const [row] = await db
    .delete(materials)
    .where(and(eq(materials.ownerId, ownerId), eq(materials.id, materialId)))
    .returning({ id: materials.id });
  return Boolean(row);
}

/** Posse, para as ações validarem um id vindo do cliente. */
export async function ownsMaterial(ownerId: string, materialId: string) {
  const [row] = await db
    .select({ id: materials.id })
    .from(materials)
    .where(and(eq(materials.ownerId, ownerId), eq(materials.id, materialId)))
    .limit(1);
  return Boolean(row);
}

export type PickerMaterial = {
  id: string;
  title: string;
  type: Material["type"];
  goalTitle: string | null;
};

/**
 * Lista achatada para os seletores de "de onde veio isto" — na sessão e na
 * aula. Mesmo formato do `listTopicsForPicker`, e ordenada por objetivo para
 * que o `<optgroup>` saia agrupado sem trabalho extra no cliente.
 */
export async function listMaterialsForPicker(ownerId: string): Promise<PickerMaterial[]> {
  return db
    .select({
      id: materials.id,
      title: materials.title,
      type: materials.type,
      goalTitle: goals.title,
    })
    .from(materials)
    .leftJoin(goals, eq(materials.goalId, goals.id))
    .where(eq(materials.ownerId, ownerId))
    .orderBy(asc(goals.title), asc(materials.createdAt));
}

export type MaterialUsage = {
  sessions: number;
  minutes: number;
  lessons: number;
  lastStudiedAt: Date | null;
};

/**
 * O que o material RENDEU, derivado na leitura — nada disso é armazenado.
 *
 * Deliberadamente não devolve porcentagem: para isso seria preciso saber o
 * tamanho total do curso, que só o dono sabe (ele está dentro do player). O
 * sistema sabe horas e artefatos; "4h20 · 6 sessões · 3 aulas" é informação
 * real, "47%" seria um número com aparência de precisão. A barra manual
 * continua existindo para o que só o dono sabe.
 *
 * Duas consultas agregadas em vez de um join: somar duração e contar aulas na
 * mesma consulta multiplicaria as linhas e inflaria os minutos.
 */
export async function materialUsage(ownerId: string): Promise<Map<string, MaterialUsage>> {
  const [bySession, byLesson] = await Promise.all([
    db
      .select({
        materialId: studySessions.materialId,
        sessions: sql<number>`count(*)::int`,
        minutes: sql<number>`coalesce(sum(${studySessions.durationMin}), 0)::int`,
        lastStudiedAt: sql<Date | null>`max(${studySessions.startedAt})`,
      })
      .from(studySessions)
      .where(and(eq(studySessions.ownerId, ownerId), isNotNull(studySessions.materialId)))
      .groupBy(studySessions.materialId),
    db
      .select({
        materialId: lessons.materialId,
        lessons: sql<number>`count(*)::int`,
      })
      .from(lessons)
      .where(and(eq(lessons.ownerId, ownerId), isNotNull(lessons.materialId)))
      .groupBy(lessons.materialId),
  ]);

  const map = new Map<string, MaterialUsage>();
  const entry = (id: string) =>
    map.get(id) ?? { sessions: 0, minutes: 0, lessons: 0, lastStudiedAt: null };

  for (const r of bySession) {
    if (!r.materialId) continue;
    map.set(r.materialId, {
      ...entry(r.materialId),
      sessions: r.sessions,
      minutes: r.minutes,
      lastStudiedAt: r.lastStudiedAt ? new Date(r.lastStudiedAt) : null,
    });
  }
  for (const r of byLesson) {
    if (!r.materialId) continue;
    map.set(r.materialId, { ...entry(r.materialId), lessons: r.lessons });
  }
  return map;
}
