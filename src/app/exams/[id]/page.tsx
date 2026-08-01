import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { scoped } from "@/domain/auth";
import { getExam } from "@/domain/exams/repository";
import { PASS_PCT } from "@/lib/progress";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { ExamRunner } from "@/app/_components/ExamRunner";

export const dynamic = "force-dynamic";

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return scoped(async (ownerId) => {
    const exam = await getExam(ownerId, id);
    if (!exam) notFound();

    // A topic quiz and the goal's exam share this screen; only the framing
    // differs, and calling a quiz "Prova" would misrepresent its scope.
    const quiz = exam.topicId !== null;
    const topicName = exam.questions[0]?.topicTitle ?? exam.goalTitle;

    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/" },
            { label: exam.goalTitle, href: `/goals/${exam.goalId}` },
            { label: quiz ? "Questionário" : "Prova" },
          ]}
        />

        <h1 className="mb-1 flex items-center gap-2 text-xl font-medium">
          <GraduationCap size={20} className="text-profissional" />
          {quiz ? `Questionário · ${topicName}` : `Prova · ${exam.goalTitle}`}
        </h1>
        <p className="mb-6 text-sm text-muted">
          {exam.completedAt
            ? `${quiz ? "Questionário" : "Prova"} entregue — revise as respostas e explicações abaixo.`
            : `Responda todas as questões. A partir de ${PASS_PCT}% o tópico é promovido a dominado; abaixo disso ele volta um passo.`}
        </p>

        <ExamRunner
          examId={exam.id}
          goalId={exam.goalId}
          questions={exam.questions}
          initialResult={exam.scorePct !== null ? { scorePct: exam.scorePct } : null}
        />
      </main>
    );
  });
}
