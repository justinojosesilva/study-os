import { Sparkles } from "lucide-react";
import { getCurrentUserId } from "@/domain/auth";
import { RoadmapMentor } from "@/app/_components/RoadmapMentor";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function MentorPage() {
  await getCurrentUserId(); // gate

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Mentor" }]} />

      <h1 className="flex items-center gap-2 text-xl font-medium">
        <Sparkles size={20} className="text-certificacao" />
        Mentor de carreira
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Descreva onde você quer chegar e a IA monta um roadmap de estudo por fases — pronto
        para virar um objetivo com um clique.
      </p>

      <RoadmapMentor />
    </main>
  );
}
