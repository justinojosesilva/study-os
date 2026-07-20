"use server";

import { revalidatePath } from "next/cache";
import type { Grade } from "ts-fsrs";
import { scoped } from "@/domain/auth";
import { ownsFlashcard } from "@/domain/flashcards/repository";
import {
  getLatestReview,
  recordReview,
  reviewToStoredCard,
} from "@/domain/reviews/repository";
import { newCard, toCard, scheduleNext, cardToColumns } from "@/domain/reviews/scheduler";

export type ActionResult = { ok: true } | { ok: false; error: string };

const RATINGS = [1, 2, 3, 4] as const;

export async function recordReviewAction(
  flashcardId: string,
  rating: number,
): Promise<ActionResult> {
  if (!RATINGS.includes(rating as (typeof RATINGS)[number])) {
    return { ok: false, error: "Avaliação inválida." };
  }

  return scoped(async (ownerId) => {
    if (!(await ownsFlashcard(ownerId, flashcardId))) {
      return { ok: false, error: "Card não encontrado." };
    }

    const now = new Date();
    const latest = await getLatestReview(ownerId, flashcardId);
    const card = latest ? toCard(reviewToStoredCard(latest)) : newCard(now);
    const next = scheduleNext(card, rating as Grade, now);

    await recordReview({
      ownerId,
      flashcardId,
      rating,
      reviewedAt: now,
      ...cardToColumns(next),
    });

    // Only the dashboard badge needs revalidating. NOT "/review": the session
    // owns a frozen client snapshot of its queue (see ReviewSession).
    revalidatePath("/");
    return { ok: true };
  });
}
