import { randomBytes } from "crypto";
import { db, adminDb } from "@/infra/db/client";
import {
  resumeProfiles,
  users,
  type ResumeProfile,
  type ResumeContact,
} from "@/infra/db/schema";
import { and, eq } from "drizzle-orm";

export type ResumeProfileFields = {
  headline: string | null;
  summary: string | null;
  targetRole: string | null;
  contact: ResumeContact | null;
  highlights: string[] | null;
};

export async function getResumeProfile(ownerId: string): Promise<ResumeProfile | null> {
  const [row] = await db
    .select()
    .from(resumeProfiles)
    .where(eq(resumeProfiles.ownerId, ownerId))
    .limit(1);
  return row ?? null;
}

/** One profile per user; created lazily, prefilled from the users identity row. */
export async function getOrCreateResumeProfile(ownerId: string): Promise<ResumeProfile> {
  const existing = await getResumeProfile(ownerId);
  if (existing) return existing;

  const [u] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  const [created] = await db
    .insert(resumeProfiles)
    .values({
      ownerId,
      contact: { name: u?.name ?? undefined, email: u?.email ?? undefined },
    })
    .returning();
  return created;
}

export async function updateResumeProfile(
  ownerId: string,
  fields: Partial<ResumeProfileFields>,
) {
  await getOrCreateResumeProfile(ownerId); // ensure a row exists
  const [row] = await db
    .update(resumeProfiles)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(resumeProfiles.ownerId, ownerId))
    .returning({ id: resumeProfiles.id });
  return Boolean(row);
}

/** Unguessable, URL-safe slug (~11 chars) to prevent enumeration. */
function makeSlug(): string {
  return randomBytes(8).toString("base64url");
}

/** Toggle public sharing; mints a slug the first time it goes public. */
export async function setResumePublic(
  ownerId: string,
  isPublic: boolean,
): Promise<{ isPublic: boolean; slug: string | null }> {
  const profile = await getOrCreateResumeProfile(ownerId);
  const slug = isPublic ? (profile.publicSlug ?? makeSlug()) : profile.publicSlug;
  await db
    .update(resumeProfiles)
    .set({ isPublic, publicSlug: slug, updatedAt: new Date() })
    .where(eq(resumeProfiles.ownerId, ownerId));
  return { isPublic, slug };
}

export type PublicResume = {
  ownerId: string;
  headline: string | null;
  summary: string | null;
  contact: ResumeContact | null;
  highlights: string[] | null;
};

/**
 * Resolve a public slug to a résumé. Uses adminDb to bypass RLS for this ONE
 * read, strictly filtered to published rows — the only public-read seam. The
 * caller then loads the owner's derived data via runAsOwner (normal RLS).
 */
export async function resolvePublicResume(slug: string): Promise<PublicResume | null> {
  if (!slug) return null;
  const [row] = await adminDb
    .select({
      ownerId: resumeProfiles.ownerId,
      headline: resumeProfiles.headline,
      summary: resumeProfiles.summary,
      contact: resumeProfiles.contact,
      highlights: resumeProfiles.highlights,
    })
    .from(resumeProfiles)
    .where(and(eq(resumeProfiles.publicSlug, slug), eq(resumeProfiles.isPublic, true)))
    .limit(1);
  return row ?? null;
}
