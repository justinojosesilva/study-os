import { notFound } from "next/navigation";
import { scoped } from "@/domain/auth";
import { getLessonForReading } from "@/domain/lessons/repository";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { LessonContent } from "@/app/_components/LessonContent";
import { FloatingSessionLogger } from "@/app/_components/FloatingSessionLogger";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return scoped(async (ownerId) => {
    const lesson = await getLessonForReading(ownerId, id);
    if (!lesson) notFound();

    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12">
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
        <LessonContent content={lesson.content} />

        <FloatingSessionLogger topicId={lesson.topicId} topicTitle={lesson.topicTitle} />
      </main>
    );
  });
}
