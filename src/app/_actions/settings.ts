"use server";

import { revalidatePath } from "next/cache";
import { scoped } from "@/domain/auth";
import { setWeeklyGoalHours } from "@/domain/user/repository";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setWeeklyGoalAction(hours: number): Promise<ActionResult> {
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
    return { ok: false, error: "Informe de 1 a 168 horas." };
  }
  return scoped(async (ownerId) => {
    await setWeeklyGoalHours(ownerId, Math.round(hours));
    revalidatePath("/");
    return { ok: true };
  });
}
