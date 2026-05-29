# Mobster — Master Plan

**Last Updated:** 2026-05-29  
**Current Phase:** Phase 2 (planned)  
**License:** AGPL v3

---

## Vision

Mobster is a self-hosted Docker-based web application that lets a developer connect their GitHub projects via a Personal Access Token, aggregate all issues & feature requests into a unified inbox, use AI agents to draft PRDs on-demand, review and prioritize them, then schedule them for overnight execution — where the agent writes actual code and opens GitHub PRs for human review.

### Core Principles
- **User maintains full control** at every step
- **Single-user first**, with data model designed for future multi-user/tenant SaaS
- **Docker-first**: `docker compose up` for self-hosters
- **AGPL v3**: free for self-hosted, commercial license available for SaaS

### Core Workflow

```
GitHub Repos ──→ Issues/PRs ──→ Unified Inbox (UI)
                                    │
                              [User triages]
                                    │
                              [Click "Generate PRD"]     ← Phase 2
                                    │
                              Agent drafts PRD
                                    │
                              [User reviews, edits, combines PRDs]
                                    │
                              [User clicks "Schedule"]    ← Phase 3
                                    │
                              Build queue ──→ Overnight agent
                                    │              │
                                    │       Agent writes code
                                    │       Agent opens GitHub PR
                                    │              │
                              [Morning: User reviews PR] ←─┘
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Database | SQLite (via better-sqlite3 + Drizzle ORM) |
| Auth | Custom JWT session (jose) + GitHub Personal Access Token |
| CSS | Tailwind CSS + shadcn/ui |
| GitHub API | Octokit |
| Agent SDK | Anthropic SDK + Claude Code CLI (Phase 2+) |
| Testing | Vitest + Playwright |
| Container | Docker + docker-compose |

---

## Authentication

**No GitHub App or OAuth required.** The user generates a Personal Access Token at `github.com/settings/tokens`, pastes it into Mobster's `/login` page. The token is encrypted (AES-256-GCM) and stored in SQLite. A signed JWT session cookie is set for subsequent requests. No redirect dance, no callback URLs, no token refresh.

---

## Phase Summary

### Phase 0: Foundation ✅ Complete
- Monorepo (Turborepo + pnpm)
- SQLite + Drizzle ORM with embedded DDL
- Next.js 15 with App Router, Tailwind, shadcn/ui
- Custom JWT auth (jose) + PAT-based GitHub connection
- Docker + docker-compose
- Vitest + Playwright + CI (GitHub Actions)

### Phase 1: GitHub Sync Engine ✅ Complete
- GitHub PAT entry & validation
- Repo listing & selection
- Per-repo manual sync ("Sync Now" button)
- Label-based issue classification (bug/feature/question/other)
- Filterable inbox (table with repo, type, state, label, search filters)
- Issue detail view with local annotations (notes, tags, type override)
- Settings page (connection status, repo management)

### Phase 2: PRD Generation 🔜 Planned
- Claude API integration for PRD generation
- PRD editor with review/approve workflow
- PRD combining

### Phase 3: Build Queue & Overnight Execution 🔜 Planned
- Build queue with scheduling
- Claude Code CLI for code generation
- Automatic PR creation

### Phase 4: Polish & Release 🔜 Planned
- Dashboard analytics
- Dark mode
- Docker image publication
- Documentation

---

## Data Model

6 tables: `app_settings`, `users`, `github_repos`, `issues`, `prds`, `build_jobs`

See [02-data-model.md](02-data-model.md) for full schema details.

---

## Folder Structure (Current)

```
mobster/
├── .docs/                          ← Planning & design documents
│   ├── 00-master-plan.md           ← This document
│   ├── 01-architecture.md
│   ├── 02-data-model.md
│   ├── 03-api-design.md
│   ├── 05-ui-ux.md
│   ├── 07-testing-strategy.md
│   └── 08-security.md
├── apps/web/                       ← Next.js application
│   └── src/
│       ├── app/                    ← App Router pages
│       │   ├── login/              ← PAT entry form
│       │   ├── inbox/              ← Issue table + filters
│       │   ├── issues/[id]/        ← Issue detail + annotations
│       │   ├── settings/           ← Repo management + sync
│       │   └── api/                ← REST endpoints
│       ├── components/             ← Shared UI components
│       └── lib/                    ← Business logic
├── packages/
│   ├── shared/                     ← Types, encryption, Zod schemas
│   └── db/                         ← Drizzle ORM schema, DDL, client
├── docker/                         ← Dockerfile + docker-compose.yml
└── .github/workflows/              ← CI pipeline
```

---

## Open Questions (for Phase 2+)

- Multi-user/tenant data model design
- Agent context assembly strategy (full repo code vs issue-only)
- PRD template format
- Build job concurrency and error handling
- SaaS pricing model

---

## Related Documents

- [Architecture](01-architecture.md) — Container design, request flows
- [Data Model](02-data-model.md) — Full schema, state machines
- [API Design](03-api-design.md) — REST endpoints, error handling
- [UI/UX](05-ui-ux.md) — Screen designs, component specs
- [Testing Strategy](07-testing-strategy.md) — Test pyramid, CI
- [Security](08-security.md) — Threat model, encryption, token handling
