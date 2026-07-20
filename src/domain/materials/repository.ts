import { db } from "@/infra/db/client";
import { materials, goals, type NewMaterial, type Material } from "@/infra/db/schema";
import { and, eq, asc } from "drizzle-orm";

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
