# 01 — Architecture

**Phase:** 0 (Foundation Setup) — **Complete**  
**Phase 3.5 additions:** Planned (see [35-project-phase-technical.md](35-project-phase-technical.md))  
**Last Updated:** 2026-06-04

---

## 1. Overview

Mobster is a single-user, self-hosted web application packaged as a Docker container. It connects to GitHub via a Personal Access Token (entered through the UI), syncs issues into a local SQLite database, and will orchestrate AI agents for PRD generation and code execution.

### Key Architectural Constraints
- **Single process** — Next.js server handles web UI, API, background sync, and job execution
- **SQLite** — single file database, no separate DB process
- **No Redis** — lightweight in-process job scheduling
- **Stateless containers** (mostly) — SQLite and workspace data on Docker volumes

---

## 2. Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   mobster (Docker)                        │
│                                                          │
│  Next.js Server (port 3000)                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │  App Router                                        │  │
│  │  ├── / (dashboard)                                 │  │
│  │  ├── /login (PAT entry)                            │  │
│  │  ├── /inbox → redirects to /intake                 │  │
│  │  ├── /intake (Issues + PRs tabs)           ← 3.5   │  │
│  │  ├── /issues/[id] (detail view)                    │  │
│  │  ├── /projects (project list)              ← 3.5   │  │
│  │  ├── /projects/[id] (phases + items)       ← 3.5   │  │
│  │  ├── /prds (PRD list)                              │  │
│  │  ├── /prds/[id] (PRD detail)                       │  │
│  │  ├── /runners (build job monitor)                  │  │
│  │  ├── /agents (agent config)                        │  │
│  │  ├── /settings (repo config, sync)                 │  │
│  │  └── /api/* (REST endpoints)                       │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Server Components (RSC) — data fetching           │  │
│  │  Client Components — interactivity                 │  │
│  │  API Routes — mutations, sync triggers             │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Background Workers (same process)                  │  │
│  │  └── GitHub sync trigger (per-repo, manual)        │  │
│  └────────────────────────────────────────────────────┘  │
│                         │                                │
│  Volumes                 │                               │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │  /data/mobster.db        SQLite database file      │  │
│  │  /workspaces/            Agent working directories │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Request Flow

### 3.1 Page Load (Server Component)
```
Browser → Next.js → SQLite (Drizzle) → RSC payload → Browser
```

### 3.2 Mutation (API Route)
```
Browser → fetch('/api/...') → API Route → auth() check → SQLite → JSON → Browser
```

### 3.3 Sync Trigger
```
Browser → POST /api/repos/[id]/sync → createGitHubClient(PAT) → GitHub API → SQLite → JSON → Browser
```

---

## 4. Directory Layout (Current)

```
mobster/
├── apps/web/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx              ← Dashboard
│       │   ├── login/                ← PAT entry form
│       │   ├── inbox/                ← Redirect to /intake
│       │   ├── intake/               ← ← 3.5: Issues + PRs tabs
│       │   ├── issues/[id]/          ← Issue detail + annotations
│       │   ├── projects/             ← ← 3.5: Project list + detail
│       │   │   └── [id]/             ← Project board (phases + items)
│       │   ├── prds/                 ← PRD list + detail
│       │   ├── runners/              ← Build job monitor
│       │   ├── agents/               ← Agent configuration
│       │   ├── settings/             ← Repo management + sync
│       │   └── api/
│       │       ├── issues/           ← Issue CRUD (legacy, redirects to /api/items)
│       │       ├── items/            ← ← 3.5: Unified items endpoint
│       │       ├── projects/         ← ← 3.5: Projects CRUD
│       │       └── repos/            ← Repo management + sync
│       ├── components/               ← Shared UI components
│       └── lib/
│           ├── auth.ts               ← Custom JWT session (jose)
│           ├── db.ts                 ← DB singleton + schema setup
│           ├── github.ts             ← Octokit wrapper (→ GitHubProvider in 3.5)
│           ├── startup.ts            ← Server startup init
│           ├── sync.ts               ← Unified issue + PR sync engine
│           ├── migrate-to-items.ts   ← ← 3.5: issues → items migration
│           ├── event-logger.ts       ← ← 3.5: Unified EventLogger class
│           ├── project-gates.ts      ← ← 3.5: Phase gate logic
│           └── providers/            ← ← 3.5: Source abstraction layer
│               └── github-provider.ts
├── packages/
│   ├── shared/src/
│   │   ├── index.ts                  ← Types + Zod schemas
│   │   └── encryption.ts            ← AES-256-GCM encrypt/decrypt
│   └── db/src/
│       ├── schema.ts                 ← Drizzle table definitions
│       ├── schema-ddl.ts             ← Embedded DDL (runtime schema setup)
│       ├── ensure-schema.ts          ← Schema enforcer
│       └── migrations/               ← Drizzle migration files (dev only)
├── docker/
└── .github/workflows/ci.yml
```

---

## 5. Technology Choices

### 5.1 Authentication — Custom JWT + PAT
- User enters a GitHub Personal Access Token on `/login`
- Server validates against `GET /user` on GitHub API
- PAT is encrypted (AES-256-GCM) and stored in `users.github_token`
- A JWT session cookie is signed with `AUTH_SECRET` (auto-generated, persisted in `app_settings`)
- `auth()` helper reads the cookie, verifies the JWT, decrypts the PAT, returns `{ accessToken, user }`
- No external redirects, no callback URLs, no token refresh needed

### 5.2 SQLite + Drizzle
- **better-sqlite3** as the driver — synchronous, fast, no connection pooling
- **Drizzle ORM** for type-safe queries
- **Embedded DDL** (`schema-ddl.ts`) — schema is created at startup without migration files
- **WAL mode** enabled for concurrent reads

### 5.3 GitHub API
- **Octokit** for typed GitHub API access
- PAT passed directly as Bearer token
- Pagination and rate limit handling built in

### 5.4 Styling
- **Tailwind CSS** + **shadcn/ui** components
- **Lucide** icons
- Dark mode via `next-themes`

---

## 6. API Design Principles
- RESTful, JSON responses
- Auth via `auth()` helper (custom JWT, not NextAuth)
- Sync operations are idempotent
- Single-user — no multi-tenant isolation needed yet

## 7. Security
See [08-security.md](08-security.md). Key points: PAT encrypted at rest, JWT signed with auto-generated secret, no OAuth credentials in env vars, Docker runs as non-root.
