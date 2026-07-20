import "dotenv/config";
import { adminDb as db } from "../src/infra/db/client";
import {
  users,
  goals,
  topics,
  studySessions,
  certifications,
} from "../src/infra/db/schema";

/**
 * Idempotent-ish dev seed: creates one user and a sample goal with topics and
 * a few study sessions, then prints the user id to paste into DEV_OWNER_ID.
 */
async function main() {
  const [user] = await db
    .insert(users)
    .values({ email: "justino@studyos.dev", name: "Justino" })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: "Justino" },
    })
    .returning();

  const [goal] = await db
    .insert(goals)
    .values({
      ownerId: user.id,
      title: "Certificação AWS Solutions Architect",
      why: "Crescimento de carreira e validação cloud no currículo",
      category: "profissional",
      targetDate: new Date("2026-12-01"),
    })
    .returning();

  const seededTopics = await db
    .insert(topics)
    .values([
      { ownerId: user.id, goalId: goal.id, title: "IAM", status: "mastered", weight: 2, sortOrder: 0 },
      { ownerId: user.id, goalId: goal.id, title: "S3", status: "mastered", weight: 2, sortOrder: 1 },
      { ownerId: user.id, goalId: goal.id, title: "EC2", status: "learning", weight: 3, sortOrder: 2 },
      { ownerId: user.id, goalId: goal.id, title: "VPC", status: "todo", weight: 3, sortOrder: 3 },
      { ownerId: user.id, goalId: goal.id, title: "Lambda", status: "todo", weight: 2, sortOrder: 4 },
    ])
    .returning();

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  await db.insert(certifications).values({
    ownerId: user.id,
    goalId: goal.id,
    title: "AWS Certified Solutions Architect – Associate",
    provider: "AWS",
    code: "SAA-C03",
    status: "scheduled",
    examDate: new Date(now + 45 * day),
    costCents: 15000,
  });

  await db.insert(studySessions).values([
    { ownerId: user.id, topicId: seededTopics[0].id, startedAt: new Date(now - 2 * day), durationMin: 90, comprehension: 8, notes: "Policies e roles" },
    { ownerId: user.id, topicId: seededTopics[1].id, startedAt: new Date(now - 1 * day), durationMin: 60, comprehension: 7, notes: "Lifecycle e versioning" },
    { ownerId: user.id, topicId: seededTopics[2].id, startedAt: new Date(now), durationMin: 45, comprehension: 6, notes: "Tipos de instância" },
  ]);

  console.log("\n  Seed completo.");
  console.log("  Cole isto no seu .env:\n");
  console.log(`  DEV_OWNER_ID="${user.id}"\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
