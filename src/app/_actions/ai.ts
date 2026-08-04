"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId, scoped } from "@/domain/auth";
import { saveTutorAnswer } from "@/domain/tutor/repository";
import { proposePhases } from "@/domain/ai/topicPhases";
import { applyPhases } from "@/domain/topics/repository";
import { analyzeGoalGaps, type AnalysisResult } from "@/domain/ai/gapAnalysis";
import { generateRoadmap, type RoadmapResult } from "@/domain/ai/roadmap";
import {
  generateFlashcards,
  type FlashcardGenResult,
} from "@/domain/ai/flashcardGen";
import { askTutor, type TutorMode, type TutorResult } from "@/domain/ai/tutor";
import { createGoal, getGoalWithTopics } from "@/domain/goals/repository";
import { createTopic } from "@/domain/topics/repository";
import { getTopicContext } from "@/domain/flashcards/repository";
import {
  listNotesForTopicWithContent,
  createNote,
  deriveTitle,
} from "@/domain/notes/repository";

// AI actions read tenant context inside a short RLS-scoped transaction, then
// call the model OUTSIDE it — we never hold a DB transaction open across the
// multi-second model round-trip.

export async function analyzeGoalGapsAction(goalId: string): Promise<AnalysisResult> {
  const goal = await scoped((ownerId) => getGoalWithTopics(ownerId, goalId));
  if (!goal) return { ok: false, error: "Objetivo não encontrado." };
  return analyzeGoalGaps(goal);
}

export async function generateRoadmapAction(
  target: string,
  context?: string,
): Promise<RoadmapResult> {
  await getCurrentUserId(); // ensure authenticated; no tenant DB access
  return generateRoadmap(target, context);
}

export async function generateFlashcardsAction(
  topicId: string,
  content?: string,
  strictContent = false,
): Promise<FlashcardGenResult> {
  // `content` is whatever the caller wants turned into cards — pasted text, or
  // the body of one note. No need to gather the topic's other notes here.
  const ctx = await scoped((ownerId) => getTopicContext(ownerId, topicId));
  if (!ctx) return { ok: false, error: "Tópico não encontrado." };
  return generateFlashcards({
    topicTitle: ctx.topicTitle,
    goalTitle: ctx.goalTitle,
    content,
    strictContent,
  });
}

/** Where the question was asked from, when it came out of a lesson passage. */
export type TutorContext = {
  lessonId: string;
  anchorSlug: string | null;
  quote: string;
};

const MODE_LABEL: Record<TutorMode, string> = {
  explain: "Explicação",
  exercises: "Exercícios",
  summary: "Resumo",
};

export async function askTutorAction(
  topicId: string,
  mode: TutorMode,
  question?: string,
  context?: TutorContext,
): Promise<TutorResult> {
  const ctx = await scoped(async (ownerId) => {
    const topic = await getTopicContext(ownerId, topicId);
    if (!topic) return null;
    // The tutor used to answer without ever seeing what the student had
    // already written about the topic.
    const notes = await listNotesForTopicWithContent(ownerId, topicId, 4);
    return { ...topic, notes };
  });
  if (!ctx) return { ok: false, error: "Tópico não encontrado." };

  const asked = question?.trim() || null;

  // The passage is framed HERE, not by the caller. When the client sent an
  // already-framed prompt, that whole preamble travelled as "the question" —
  // the saved note ended up titled "Sobre este trecho da aula:" and carried the
  // quote twice. The model gets the frame; the record keeps what was asked.
  const prompt =
    context?.quote && asked
      ? `Sobre este trecho da aula:\n\n"${context.quote}"\n\n${asked}`
      : context?.quote
        ? `Sobre este trecho da aula:\n\n"${context.quote}"\n\nExplique este trecho.`
        : asked ?? undefined;

  // Read context in a short scoped transaction, call the AI outside it, then
  // write back — the model call is slow and must not hold a DB transaction.
  const res = await askTutor({
    topicTitle: ctx.topicTitle,
    goalTitle: ctx.goalTitle,
    mode,
    question: prompt,
    notes: ctx.notes,
  });

  if (res.ok) {
    // Only the flat log is written here — it is the quiz's raw material and
    // costs nothing. Turning the answer into a NOTE is deliberate, on a button:
    // the tutor gets asked casually, and filing every passing question would
    // bury the syntheses that were written on purpose.
    try {
      await scoped((ownerId) =>
        saveTutorAnswer({ ownerId, topicId, mode, question: asked, answer: res.text }),
      );
    } catch (err) {
      console.error("tutor-save error", err);
    }
  }

  return res;
}

export type SaveTutorNoteResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Files a tutor answer as a note, on demand.
 *
 * The note is the readable artifact — it shows up in the topic's notes, in the
 * search, feeds the quiz as authored material, and can be edited. The answer
 * itself is already in `tutor_answers`; this is the copy the reader keeps.
 */
export async function saveTutorNoteAction(input: {
  topicId: string;
  mode: TutorMode;
  question: string | null;
  answer: string;
  context?: TutorContext;
}): Promise<SaveTutorNoteResult> {
  const { topicId, mode, answer, context } = input;
  const asked = input.question?.trim() || null;
  if (!answer.trim()) return { ok: false, error: "Nada para salvar." };

  return scoped(async (ownerId) => {
    const topic = await getTopicContext(ownerId, topicId);
    if (!topic) return { ok: false, error: "Tópico não encontrado." };

    const parts: string[] = [];
    if (context?.quote) {
      parts.push(
        context.quote
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n"),
        "",
      );
    }
    parts.push(
      `**Pergunta ao tutor.** ${asked ?? (context?.quote ? "Explique este trecho." : MODE_LABEL[mode])}`,
      "",
      answer.trim(),
    );

    const row = await createNote({
      ownerId,
      topicId,
      lessonId: context?.lessonId ?? null,
      anchorSlug: context?.anchorSlug ?? null,
      quote: context?.quote ?? null,
      // The question titles the note; without one, the mode does. Either way
      // the title says what was asked, not what was answered.
      title: deriveTitle(asked ?? `${MODE_LABEL[mode]} · ${topic.topicTitle}`),
      content: parts.join("\n"),
    });

    revalidatePath("/notes");
    if (context?.lessonId) revalidatePath(`/lessons/${context.lessonId}`);
    return { ok: true, id: row.id };
  });
}

export type AdoptResult = { ok: true; goalId: string } | { ok: false; error: string };

export async function adoptRoadmapAction(input: {
  title: string;
  summary: string;
  months: number;
  /** Topics with the phase they came from — the roadmap's grouping, kept. */
  topics: { title: string; phase: string | null }[];
}): Promise<AdoptResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Título ausente." };

  let targetDate: Date | null = null;
  if (input.months > 0) {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.round(input.months));
    targetDate = d;
  }

  return scoped(async (ownerId) => {
    const goal = await createGoal({
      ownerId,
      title,
      category: "profissional",
      why: input.summary.trim() || null,
      targetDate,
    });

    // Insert in roadmap order so `sortOrder` alone reconstructs both the
    // sequence of phases and the sequence inside each one — no extra column.
    let order = 0;
    for (const raw of input.topics) {
      const topicTitle = raw.title.trim();
      if (!topicTitle) continue;
      await createTopic({
        ownerId,
        goalId: goal.id,
        title: topicTitle,
        phase: raw.phase?.trim() || null,
        sortOrder: order++,
      });
    }

    revalidatePath("/");
    return { ok: true, goalId: goal.id };
  });
}

export type PhasesActionResult =
  | { ok: true; grouped: number; mocked: boolean }
  | { ok: false; error: string };

/** Groups a goal's existing topics into learning phases via the mentor. */
export async function groupTopicsIntoPhasesAction(
  goalId: string,
): Promise<PhasesActionResult> {
  const goal = await scoped((ownerId) => getGoalWithTopics(ownerId, goalId));
  if (!goal) return { ok: false, error: "Objetivo não encontrado." };

  const res = await proposePhases(goal);
  if (!res.ok) return { ok: false, error: res.error };

  const grouped = await scoped((ownerId) => applyPhases(ownerId, goalId, res.data.phases));
  revalidatePath(`/goals/${goalId}`);
  return { ok: true, grouped, mocked: res.mocked };
}
