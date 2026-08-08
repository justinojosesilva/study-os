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

/**
 * Valida a string de conexão SEM nunca colocá-la na mensagem de erro.
 *
 * Isto não é zelo excessivo: `new URL()` sobre um valor inválido lança
 * `TypeError: Invalid URL` com a ENTRADA INTEIRA anexada, e o build do Next
 * despeja essa mensagem no log. Foi assim que uma senha de produção vazou —
 * uma variável de ambiente ficou com valor parcial (só a senha, sem o resto da
 * URL), o parser quebrou, e o log publicou o segredo.
 *
 * Aqui o erro diz QUAL variável está errada e POR QUÊ, e o valor nunca sai.
 */
function connectionUrl(nome: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(`${nome} não está definida. Copie .env.example para .env.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(valor);
  } catch {
    // Sem interpolar `valor` — é justamente o que não pode aparecer em log.
    throw new Error(
      `${nome} não é uma URL de conexão válida. ` +
        `Esperado algo como postgresql://usuario:senha@host/banco — ` +
        `confira se a variável não recebeu só um pedaço (a senha, por exemplo) ` +
        `e se a senha não contém @ : / # sem escape.`,
    );
  }
  if (!parsed.protocol.startsWith("postgres")) {
    throw new Error(
      `${nome} tem protocolo "${parsed.protocol}" — esperado postgresql:// ou postgres://.`,
    );
  }
  if (!parsed.hostname) {
    throw new Error(`${nome} não tem host. Confira se a URL está completa.`);
  }
  return valor;
}

const adminUrl = connectionUrl("DATABASE_URL", process.env.DATABASE_URL);
const appUrl = process.env.APP_DATABASE_URL
  ? connectionUrl("APP_DATABASE_URL", process.env.APP_DATABASE_URL)
  : adminUrl;

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
