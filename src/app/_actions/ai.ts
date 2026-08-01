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
): Promise<FlashcardGenResult> {
  const ctx = await scoped((ownerId) => getTopicContext(ownerId, topicId));
  if (!ctx) return { ok: false, error: "Tópico não encontrado." };
  return generateFlashcards({
    topicTitle: ctx.topicTitle,
    goalTitle: ctx.goalTitle,
    content,
  });
}

export async function askTutorAction(
  topicId: string,
  mode: TutorMode,
  question?: string,
): Promise<TutorResult> {
  const ctx = await scoped((ownerId) => getTopicContext(ownerId, topicId));
  if (!ctx) return { ok: false, error: "Tópico não encontrado." };

  // Read context in a short scoped transaction, call the AI outside it, then
  // write back — the model call is slow and must not hold a DB transaction.
  const res = await askTutor({
    topicTitle: ctx.topicTitle,
    goalTitle: ctx.goalTitle,
    mode,
    question,
  });

  if (res.ok) {
    // Kept as study material for the topic quiz. A failure to store must not
    // cost the user the answer they already have on screen.
    try {
      await scoped((ownerId) =>
        saveTutorAnswer({
          ownerId,
          topicId,
          mode,
          question: question?.trim() || null,
          answer: res.text,
        }),
      );
    } catch (err) {
      console.error("tutor-save error", err);
    }
  }

  return res;
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
