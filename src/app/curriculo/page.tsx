import { FileText } from "lucide-react";
import { scoped } from "@/domain/auth";
import { getOrCreateResumeProfile } from "@/domain/resume/repository";
import { getResumeData } from "@/domain/resume/data";
import { getCareerData } from "@/domain/resume/career";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { ResumeWorkspace } from "@/app/_components/ResumeWorkspace";

export const dynamic = "force-dynamic";

export default async function CurriculoPage() {
  return scoped(async (ownerId) => {
    const [profile, data, career] = await Promise.all([
      getOrCreateResumeProfile(ownerId),
      getResumeData(ownerId),
      getCareerData(ownerId),
    ]);

    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
        <div className="no-print">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Currículo" }]} />

          <div className="mb-6">
            <h1 className="flex items-center gap-2 text-xl font-medium">
              <FileText size={20} className="text-profissional" />
              Currículo inteligente
            </h1>
            <p className="mt-1 text-sm text-muted">
              Suas competências, certificações e metas viram um currículo — a IA escreve o texto,
              você edita e exporta.
            </p>
          </div>
        </div>

        <ResumeWorkspace
          initial={{
            headline: profile.headline ?? "",
            summary: profile.summary ?? "",
            targetRole: profile.targetRole ?? "",
            contact: profile.contact ?? {},
            highlights: profile.highlights ?? [],
          }}
          initialIsPublic={profile.isPublic}
          initialSlug={profile.publicSlug}
          data={data}
          career={career}
        />
      </main>
    );
  });
}
