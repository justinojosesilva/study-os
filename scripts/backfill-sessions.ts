import "dotenv/config";
import { adminDb as db } from "../src/infra/db/client";
import { studySessions, topics, users } from "../src/infra/db/schema";
import { and, eq, lte, sql } from "drizzle-orm";

/** Owner resolver for scripts (no request context, so no session). */
async function resolveOwnerId(): Promise<string> {
  if (process.env.DEV_OWNER_ID) return process.env.DEV_OWNER_ID;
  const [u] = await db.select({ id: users.id }).from(users).limit(1);
  if (!u) throw new Error("No user found. Run `npm run db:seed` first.");
  return u.id;
}

/**
 * DEMO ONLY: backfills ~5 months of plausible study sessions so the constancy
 * heatmap has something to show. Idempotent — skips if older sessions already
 * exist. Deterministic via a tiny seeded RNG so reruns would be identical.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

async function main() {
  const ownerId = await resolveOwnerId();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 25);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(studySessions)
    .where(and(eq(studySessions.ownerId, ownerId), lte(studySessions.startedAt, cutoff)));
  if (Number(count) > 0) {
    console.log("Backfill já aplicado (há sessões antigas). Pulando.");
    process.exit(0);
  }

  const topicRows = await db
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.ownerId, ownerId));
  const topicIds = topicRows.map((t) => t.id);

  const rand = rng(42);
  const rows: (typeof studySessions.$inferInsert)[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let daysAgo = 175; daysAgo >= 7; daysAgo--) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const dow = date.getDay();
    // study ~70% of weekdays, ~35% of weekends
    const chance = dow === 0 || dow === 6 ? 0.35 : 0.7;
    if (rand() > chance) continue;

    const sessionsToday = rand() < 0.25 ? 2 : 1;
    for (let k = 0; k < sessionsToday; k++) {
      const durationMin = 25 + Math.floor(rand() * 80); // 25–105
      const startedAt = new Date(date);
      startedAt.setHours(9 + Math.floor(rand() * 11), Math.floor(rand() * 60));
      rows.push({
        ownerId,
        topicId: topicIds.length ? topicIds[Math.floor(rand() * topicIds.length)] : null,
        startedAt,
        endedAt: new Date(startedAt.getTime() + durationMin * 60_000),
        durationMin,
        comprehension: 5 + Math.floor(rand() * 5),
        notes: null,
      });
    }
  }

  await db.insert(studySessions).values(rows);
  console.log(`Backfill: ${rows.length} sessões inseridas (histórico de ~6 meses).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
