import { db } from "@/infra/db/client";
import { topics, goals, type NewTopic, type Topic } from "@/infra/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";

export type PickerTopic = {
  id: string;
  title: string;
  goalTitle: string;
};

/** Flat list of the user's topics with their goal name, for a session picker. */
export async function listTopicsForPicker(ownerId: string): Promise<PickerTopic[]> {
  return db
    .select({
      id: topics.id,
      title: topics.title,
      goalTitle: goals.title,
    })
    .from(topics)
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .where(eq(topics.ownerId, ownerId))
    .orderBy(asc(goals.title), asc(topics.sortOrder));
}

export async function createTopic(input: NewTopic): Promise<Topic> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${topics.sortOrder}), -1) + 1` })
    .from(topics)
    .where(eq(topics.goalId, input.goalId));

  const [row] = await db
    .insert(topics)
    .values({ ...input, sortOrder: input.sortOrder ?? Number(next) })
    .returning();
  return row;
}

/** Status mutation, scoped by owner. Returns the goalId for revalidation. */
export async function setTopicStatus(
  ownerId: string,
  topicId: string,
  status: Topic["status"],
): Promise<string | null> {
  const [row] = await db
    .update(topics)
    .set({ status })
    .where(and(eq(topics.ownerId, ownerId), eq(topics.id, topicId)))
    .returning({ goalId: topics.goalId });
  return row?.goalId ?? null;
}

export async function deleteTopic(
  ownerId: string,
  topicId: string,
): Promise<string | null> {
  const [row] = await db
    .delete(topics)
    .where(and(eq(topics.ownerId, ownerId), eq(topics.id, topicId)))
    .returning({ goalId: topics.goalId });
  return row?.goalId ?? null;
}

/**
 * Applies a phase grouping to a goal's topics.
 *
 * Rewrites `sortOrder` to follow the phase sequence, so listing by sortOrder
 * alone reproduces both the order of the phases and the order inside each —
 * no second column and no sort key to keep in sync. Titles that don't match a
 * topic are ignored, and topics the grouping missed keep their phase untouched.
 */
export async function applyPhases(
  ownerId: string,
  goalId: string,
  phases: { name: string; topics: string[] }[],
): Promise<number> {
  const existing = await db
    .select({ id: topics.id, title: topics.title })
    .from(topics)
    .where(and(eq(topics.ownerId, ownerId), eq(topics.goalId, goalId)));

  const byTitle = new Map(existing.map((t) => [t.title.trim().toLowerCase(), t.id]));

  let order = 0;
  let updated = 0;
  await db.transaction(async (tx) => {
    for (const phase of phases) {
      const name = phase.name.trim();
      if (!name) continue;
      for (const rawTitle of phase.topics) {
        const id = byTitle.get(rawTitle.trim().toLowerCase());
        if (!id) continue;
        await tx
          .update(topics)
          .set({ phase: name, sortOrder: order++ })
          .where(and(eq(topics.ownerId, ownerId), eq(topics.id, id)));
        updated += 1;
      }
    }
  });

  return updated;
}

/**
 * Moves a topic to another phase (or out of any phase, with null).
 *
 * Also renumbers the goal's `sortOrder`, which is load-bearing: the phase
 * sequence on screen is derived from it, so a topic keeping a low sort order
 * while jumping to a late phase would drag that whole phase to the top. The
 * moved topic lands at the end of its new phase, and the existing order of the
 * phases is preserved.
 */
export async function setTopicPhase(
  ownerId: string,
  topicId: string,
  phase: string | null,
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ goalId: topics.goalId })
      .from(topics)
      .where(and(eq(topics.ownerId, ownerId), eq(topics.id, topicId)))
      .limit(1);
    if (!target) return null;

    const all = await tx
      .select({ id: topics.id, phase: topics.phase })
      .from(topics)
      .where(and(eq(topics.ownerId, ownerId), eq(topics.goalId, target.goalId)))
      .orderBy(asc(topics.sortOrder));

    const next = phase?.trim() || null;

    // Phase order as it stands today, ignoring the topic being moved so a
    // single move can't invent a new position for its old phase.
    const order: (string | null)[] = [];
    for (const t of all) {
      if (t.id === topicId) continue;
      const key = t.phase?.trim() || null;
      if (!order.includes(key)) order.push(key);
    }
    if (!order.includes(next)) order.push(next);

    // Ungrouped always sits last — it's a staging area, not a stage.
    order.sort((a, b) => (a === null ? 1 : b === null ? -1 : 0));

    let sort = 0;
    for (const key of order) {
      const members = all.filter(
        (t) => t.id !== topicId && (t.phase?.trim() || null) === key,
      );
      for (const m of members) {
        await tx.update(topics).set({ sortOrder: sort++ }).where(eq(topics.id, m.id));
      }
      // The moved topic joins the end of its destination.
      if (key === next) {
        await tx
          .update(topics)
          .set({ phase: next, sortOrder: sort++ })
          .where(eq(topics.id, topicId));
      }
    }

    return target.goalId;
  });
}
