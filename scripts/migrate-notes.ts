import "dotenv/config";
import { adminDb as db } from "@/infra/db/client";
import { studySessions, notes } from "@/infra/db/schema";
import { and, isNotNull, sql } from "drizzle-orm";
import { deriveTitle } from "@/domain/notes/repository";

/**
 * Moves what is written in `study_sessions.notes` into the `notes` table.
 *
 * Idempotent: a session whose note already exists is skipped, so running it
 * twice cannot duplicate anything. Runs as the owner (adminDb), like the other
 * scripts — there is no request context to scope by.
 *
 * Read-only on `study_sessions`: the column is dropped by a LATER migration,
 * only after the copy has been eyeballed. Until then both copies coexist and
 * the old one is simply ignored by the app.
 *
 *   npm run db:migrate-notes          # copy
 *   npm run db:migrate-notes -- --check   # report only, write nothing
 */
async function main() {
  const checkOnly = process.argv.includes("--check");

  const rows = await db
    .select({
      id: studySessions.id,
      ownerId: studySessions.ownerId,
      topicId: studySessions.topicId,
      startedAt: studySessions.startedAt,
      notes: studySessions.notes,
    })
    .from(studySessions)
    .where(and(isNotNull(studySessions.notes), sql`length(trim(${studySessions.notes})) > 0`));

  const existing = await db.select({ sessionId: notes.sessionId }).from(notes);
  const done = new Set(existing.map((e) => e.sessionId).filter(Boolean) as string[]);

  const pending = rows.filter((r) => !done.has(r.id));
  console.log(
    `sessões com anotação: ${rows.length} | já migradas: ${rows.length - pending.length} | pendentes: ${pending.length}`,
  );

  if (checkOnly) {
    for (const r of pending) {
      console.log(`  · ${r.startedAt.toISOString().slice(0, 10)} ${String(r.notes!.length).padStart(5)} chars  ${deriveTitle(r.notes!)}`);
    }
    process.exit(0);
  }

  for (const r of pending) {
    const content = r.notes!.trim();
    await db.insert(notes).values({
      ownerId: r.ownerId,
      topicId: r.topicId,
      sessionId: r.id,
      title: deriveTitle(content),
      content,
      // The note keeps the session's moment, not the moment of the copy.
      createdAt: r.startedAt,
      updatedAt: r.startedAt,
    });
    console.log(`  ✓ ${r.startedAt.toISOString().slice(0, 10)} ${deriveTitle(content)}`);
  }

  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(notes);
  console.log(`total em notes agora: ${Number(n)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
