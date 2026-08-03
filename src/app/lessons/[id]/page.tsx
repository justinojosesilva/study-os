import { notFound } from "next/navigation";
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
        <h1 className="mb-8 text-2xl font-medium tracking-tight">{lesson.title}</h1>
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
