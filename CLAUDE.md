@AGENTS.md

# Latis Skills

Personal study-management platform. Built personal-first (single user, dogfooding),
modeled multi-tenant-aware so it can become a SaaS later without a rewrite.

## Stack

- Next.js 16 (App Router, `src/`) + React 19 + Tailwind 4
- Drizzle ORM + postgres.js, PostgreSQL 17 (local via Docker)
- TypeScript strict

## Architecture — logical boundaries, not physical services

A Next monolith with an isolated domain layer. The rule: keep the layer
boundary, not a service boundary, until there's a concrete reason to split.

```
src/
  infra/db/        schema.ts (source of truth), client.ts (connection)
  domain/          framework-free business logic
    auth.ts        getCurrentUserId() — the single-user seam (see below)
    goals/         repository.ts — reference repo, all queries scoped by ownerId
    metrics.ts     derived metrics (hours, streak, goal progress)
  app/             Next routes; Server Actions stay THIN and call domain/
```

## Core modeling decisions

- **`ownerId` on every row.** Single-user today (fixed id), but scoping is
  already there — multi-tenant later = wire auth + RLS, domain untouched.
- **`study_sessions` is an immutable event log.** Never UPDATE a running total.
  Hours, streaks, heatmaps are all aggregated from rows (`domain/metrics.ts`).
- **Goal progress is derived, never stored** — weighted share of `mastered`
  topics, computed on read.
- **`materials` are references (URL + progress), not hosted files** — avoids
  being a file host (storage cost + LGPD).
- **Auth seam:** `getCurrentUserId()` resolves `DEV_OWNER_ID`. It's the ONLY
  function that changes when real auth (Auth.js) lands.

## Out of MVP (deliberate)

Spaced repetition (FSRS) is phase 2 — add a `topic_reviews` table referencing
`topics`; no existing table changes. AI gap-analysis is phase 3 (needs
accumulated data first). Billing/multi-tenant is phase 4.

## Commands

```bash
npm run db:up        # start Postgres (Docker, host port 5435)
npm run db:generate  # generate SQL migration from schema
npm run db:migrate   # apply migrations
npm run db:seed      # seed sample data; prints DEV_OWNER_ID to put in .env
npm run db:studio    # Drizzle Studio
npm run db:rls-table # enable RLS on ONE table: npm run db:rls-table -- ai_usage
npm run dev          # Next dev server
```

First-time setup: `cp .env.example .env` → `npm run db:up` → `npm run db:migrate`
→ `npm run db:seed` → paste printed `DEV_OWNER_ID` into `.env`.

**Every new tenant table needs RLS, and `db:rls` is not how you add it.** That
script rewrites the whole policy set *and* runs `ALTER ROLE studyos_app
PASSWORD` as a side effect — running it in prod to protect one new table
changes the app role's password. Use `db:rls-table` for tables added after the
initial setup, and add the name to `TENANT_TABLES` in `scripts/setup-rls.ts` so
a fresh database still gets it.
