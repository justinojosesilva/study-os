"use server";

import { revalidatePath } from "next/cache";
import { scoped, getCurrentUserId } from "@/domain/auth";
import { runAsOwner } from "@/infra/db/client";
import { setAvailability } from "@/domain/user/repository";
import { getWeekPlan } from "@/domain/schedule/planner";
import { getUpcomingExam } from "@/domain/certifications/repository";
import { countDueCards } from "@/domain/reviews/repository";
import { daysUntil } from "@/lib/date";
import {
  generateWeekStrategy,
  type WeekStrategyInput,
  type WeekStrategyResult,
} from "@/domain/ai/weekStrategy";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setAvailabilityAction(minutes: number[]): Promise<ActionResult> {
  if (!Array.isArray(minutes) || minutes.length !== 7 || minutes.some((n) => !Number.isFinite(n))) {
    return { ok: false, error: "Disponibilidade inválida." };
  }
  return scoped(async (ownerId) => {
    await setAvailability(ownerId, minutes);
    revalidatePath("/agenda");
    revalidatePath("/"); // dashboard "Hoje no plano" widget
    return { ok: true };
  });
}

/** Narrate the already-computed week plan. Context is read under RLS in a short
 *  transaction; the model call happens outside it. */
export async function generateWeekStrategyAction(): Promise<WeekStrategyResult> {
  const ownerId = await getCurrentUserId();
  const input = await runAsOwner(ownerId, async (): Promise<WeekStrategyInput> => {
    const [plan, exam, dueReviews] = await Promise.all([
      getWeekPlan(ownerId),
      getUpcomingExam(ownerId),
      countDueCards(ownerId),
    ]);

    // Aggregate study time per topic across the week.
    const byTopic = new Map<string, { title: string; goalTitle: string; blocks: number }>();
    for (const day of plan.days) {
      for (const b of day.blocks) {
        if (b.kind !== "topic" || !b.topicId) continue;
        const e = byTopic.get(b.topicId) ?? {
          title: b.label,
          goalTitle: b.goalTitle ?? "",
          blocks: 0,
        };
        e.blocks += 1;
        byTopic.set(b.topicId, e);
      }
    }
    const topicFocus = [...byTopic.values()].sort((a, b) => b.blocks - a.blocks).slice(0, 5);

    return {
      totalPlannedHours: Math.round((plan.totalPlannedMin / 60) * 10) / 10,
      daysWithPlan: plan.days.filter((d) => d.blocks.length > 0).length,
      dueReviews,
      topicFocus,
      nearestExam:
        exam && exam.examDate ? { title: exam.title, daysUntil: daysUntil(exam.examDate) } : null,
    };
  });

  return generateWeekStrategy(ownerId, input);
}
