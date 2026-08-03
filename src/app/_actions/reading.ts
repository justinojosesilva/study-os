"use server";

import { scoped } from "@/domain/auth";
import { saveProgress } from "@/domain/reading/repository";

/**
 * Called as the reader scrolls, so it is deliberately silent: no revalidate,
 * no returned payload. Re-rendering the page under someone reading it would be
 * the worst possible response to a scroll event.
 */
export async function saveReadingProgressAction(
  lessonId: string,
  anchorSlug: string | null,
  percent: number,
): Promise<void> {
  if (!lessonId || !Number.isFinite(percent)) return;
  await scoped((ownerId) => saveProgress(ownerId, lessonId, { anchorSlug, percent }));
}
