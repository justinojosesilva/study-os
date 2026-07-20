import "dotenv/config";
import { adminDb as db } from "../src/infra/db/client";
import { flashcards, flashcardReviews, users } from "../src/infra/db/schema";
import { eq, sql } from "drizzle-orm";
import { newCard, scheduleNext, cardToColumns } from "../src/domain/reviews/scheduler";
import type { Grade } from "ts-fsrs";

/**
 * DEMO ONLY: simulates real FSRS review chains over the past ~2 weeks so the
 * review stats have data. Idempotent — skips if any review already exists.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

async function resolveOwnerId(): Promise<string> {
  if (process.env.DEV_OWNER_ID) return process.env.DEV_OWNER_ID;
  const [u] = await db.select({ id: users.id }).from(users).limit(1);
  if (!u) throw new Error("No user found. Run `npm run db:seed` first.");
  return u.id;
}

async function main() {
  const ownerId = await resolveOwnerId();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(flashcardReviews)
    .where(eq(flashcardReviews.ownerId, ownerId));
  if (Number(count) > 0) {
    console.log("Backfill já aplicado (há reviews). Pulando.");
    process.exit(0);
  }

  const cards = await db
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(eq(flashcards.ownerId, ownerId));

  const rand = rng(7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows: (typeof flashcardReviews.$inferInsert)[] = [];

  for (const c of cards) {
    const cur = new Date(today);
    cur.setDate(cur.getDate() - (8 + Math.floor(rand() * 6))); // start 8–13 days ago
    let card = newCard(cur);

    for (let rep = 0; rep < 6; rep++) {
      const x = rand();
      const rating = (x < 0.1 ? 1 : x < 0.3 ? 2 : x < 0.8 ? 3 : 4) as Grade;
      const reviewedAt = new Date(cur);
      reviewedAt.setHours(9 + Math.floor(rand() * 10), Math.floor(rand() * 60));

      const next = scheduleNext(card, rating, reviewedAt);
      rows.push({ ownerId, flashcardId: c.id, rating, reviewedAt, ...cardToColumns(next) });
      card = next;

      const nextDue = new Date(next.due);
      if (nextDue.getTime() > today.getTime()) break; // due is in the future → stop
      cur.setTime(nextDue.getTime());
    }
  }

  await db.insert(flashcardReviews).values(rows);
  console.log(`Backfill: ${rows.length} reviews para ${cards.length} cards.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
