import { db } from "@/infra/db/client";
import { users } from "@/infra/db/schema";
import { eq } from "drizzle-orm";

export async function getWeeklyGoalHours(ownerId: string): Promise<number> {
  const [row] = await db
    .select({ hours: users.weeklyGoalHours })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  return row?.hours ?? 10;
}

export async function setWeeklyGoalHours(ownerId: string, hours: number) {
  await db
    .update(users)
    .set({ weeklyGoalHours: hours })
    .where(eq(users.id, ownerId));
}

/** Even spread of the weekly goal across all 7 days, in minutes per weekday. */
function defaultAvailability(weeklyGoalHours: number): number[] {
  const perDay = Math.round((weeklyGoalHours * 60) / 7);
  return Array.from({ length: 7 }, () => perDay);
}

/** Minutes available per weekday (index 0=Sun..6=Sat). Falls back to an even
 *  spread of the weekly goal when the user hasn't set a custom availability. */
export async function getAvailability(ownerId: string): Promise<number[]> {
  const [row] = await db
    .select({ availability: users.availability, hours: users.weeklyGoalHours })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  const saved = row?.availability;
  if (Array.isArray(saved) && saved.length === 7) return saved.map((n) => Math.max(0, Math.round(n)));
  return defaultAvailability(row?.hours ?? 10);
}

export async function setAvailability(ownerId: string, minutesByWeekday: number[]) {
  const clean = Array.from({ length: 7 }, (_, i) =>
    Math.max(0, Math.min(24 * 60, Math.round(minutesByWeekday[i] ?? 0))),
  );
  await db.update(users).set({ availability: clean }).where(eq(users.id, ownerId));
}
