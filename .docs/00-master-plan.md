# Mobster — Master Plan

**Last Updated:** 2026-06-03  
**Current Phase:** Phase 3 (planned)  
**License:** AGPL v3

---

## Vision

Mobster is a self-hosted Docker-based web application that lets a developer connect their GitHub projects via a Personal Access Token, aggregate all issues & feature requests into a unified inbox, use AI agents to draft PRDs on-demand, review and prioritize them, then trigger code integration — where the agent writes actual code, pushes to branches, and opens GitHub PRs for human review.

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
                              [Click "Generate PRD"]     ← Phase 2 ✅
                                    │
                              Agent drafts PRD
                                    │
                              [User reviews, edits, combines PRDs]
                                    │
                              [Click "Integrate"]         ← Phase 2 ✅
                                    │
                              Agent writes code
                              Agent pushes to branch
                              Agent opens GitHub PR
                                    │
                              [User reviews PR on GitHub]
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Database | SQLite (better-sqlite3 + Drizzle ORM) |
| Auth | Custom JWT session (jose) + GitHub Personal Access Token |
| CSS | Tailwind CSS + shadcn/ui |
| GitHub API | Octokit |
| Agent SDK | Anthropic SDK + Claude Code CLI |
| API Docs | Swagger UI (swagger-ui-react) |
| Testing | Vitest + Playwright |
| Container | Docker + docker-compose |

---

## Authentication

**No GitHub App or OAuth required.** The user generates a Personal Access Token at `github.com/settings/tokens`, pastes it into Mobster's `/login` page. The token is encrypted (AES-256-GCM) and stored in SQLite. A signed JWT session cookie is set for subsequent requests.

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
- Repo listing & selection (by list or URL)
- Per-repo manual sync ("Sync Now" button)
- Label-based issue classification (bug/feature/question/other)
- Filterable inbox (table with repo, type, state, label, search filters)
- Issue detail view with local annotations (notes, tags, type override)
- Multi-issue selection for batch PRD generation
- Settings page (connection status, repo management)

### Phase 2: PRD Generation & Code Integration ✅ Complete
- **AI Agents**: Configure Claude Code CLI or Anthropic SDK agents with model selection
- **PRD Generation**: Select issues → agent explores repo workspace → generates 6-section PRD (Summary, Problem, Changes, Technical Changes, Risks, Tests)
- **PRD Review**: Review/edit/comment workflow with feedback regeneration
- **PRD Combining**: Merge multiple PRDs into a single combined PRD
- **Code Integration**: Agent implements code from PRD → commits → pushes to branch → creates GitHub PR
- **Integration Modes**: New branch (auto-named), existing branch, or pull request into main
- **Fork Support**: Auto-forks repos the user doesn't own, pushes to fork, opens cross-fork PR
- **Runner Monitoring**: Real-time agent session logging with structured event viewer (thinking, tool calls, output)
- **Test Results**: Agent runs test suite after implementation, results displayed on PRD page
- **Integration History**: Full build job history per PRD with branch, PR link, status
- **Session Recovery**: Refresh button detects and repairs stuck sessions from process crashes
- **API Documentation**: Swagger UI at `/api-docs` with full OpenAPI 3.0 spec
- **Workspace Management**: Bare-mirror cache for fast clones, clean workspace option for retries

### Phase 3: UI Redesign & Branding 🔜 Planned
- Redesign the UI to be more consistent across all pages
- Add branding materials to make Mobster unique
- See [03-phase-3-ui-redesign.md](03-phase-3-ui-redesign.md)

### Phase 4: Performance & Simplification 🔜 Planned
- Optimize UI and back-end performance
- Redesign components to be simpler and more maintainable
- See [04-phase-4-performance.md](04-phase-4-performance.md)

### Phase 5: V1.0 Finalization 🔜 Planned
- Proper Docker image and compose setup
- Finalize documentation, testing, and security
- See [05-v1-finalization.md](05-v1-finalization.md)

---

## Data Model

9 tables: `app_settings`, `users`, `github_repos`, `issues`, `prds`, `prd_issues`, `prd_comments`, `agents`, `agent_logs`, `build_jobs`

See [02-data-model.md](02-data-model.md) for full schema details.

---

## Folder Structure

```
mobster/
├── .docs/                          ← Planning & design documents
│   ├── 00-master-plan.md           ← This document
│   ├── 01-architecture.md
│   ├── 02-data-model.md
│   ├── 03-phase-3-ui-redesign.md   ← Phase 3 plan
│   ├── 04-phase-4-performance.md   ← Phase 4 plan
│   ├── 05-v1-finalization.md       ← V1.0 finalization
│   └── backlog.md                  ← Known issues for investigation
├── apps/web/                       ← Next.js application
│   └── src/
│       ├── app/                    ← App Router pages & API routes
│       ├── components/             ← Shared UI components
│       └── lib/                    ← Business logic (auth, github, agents, sync)
├── packages/
│   ├── shared/                     ← Types, encryption, Zod schemas
│   └── db/                         ← Drizzle ORM schema, DDL, client
├── docker/                         ← Dockerfile + docker-compose.yml
└── .github/workflows/              ← CI pipeline
```

---

## Related Documents

- [Architecture](01-architecture.md) — Container design, request flows
- [Data Model](02-data-model.md) — Full schema, state machines
- [Phase 3: UI Redesign](03-phase-3-ui-redesign.md) — Branding & consistency
- [Phase 4: Performance](04-phase-4-performance.md) — Optimization & simplification
- [V1.0 Finalization](05-v1-finalization.md) — Docker, docs, testing, security
- [Backlog](backlog.md) — Known issues for investigation
