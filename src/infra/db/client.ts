import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Two connections, two roles:
 *  - globalDb  → the app runtime, connecting as a RESTRICTED role (no superuser,
 *                no BYPASSRLS) so Postgres Row-Level Security actually applies.
 *  - adminDb   → migrations and scripts, connecting as the owner/superuser role
 *                (bypasses RLS). Never used from request code.
 *
 * RLS enforcement: policies gate rows by `current_setting('app.owner_id')`.
 * Each request runs its queries inside runAsOwner(), which opens a transaction,
 * sets that GUC (transaction-local, pool-safe), and stashes the tx in an
 * AsyncLocalStorage. The exported `db` is a Proxy that resolves to the current
 * request's transaction (or the global connection outside a request) — so the
 * repositories keep importing `db` unchanged and still get per-tenant scoping.
 */

const appUrl = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
const adminUrl = process.env.DATABASE_URL;
if (!appUrl || !adminUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

const globalForDb = globalThis as unknown as {
  appClient?: ReturnType<typeof postgres>;
  adminClient?: ReturnType<typeof postgres>;
};

// `prepare: false` is REQUIRED behind a transaction pooler (Neon's pooled
// endpoint / PgBouncer in transaction mode) — named prepared statements don't
// survive connection multiplexing. It's harmless on a direct local connection,
// so we set it unconditionally. `idle_timeout` lets serverless instances release
// connections between invocations instead of holding them open.
const pgOptions = { prepare: false, idle_timeout: 20 } as const;

const appClient = globalForDb.appClient ?? postgres(appUrl, { max: 10, ...pgOptions });
const adminClient = globalForDb.adminClient ?? postgres(adminUrl, { max: 4, ...pgOptions });
if (process.env.NODE_ENV !== "production") {
  globalForDb.appClient = appClient;
  globalForDb.adminClient = adminClient;
}

const globalDb = drizzle(appClient, { schema });

/** Superuser connection for migrations/scripts — bypasses RLS. */
export const adminDb = drizzle(adminClient, { schema });

type DrizzleDb = typeof globalDb;

const als = new AsyncLocalStorage<{ tx: DrizzleDb }>();

function currentDb(): DrizzleDb {
  return als.getStore()?.tx ?? globalDb;
}

/**
 * Request-scoped db. Repositories import this; it resolves to the active
 * per-request transaction (with app.owner_id set) or the global connection.
 */
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = currentDb() as any;
    const value = active[prop];
    return typeof value === "function" ? value.bind(active) : value;
  },
});

/**
 * Run `fn` as `ownerId`: opens a transaction, sets the RLS GUC, and binds the
 * request-scoped `db` to it. Everything inside is isolated to that tenant by
 * Postgres, not just by application filters.
 */
export async function runAsOwner<T>(ownerId: string, fn: () => Promise<T>): Promise<T> {
  return globalDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.owner_id', ${ownerId}, true)`);
    return als.run({ tx: tx as unknown as DrizzleDb }, fn);
  });
}

export { schema };
