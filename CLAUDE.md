# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Commands

```bash
pnpm dev              # Start Next.js dev server (port 3000)
pnpm build            # Build all packages
pnpm test             # Run all Vitest tests
pnpm test --filter=@mobster/shared   # Run tests for a single package
pnpm typecheck        # TypeScript check across all packages
pnpm lint             # Lint across all packages
pnpm format           # Prettier format
pnpm format:check     # Prettier check only (CI)
pnpm e2e              # Playwright E2E tests
pnpm clean            # Remove .next and dist directories
```

**Database commands** (run from repo root or `packages/db`):
```bash
pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:migrate       # Run Drizzle migrations (dev only)
```

**After schema changes**: run `pnpm db:generate`, then copy the generated SQL into `packages/db/src/schema-ddl.ts` wrapping each `CREATE TABLE` with `IF NOT EXISTS`. This DDL is what actually runs at startup — migration files are for version history only.

## Environment Variables

Only `ENCRYPTION_KEY` is needed in `.env` (place at `apps/web/.env` for Next.js). Both `ENCRYPTION_KEY` and `AUTH_SECRET` are auto-generated and persisted in SQLite on first run if not set.

GitHub PAT is entered via the web UI at `/login` — no `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` needed.

## Architecture

This is a **Turborepo monorepo** (pnpm workspaces) with three packages:

- **`apps/web`** — Next.js 15 App Router app. Pages: `/` (dashboard), `/login` (PAT entry), `/inbox` (issue table), `/issues/[id]` (detail + annotations), `/settings` (repo management + sync). API routes under `api/issues/` and `api/repos/`.
- **`packages/db`** — Database layer. Drizzle ORM schema (6 tables: `app_settings`, `users`, `github_repos`, `issues`, `prds`, `build_jobs`), embedded DDL for startup, `createDb()` factory.
- **`packages/shared`** — Shared types, Zod validation schemas, AES-256-GCM encryption.

**Auth**: Custom JWT sessions via `jose` library (not NextAuth OAuth). User pastes a GitHub PAT → server validates against `GET /user` → encrypts and stores in `users.github_token` → sets a signed `authjs.session-token` cookie. The `auth()` helper in `apps/web/src/lib/auth.ts` verifies the cookie, decrypts the PAT, and returns `{ accessToken, user }`. All API routes and server components call `auth()` for access control.

**Database**: SQLite via `better-sqlite3` + Drizzle ORM. `getDb()` creates a global singleton (`globalThis._db`) safe for Next.js hot reload. Schema is enforced at startup by `ensureSchema()` which runs embedded `CREATE TABLE IF NOT EXISTS` DDL — no migration files at runtime. WAL mode and foreign keys enabled.

**GitHub API**: `apps/web/src/lib/github.ts` wraps Octokit. Factory `createGitHubClient(accessToken)` returns `{ getAuthenticatedUser, listRepos, listIssues }`. Pagination handled internally.

**Sync engine**: `apps/web/src/lib/sync.ts` — `syncRepo(db, accessToken, repoId)` fetches issues from GitHub (paginated), upserts into local DB, auto-classifies type from labels.

**Startup**: `apps/web/src/instrumentation.ts` calls `initializeApp()` from `startup.ts` which ensures schema, loads settings from `app_settings` into `process.env`, and auto-generates `AUTH_SECRET` / `ENCRYPTION_KEY` if missing.

## API Route Pattern

Every API route follows this convention:
1. `const session = await auth()` — return 401 if null
2. `const db = getDb()` — get DB singleton
3. Validate input with Zod schemas from `@mobster/shared`
4. Return `NextResponse.json()`

## Key Dependencies

`next@15`, `react@19`, `better-sqlite3`, `drizzle-orm`, `octokit`, `jose`, `zod`, `uuid`, `tailwindcss`, `shadcn/ui` (manual components), `lucide-react`, `next-themes`, `vitest`, `playwright`

**Note**: `next-auth@5` (beta) is in `package.json` but is **not used** at runtime. The project switched to custom JWT auth via the `jose` package (installed as a direct dependency). `next-auth` is a leftover that can be removed.
