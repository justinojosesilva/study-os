import { db } from "@/infra/db/client";
import {
  certifications,
  goals,
  topics,
  type NewCertification,
  type Certification,
} from "@/infra/db/schema";
import { and, eq, asc, sql } from "drizzle-orm";

export type CertStatus = Certification["status"];

/** A certification enriched with its linked goal name and derived exam
 *  readiness = the goal's mastered-weight %. `readinessPct` is null when the
 *  cert isn't linked to a goal (or the goal has no weighted topics yet). */
export type CertificationView = {
  id: string;
  goalId: string | null;
  goalTitle: string | null;
  title: string;
  provider: string;
  code: string | null;
  status: CertStatus;
  examDate: Date | null;
  obtainedDate: Date | null;
  expiresDate: Date | null;
  score: string | null;
  costCents: number | null;
  credentialUrl: string | null;
  notes: string | null;
  readinessPct: number | null;
};

// Readiness derives from the linked goal's topics, aggregated in-query.
const readinessSelect = {
  id: certifications.id,
  goalId: certifications.goalId,
  goalTitle: goals.title,
  title: certifications.title,
  provider: certifications.provider,
  code: certifications.code,
  status: certifications.status,
  examDate: certifications.examDate,
  obtainedDate: certifications.obtainedDate,
  expiresDate: certifications.expiresDate,
  score: certifications.score,
  costCents: certifications.costCents,
  credentialUrl: certifications.credentialUrl,
  notes: certifications.notes,
  totalWeight: sql<number>`coalesce(sum(${topics.weight}), 0)`,
  masteredWeight: sql<number>`coalesce(sum(case when ${topics.status} = 'mastered' then ${topics.weight} else 0 end), 0)`,
} as const;

function toView(r: {
  totalWeight: number;
  masteredWeight: number;
} & Omit<CertificationView, "readinessPct">): CertificationView {
  const total = Number(r.totalWeight);
  const mastered = Number(r.masteredWeight);
  const { totalWeight: _tw, masteredWeight: _mw, ...rest } = r;
  return {
    ...rest,
    readinessPct: r.goalId && total > 0 ? Math.round((mastered / total) * 100) : null,
  };
}

export async function listCertifications(ownerId: string): Promise<CertificationView[]> {
  const rows = await db
    .select(readinessSelect)
    .from(certifications)
    .leftJoin(goals, eq(certifications.goalId, goals.id))
    .leftJoin(topics, eq(topics.goalId, goals.id))
    .where(eq(certifications.ownerId, ownerId))
    .groupBy(certifications.id, goals.title)
    .orderBy(asc(certifications.createdAt));

  return rows.map(toView);
}

/** The soonest still-pending exam with a future date — for the dashboard nudge. */
export async function getUpcomingExam(ownerId: string): Promise<CertificationView | null> {
  const rows = await db
    .select(readinessSelect)
    .from(certifications)
    .leftJoin(goals, eq(certifications.goalId, goals.id))
    .leftJoin(topics, eq(topics.goalId, goals.id))
    .where(
      and(
        eq(certifications.ownerId, ownerId),
        sql`${certifications.status} in ('planned', 'scheduled')`,
        sql`${certifications.examDate} is not null`,
        sql`${certifications.examDate} >= now()`,
      ),
    )
    .groupBy(certifications.id, goals.title)
    .orderBy(asc(certifications.examDate))
    .limit(1);

  return rows[0] ? toView(rows[0]) : null;
}

/** Certs linked to a specific goal — for the goal detail page. */
export async function listCertificationsForGoal(
  ownerId: string,
  goalId: string,
): Promise<CertificationView[]> {
  const rows = await db
    .select(readinessSelect)
    .from(certifications)
    .leftJoin(goals, eq(certifications.goalId, goals.id))
    .leftJoin(topics, eq(topics.goalId, goals.id))
    .where(and(eq(certifications.ownerId, ownerId), eq(certifications.goalId, goalId)))
    .groupBy(certifications.id, goals.title)
    .orderBy(asc(certifications.createdAt));

  return rows.map(toView);
}

export async function createCertification(input: NewCertification) {
  const [row] = await db.insert(certifications).values(input).returning();
  return row;
}

export type CertificationFields = {
  title: string;
  provider: string;
  code: string | null;
  goalId: string | null;
  status: CertStatus;
  examDate: Date | null;
  obtainedDate: Date | null;
  expiresDate: Date | null;
  score: string | null;
  costCents: number | null;
  credentialUrl: string | null;
  notes: string | null;
};

export async function updateCertification(
  ownerId: string,
  certId: string,
  fields: CertificationFields,
) {
  const [row] = await db
    .update(certifications)
    .set(fields)
    .where(and(eq(certifications.ownerId, ownerId), eq(certifications.id, certId)))
    .returning({ id: certifications.id });
  return Boolean(row);
}

/** Quick status change. Marking `passed` stamps obtainedDate if not already set. */
export async function setCertificationStatus(
  ownerId: string,
  certId: string,
  status: CertStatus,
) {
  const set: Partial<Certification> = { status };
  if (status === "passed") set.obtainedDate = new Date();
  const [row] = await db
    .update(certifications)
    .set(set)
    .where(and(eq(certifications.ownerId, ownerId), eq(certifications.id, certId)))
    .returning({ id: certifications.id });
  return Boolean(row);
}

export async function deleteCertification(ownerId: string, certId: string) {
  const [row] = await db
    .delete(certifications)
    .where(and(eq(certifications.ownerId, ownerId), eq(certifications.id, certId)))
    .returning({ id: certifications.id });
  return Boolean(row);
}
