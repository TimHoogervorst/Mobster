# 01 — Architecture

**Phase:** 0 (Foundation Setup)  
**Status:** In Progress  
**Date:** 2026-05-29

---

## 1. Overview

Mobster is a single-user, self-hosted web application packaged as a Docker container. It connects to GitHub via OAuth, syncs issues into a local SQLite database, and orchestrates AI agents (Claude) to generate PRDs and write code.

### Key Architectural Constraints
- **Single process** — Next.js server handles web UI, API, background sync, and job execution
- **SQLite** — single file database, no separate DB process
- **No Redis** — lightweight in-process job scheduling for Phase 0-3
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
│  │  ├── /inbox (issues list + filters)                │  │
│  │  ├── /issues/[id] (detail view)                    │  │
│  │  ├── /prds (PRD management)                        │  │
│  │  ├── /jobs (build queue + monitoring)              │  │
│  │  ├── /settings (repo config, schedule)             │  │
│  │  └── /api/* (REST endpoints)                       │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Server Components (RSC) — data fetching           │  │
│  │  Client Components — interactivity                 │  │
│  │  API Routes — mutations, agent calls               │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Background Workers (same process)                  │  │
│  │  ├── GitHub sync scheduler (cron-like)             │  │
│  │  └── Job executor (process build queue)            │  │
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
Browser → fetch('/api/...') → API Route → SQLite → JSON response → Browser
```

### 3.3 Agent Call (PRD Generation)
```
Browser → API Route → Anthropic SDK → Claude API → PRD text → SQLite → JSON response → Browser
```

### 3.4 Overnight Build
```
Scheduler (cron) → Pick next BuildJob → Clone repo to /workspaces/{jobId}
    → Claude Code CLI (subprocess) → Git commit + push → GitHub PR
    → Update BuildJob status → Cleanup workspace
```

---

## 4. Directory Layout

```
mobster/
├── apps/
│   └── web/                          ← Next.js app
│       ├── src/
│       │   ├── app/                  ← App Router pages & API routes
│       │   │   ├── layout.tsx        ← Root layout
│       │   │   ├── page.tsx          ← Dashboard
│       │   │   ├── inbox/            ← Issue inbox
│       │   │   ├── issues/[id]/      ← Issue detail
│       │   │   ├── prds/             ← PRD management
│       │   │   ├── jobs/             ← Build queue
│       │   │   ├── settings/         ← User settings
│       │   │   └── api/              ← API routes
│       │   │       ├── auth/         ← NextAuth endpoints
│       │   │       ├── issues/       ← Issue CRUD
│       │   │       ├── prds/         ← PRD CRUD + agent gen
│       │   │       ├── jobs/         ← Build job management
│       │   │       └── repos/        ← Repo management
│       │   ├── components/           ← Shared UI components
│       │   ├── lib/                  ← Business logic
│       │   │   ├── github.ts         ← Octokit client + sync
│       │   │   ├── agent.ts          ← Agent abstraction
│       │   │   ├── scheduler.ts      ← Cron-like scheduler
│       │   │   ├── encryption.ts     ← Token encryption
│       │   │   └── workspace.ts      ← Agent workspace mgmt
│       │   └── styles/
│       ├── public/
│       ├── package.json
│       ├── next.config.ts
│       └── tailwind.config.ts
├── packages/
│   ├── shared/                       ← Shared types, constants
│   │   ├── src/
│   │   │   ├── types.ts              ← DB entity types, API types
│   │   │   ├── constants.ts          ← Status enums, labels
│   │   │   └── index.ts
│   │   └── package.json
│   └── db/                           ← Database layer
│       ├── src/
│       │   ├── schema.ts             ← Drizzle table definitions
│       │   ├── migrations/           ← Generated migrations
│       │   ├── seed.ts               ← Dev seed data
│       │   └── index.ts              ← DB client export
│       ├── drizzle.config.ts
│       └── package.json
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .dockerignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── .docs/                            ← Planning documents
├── turbo.json                        ← Turborepo config
├── pnpm-workspace.yaml               ← pnpm workspace config
├── package.json                      ← Root package.json
├── tsconfig.json                     ← Root tsconfig
└── README.md
```

---

## 5. Technology Choices

### 5.1 Next.js App Router
- **Server Components** for data-heavy pages (inbox, issue detail) — fetch directly from SQLite
- **Client Components** for interactive elements (filters, PRD editor, job monitor)
- **API Routes** for mutations and agent calls
- **Middleware** for auth gating

### 5.2 SQLite + Drizzle
- **better-sqlite3** as the driver — synchronous, fast, no connection pooling needed
- **Drizzle ORM** for type-safe queries and migrations
- **WAL mode** enabled for concurrent reads during writes
- Database file at `/data/mobster.db` inside container (volume mount)

### 5.3 Authentication (NextAuth.js / Auth.js v5)
- GitHub OAuth provider only (single-user)
- Session stored in SQLite via Drizzle adapter
- Encrypted GitHub access token stored in User table
- Middleware protects all routes except login page

### 5.4 Agent Integration
- **Anthropic SDK** for PRD generation (API call, fast, ~5-30s)
- **Claude Code CLI** for code generation (subprocess, long-running, in workspace)
- Abstracted behind `AgentInterface` so future agent backends can be plugged in

### 5.5 Background Jobs
- **Phase 0-3:** Simple cron-like scheduler using `node-cron` or `setInterval`
- Job state persisted in SQLite (`BuildJob` table)
- Single worker processes one job at a time
- **Future:** Extract to BullMQ + Redis if concurrency or reliability becomes an issue

### 5.6 Styling
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for accessible, customizable UI components
- **Lucide** for icons
- Dark mode support via Tailwind's `class` strategy + `next-themes`

---

## 6. API Design Principles

- RESTful, JSON responses
- Auth required on all endpoints except `/api/auth/*`
- Rate limit on agent endpoints (prevent accidental spam)
- Long-running agent calls (code gen) return a `BuildJob` ID and complete asynchronously
- Sync operations are idempotent (can re-run safely)

---

## 7. Security Considerations

See [08-security.md](08-security.md) for detailed security analysis.

### Key Points
- GitHub token encrypted at rest (AES-256-GCM)
- No token exposure to client-side code
- Agent workspaces sandboxed to `/workspaces/{jobId}`
- CSRF protection via NextAuth
- Content Security Policy headers
- Docker runs as non-root user

---

## 8. Open Design Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Should background workers run in the same Node process or as a separate worker thread? | → Resolve during Phase 0 implementation |
| 2 | SQLite WAL mode: better-sqlite3 handles this natively — confirm during DB setup |
| 3 | Should we use `next/cache` for issue list caching, or always hit SQLite? | → Start simple (always SQLite), add caching if needed |

---

## Next Steps

- Proceed to [02-data-model.md](02-data-model.md) for detailed schema design
- Reference this doc during Phase 0 scaffolding
