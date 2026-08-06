import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { runAsOwner } from "@/infra/db/client";
import { resolvePublicResume } from "@/domain/resume/repository";
import { getResumeData } from "@/domain/resume/data";
import { getCareerData } from "@/domain/resume/career";
import { ResumeSheet } from "@/app/_components/ResumeSheet";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await resolvePublicResume(slug);
  if (!profile) return { title: "Currículo" };
  const name = profile.contact?.name ?? "Currículo";
  return {
    title: `${name} — Currículo`,
    description: profile.headline ?? undefined,
    robots: { index: false }, // shared link, not meant to be crawled
  };
}

export default async function PublicResumePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // The single public-read seam: adminDb resolves the slug (published only)…
  const profile = await resolvePublicResume(slug);
  if (!profile) notFound();

  // …then derived data is read under normal RLS, scoped to that owner.
  const [data, career] = await runAsOwner(profile.ownerId, () =>
    Promise.all([getResumeData(profile.ownerId), getCareerData(profile.ownerId)]),
  );

  return (
    <main className="min-h-screen bg-canvas px-5 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <ResumeSheet
          headline={profile.headline ?? ""}
          summary={profile.summary ?? ""}
          contact={profile.contact ?? {}}
          highlights={profile.highlights ?? []}
          data={data}
          career={career}
          showStats={false}
        />
        <p className="mt-4 text-center text-xs text-faint">
          Feito com <span className="font-medium text-muted">Study OS</span>
        </p>
      </div>
    </main>
  );
}
