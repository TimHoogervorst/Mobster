# Mobster 🕵️

**AI-powered GitHub issue manager.** Connect your repos with a Personal Access Token, triage issues in a unified inbox, and let AI generate PRDs and write code overnight — all from a self-hosted web UI.

> **Phase 1 Complete** — GitHub sync, issue inbox, and PAT-based auth are working. See [Master Plan](.docs/00-master-plan.md).

## Features (Current)

- 🔗 **GitHub PAT auth** — paste a token, get instant access. No OAuth, no app registration.
- 📋 **Unified inbox** — filterable table of issues across all connected repos
- 🏷️ **Issue triage** — auto-classify bugs/features from labels, add local notes and tags
- 🔄 **Per-repo sync** — manual "Sync Now" button, incremental updates
- 🌙 **Dark mode** — system-aware theme

## Quick Start

```bash
# Clone the repo
git clone https://github.com/your-org/mobster.git
cd mobster

# Install and run
pnpm install
pnpm dev
```

Open `http://localhost:3000`. You'll be prompted to enter a GitHub Personal Access Token (generate at `github.com/settings/tokens` with `repo` and `read:user` scopes).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Database | SQLite (better-sqlite3 + Drizzle ORM) |
| Auth | Custom JWT (jose) + GitHub PAT |
| CSS | Tailwind CSS + shadcn/ui |
| GitHub API | Octokit |
| Testing | Vitest + Playwright |
| Container | Docker + docker-compose |

## Documentation

- [Master Plan](.docs/00-master-plan.md) — Project overview & roadmap
- [Architecture](.docs/01-architecture.md) — Container design & request flows
- [Data Model](.docs/02-data-model.md) — Full schema & state machines
- [API Design](.docs/03-api-design.md) — REST endpoints & error handling
- [UI/UX](.docs/05-ui-ux.md) — Screen designs & component specs
- [Testing Strategy](.docs/07-testing-strategy.md) — Test pyramid & CI
- [Security](.docs/08-security.md) — Threat model & encryption

## License

AGPL v3 — see [LICENSE](LICENSE). Free for self-hosted use. Commercial licenses available for SaaS deployments.
