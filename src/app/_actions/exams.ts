"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import { getGoalWithTopics } from "@/domain/goals/repository";
import { generateExam } from "@/domain/ai/examGen";
import { generateQuiz } from "@/domain/ai/quizGen";
import {
  createExam,
  getQuizMaterial,
  submitExam,
  deleteExam,
  type GradedResult,
  type NewQuestionInput,
} from "@/domain/exams/repository";

export type GenerateExamResult =
  | { ok: true; examId: string; mocked: boolean }
  | { ok: false; error: string };

const QUESTION_COUNT = 8;

export async function generateExamAction(goalId: string): Promise<GenerateExamResult> {
  // Read tenant context in a short RLS-scoped transaction, then call the AI
  // outside it — the model call is slow and must not hold a DB transaction.
  const goal = await scoped((ownerId) => getGoalWithTopics(ownerId, goalId));
  if (!goal) return { ok: false, error: "Objetivo não encontrado." };

  const res = await generateExam(goal, QUESTION_COUNT);
  if (!res.ok) return { ok: false, error: res.error };

  // Map the AI's topic titles back onto real topic ids — that link is what
  // makes a wrong answer actionable. A title we can't match still becomes a
  // question, it just can't demote a topic.
  const byTitle = new Map(goal.topics.map((t) => [t.title.toLowerCase(), t.id]));
  const questions: NewQuestionInput[] = res.data.questions
    .filter((q) => q.options.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.options.length)
    .map((q) => ({
      topicId: byTitle.get(q.topicTitle.toLowerCase()) ?? null,
      topicTitle: q.topicTitle,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    }));

  if (questions.length === 0) {
    return { ok: false, error: "A IA não retornou questões válidas. Tente novamente." };
  }

  const exam = await scoped((ownerId) => createExam(ownerId, goalId, questions));
  revalidatePath(`/goals/${goalId}`);
  return { ok: true, examId: exam.id, mocked: res.mocked };
}

export type SubmitExamResult =
  | { ok: true; result: GradedResult }
  | { ok: false; error: string };

export async function submitExamAction(
  examId: string,
  goalId: string,
  answers: Record<string, number>,
): Promise<SubmitExamResult> {
  return scoped(async (ownerId) => {
    const result = await submitExam(ownerId, examId, answers, null);
    if (!result) return { ok: false, error: "Prova não encontrada ou já entregue." };
    revalidatePath(`/goals/${goalId}`);
    revalidatePath(`/exams/${examId}`);
    return { ok: true, result };
  });
}

export async function deleteExamAction(examId: string, goalId: string) {
  return scoped(async (ownerId) => {
    const ok = await deleteExam(ownerId, examId);
    if (ok) revalidatePath(`/goals/${goalId}`);
    return { ok };
  });
}

const QUIZ_QUESTION_COUNT = 8;

/**
 * Builds a quiz for one topic from its own material. Follows the project's AI
 * pattern: read context in a scoped transaction, call the model outside it,
 * write back scoped.
 */
export async function generateQuizAction(topicId: string): Promise<GenerateExamResult> {
  const material = await scoped((ownerId) => getQuizMaterial(ownerId, topicId));
  if (!material) return { ok: false, error: "Tópico não encontrado." };

  const res = await generateQuiz(
    {
      topicTitle: material.topicTitle,
      goalTitle: material.goalTitle,
      lessons: material.lessons,
      flashcards: material.flashcards,
      tutorAnswers: material.tutorAnswers,
      notes: material.notes,
    },
    QUIZ_QUESTION_COUNT,
  );
  if (!res.ok) return { ok: false, error: res.error };

  // Every question belongs to this topic, so grading can promote it directly.
  const questions: NewQuestionInput[] = res.data.questions
    .filter((q) => q.options.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.options.length)
    .map((q) => ({
      topicId,
      topicTitle: material.topicTitle,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    }));

  if (questions.length === 0) {
    return { ok: false, error: "A IA não retornou questões válidas. Tente novamente." };
  }

  const exam = await scoped((ownerId) =>
    createExam(ownerId, material.goalId, questions, topicId),
  );
  revalidatePath(`/goals/${material.goalId}`);
  return { ok: true, examId: exam.id, mocked: res.mocked };
}
