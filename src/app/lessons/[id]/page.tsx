import { notFound } from "next/navigation";
import { Library } from "lucide-react";
import { scoped } from "@/domain/auth";
import { getLessonForReading } from "@/domain/lessons/repository";
import { getProgress } from "@/domain/reading/repository";
import { listNotesForLesson } from "@/domain/notes/repository";
import { extractHeadings, readingMinutes } from "@/lib/headings";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { LessonReader } from "@/app/_components/LessonReader";
import { FloatingSessionLogger } from "@/app/_components/FloatingSessionLogger";
import { LessonDoneButton } from "@/app/_components/LessonDoneButton";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return scoped(async (ownerId) => {
    const lesson = await getLessonForReading(ownerId, id);
    if (!lesson) notFound();

    // Headings and reading time are derived from the markdown on the server:
    // the client already has ~85k characters to render without also parsing
    // them twice to build an index.
    const [progress, anchoredNotes] = await Promise.all([
      getProgress(ownerId, id),
      listNotesForLesson(ownerId, id),
    ]);
    const headings = extractHeadings(lesson.content);
    const minutes = readingMinutes(lesson.content);

    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: lesson.goalTitle, href: `/goals/${lesson.goalId}` },
            { label: lesson.title },
          ]}
        />
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
          {lesson.topicTitle}
        </p>
        {/* Sem material, o h1 carrega o espaçamento original em vez de um
            espaçador vazio. Medido: dá no mesmo (as margens colapsam), então é
            só clareza — a maioria das aulas é anterior ao vínculo e cai aqui. */}
        <h1
          className={`text-2xl font-medium tracking-tight ${
            lesson.materialTitle ? "mb-2" : "mb-8"
          }`}
        >
          {lesson.title}
        </h1>

        {/* De onde esta aula saiu. Antes do vínculo não havia resposta para
            "isso veio de onde?" — a aula existia solta. */}
        {lesson.materialTitle && (
          <p className="mb-8 flex items-center gap-1.5 text-xs text-muted">
            <Library size={13} className="shrink-0 text-faint" />
            <span className="text-faint">de</span>
            {lesson.materialUrl ? (
              <a
                href={lesson.materialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-profissional hover:underline"
              >
                {lesson.materialTitle}
              </a>
            ) : (
              <span>{lesson.materialTitle}</span>
            )}
          </p>
        )}
        <LessonReader
          lessonId={lesson.id}
          topicId={lesson.topicId}
          goalId={lesson.goalId}
          anchoredNotes={anchoredNotes}
          content={lesson.content}
          headings={headings}
          minutes={minutes}
          initialPercent={progress?.percent ?? 0}
          initialAnchor={progress?.anchorSlug ?? null}
        />

        <LessonDoneButton
          lessonId={lesson.id}
          goalId={lesson.goalId}
          completedAt={lesson.completedAt}
        />

        <FloatingSessionLogger topicId={lesson.topicId} topicTitle={lesson.topicTitle} />
      </main>
    );
  });
}
