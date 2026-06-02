# Mobster 🕵️

**AI-powered GitHub issue manager.** Connect your repos with a Personal Access Token, triage issues in a unified inbox, let AI generate PRDs, and trigger code integration — where the agent writes code, pushes to branches, and opens GitHub PRs. All from a self-hosted web UI.

> **Phase 2 Complete** — PRD generation, code integration, agent runner monitoring, and Swagger API docs are working. See [Master Plan](.docs/00-master-plan.md).

## Features

### GitHub Integration
- 🔗 **PAT-based auth** — paste a token, get instant access. No OAuth, no app registration.
- 📋 **Unified inbox** — filterable table of issues across all connected repos with multi-select
- 🏷️ **Issue triage** — auto-classify bugs/features from labels, add local notes and tags
- 🔄 **Per-repo sync** — manual "Sync Now" with incremental updates
- ➕ **Add by URL** — add repos by pasting a GitHub URL

### AI Agents
- 🤖 **Dual provider support** — Claude Code CLI or Anthropic SDK agents
- ⚙️ **Per-agent configuration** — model selection (Opus/Sonnet/Haiku), custom prompts, environment variables
- 🔑 **Encrypted API keys** — AES-256-GCM encrypted at rest

### PRD Generation
- 📝 **6-section PRDs** — Summary, Problem, Changes, Technical Changes, Risks, Tests
- 🔍 **Codebase-aware** — agent explores the actual repo workspace to write specific, accurate PRDs
- ✏️ **Review workflow** — comment, send feedback, trigger regeneration
- 🔀 **PRD combining** — merge multiple PRDs into one

### Code Integration
- 🚀 **Agent implements PRDs** — writes actual code based on the PRD
- 🌿 **Branch management** — new branch (auto-named), existing branch, or pull request
- 🔒 **Default branch protection** — main always goes through a PR
- 🍴 **Auto-fork** — forks repos you don't own, opens cross-fork PRs
- 🧪 **Test results** — agent runs the test suite after implementation
- 📜 **Integration history** — full build job history per PRD

### Monitoring & Docs
- 📡 **Runner monitoring** — real-time agent session logs (thinking, tool calls, output)
- 🔧 **Session recovery** — detect and repair stuck sessions
- 📖 **Swagger API docs** — full OpenAPI 3.0 spec at `/api-docs`
- 🌙 **Dark mode** — system-aware theme

## Quick Start

```bash
# Clone the repo
git clone https://github.com/TimHoogervorst/Mobster.git
cd mobster

# Install and run
pnpm install
pnpm dev
```

Open `http://localhost:3000`. You'll be prompted to enter a GitHub Personal Access Token (generate at `github.com/settings/tokens` — classic token with `repo` and `read:user` scopes).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Database | SQLite (better-sqlite3 + Drizzle ORM) |
| Auth | Custom JWT (jose) + GitHub PAT |
| CSS | Tailwind CSS + shadcn/ui |
| GitHub API | Octokit |
| Agent SDK | Anthropic SDK + Claude Code CLI |
| API Docs | Swagger UI (swagger-ui-react) |
| Testing | Vitest + Playwright |
| Container | Docker + docker-compose |

## Documentation

| Doc | Description |
|-----|-------------|
| [Master Plan](.docs/00-master-plan.md) | Project overview & roadmap |
| [Architecture](.docs/01-architecture.md) | Container design & request flows |
| [Data Model](.docs/02-data-model.md) | Full schema & state machines |
| [Phase 3: UI Redesign](.docs/03-phase-3-ui-redesign.md) | Branding & consistency |
| [Phase 4: Performance](.docs/04-phase-4-performance.md) | Optimization & simplification |
| [V1.0 Finalization](.docs/05-v1-finalization.md) | Docker, docs, testing, security |
| [Backlog](.docs/backlog.md) | Known issues for investigation |

## License

AGPL v3 — see [LICENSE](LICENSE). Free for self-hosted use. Commercial licenses available for SaaS deployments.
