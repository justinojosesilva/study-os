"use server";

import { revalidatePath } from "next/cache";
import { scoped, getCurrentUserId } from "@/domain/auth";
import { runAsOwner } from "@/infra/db/client";
import { updateResumeProfile, setResumePublic } from "@/domain/resume/repository";
import { getResumeData } from "@/domain/resume/data";
import { getCareerData } from "@/domain/resume/career";
import { generateResumeContent, type ResumeContent } from "@/domain/ai/resume";
import type { ResumeContact } from "@/infra/db/schema";

export type SaveInput = {
  headline: string;
  summary: string;
  targetRole: string;
  contact: ResumeContact;
  highlights: string[];
};

export type ActionResult = { ok: true } | { ok: false; error: string };

function clean(v: string): string | null {
  const s = v.trim();
  return s || null;
}

export async function saveResumeAction(input: SaveInput): Promise<ActionResult> {
  return scoped(async (ownerId) => {
    const contact: ResumeContact = {
      name: clean(input.contact.name ?? "") ?? undefined,
      email: clean(input.contact.email ?? "") ?? undefined,
      location: clean(input.contact.location ?? "") ?? undefined,
      linkedin: clean(input.contact.linkedin ?? "") ?? undefined,
      github: clean(input.contact.github ?? "") ?? undefined,
    };
    await updateResumeProfile(ownerId, {
      headline: clean(input.headline),
      summary: clean(input.summary),
      targetRole: clean(input.targetRole),
      contact,
      highlights: input.highlights.map((h) => h.trim()).filter(Boolean),
    });
    revalidatePath("/curriculo");
    return { ok: true };
  });
}

export type PublishResult =
  { ok: true; isPublic: boolean; slug: string | null } | { ok: false; error: string };

export async function setResumePublicAction(isPublic: boolean): Promise<PublishResult> {
  return scoped(async (ownerId) => {
    const { isPublic: pub, slug } = await setResumePublic(ownerId, isPublic);
    revalidatePath("/curriculo");
    if (slug) revalidatePath(`/r/${slug}`);
    return { ok: true, isPublic: pub, slug };
  });
}

export type GenerateResult =
  { ok: true; data: ResumeContent; mocked: boolean } | { ok: false; error: string };

export async function generateResumeAction(
  targetRole: string,
  jobDescription?: string,
): Promise<GenerateResult> {
  const role = targetRole.trim();
  if (!role) return { ok: false, error: "Informe o cargo-alvo." };

  // Read the user's real data inside the scoped (RLS) transaction; the model
  // call itself happens outside any long-held transaction.
  const ownerId = await getCurrentUserId();
  const { data, career } = await runAsOwner(ownerId, async () => ({
    data: await getResumeData(ownerId),
    career: await getCareerData(ownerId),
  }));
  return generateResumeContent(ownerId, {
    targetRole: role,
    jobDescription,
    data,
    career,
  });
}
