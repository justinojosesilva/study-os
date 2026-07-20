import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, runAsOwner } from "@/infra/db/client";
import { users } from "@/infra/db/schema";

/**
 * The auth seam. The domain only ever asks "who is the current user?" — this is
 * the one place that knows the answer. Swapping single-user for real auth meant
 * changing only this function; everything downstream scopes by the returned id.
 *
 * Dev bypass: when explicitly enabled (never in production), returns the fixed
 * DEV_OWNER_ID so the app is usable locally before GitHub OAuth is configured.
 */
function devBypassId(): string | null {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.AUTH_DEV_BYPASS === "true" &&
    process.env.DEV_OWNER_ID
  ) {
    return process.env.DEV_OWNER_ID;
  }
  return null;
}

export async function getCurrentUserId(): Promise<string> {
  const bypass = devBypassId();
  if (bypass) return bypass;

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

export async function getCurrentUser() {
  const id = await getCurrentUserId();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

/**
 * The tenant seam for requests: resolves the current user, then runs `fn`
 * inside an RLS-scoped transaction (app.owner_id set). Every page loader and
 * Server Action that touches tenant data wraps its work in this.
 */
export async function scoped<T>(fn: (ownerId: string) => Promise<T>): Promise<T> {
  const ownerId = await getCurrentUserId();
  return runAsOwner(ownerId, () => fn(ownerId));
}
