import { db } from "@/infra/db/client";
import { goals, topics, type NewGoal, type Goal } from "@/infra/db/schema";
import { and, eq, asc } from "drizzle-orm";

/**
 * Reference repository. Every query is scoped by ownerId — that scoping is
 * what makes the personal app multi-tenant-ready without a rewrite.
 */

export async function listGoals(ownerId: string) {
  return db
    .select()
    .from(goals)
    .where(eq(goals.ownerId, ownerId))
    .orderBy(asc(goals.createdAt));
}

export async function getGoalWithTopics(ownerId: string, goalId: string) {
  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.ownerId, ownerId), eq(goals.id, goalId)))
    .limit(1);

  if (!goal) return null;

  const goalTopics = await db
    .select()
    .from(topics)
    .where(eq(topics.goalId, goalId))
    .orderBy(asc(topics.sortOrder));

  return { ...goal, topics: goalTopics };
}

export async function createGoal(input: NewGoal) {
  const [created] = await db.insert(goals).values(input).returning();
  return created;
}

type EditableGoalFields = {
  title: string;
  why: string | null;
  category: Goal["category"];
  targetDate: Date | null;
};

export async function updateGoal(
  ownerId: string,
  goalId: string,
  fields: EditableGoalFields,
): Promise<string | null> {
  const [row] = await db
    .update(goals)
    .set(fields)
    .where(and(eq(goals.ownerId, ownerId), eq(goals.id, goalId)))
    .returning({ id: goals.id });
  return row?.id ?? null;
}

export async function setGoalStatus(
  ownerId: string,
  goalId: string,
  status: Goal["status"],
): Promise<string | null> {
  const [row] = await db
    .update(goals)
    .set({ status })
    .where(and(eq(goals.ownerId, ownerId), eq(goals.id, goalId)))
    .returning({ id: goals.id });
  return row?.id ?? null;
}

export async function ownsGoal(ownerId: string, goalId: string) {
  const [row] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.ownerId, ownerId), eq(goals.id, goalId)))
    .limit(1);
  return Boolean(row);
}

/** Active goals as lightweight options for pickers. */
export async function listActiveGoalOptions(ownerId: string) {
  return db
    .select({ id: goals.id, title: goals.title })
    .from(goals)
    .where(and(eq(goals.ownerId, ownerId), eq(goals.status, "active")))
    .orderBy(asc(goals.title));
}

export async function listArchivedGoals(ownerId: string) {
  return db
    .select({ id: goals.id, title: goals.title, category: goals.category })
    .from(goals)
    .where(and(eq(goals.ownerId, ownerId), eq(goals.status, "archived")))
    .orderBy(asc(goals.title));
}
