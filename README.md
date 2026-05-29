# Mobster 🕵️

**AI-powered GitHub issue manager.** Connect your repos, generate PRDs with Claude, and let AI build features overnight — all from a self-hosted web UI.

> ⚠️ **Early Development** — Phase 0 (Foundation). Not yet ready for use.

## Vision

1. **Connect** your GitHub repositories
2. **Triage** issues and feature requests in a unified inbox
3. **Generate PRDs** with one click using Claude AI
4. **Review, edit, and combine** PRDs
5. **Schedule** them for overnight execution
6. **Wake up to open PRs** ready for review

## Tech Stack

- **Next.js 14+** (App Router) — full-stack TypeScript
- **SQLite** — zero-config database
- **Drizzle ORM** — type-safe queries
- **Tailwind CSS + shadcn/ui** — UI components
- **NextAuth.js** — GitHub OAuth
- **Anthropic SDK + Claude Code CLI** — AI agent
- **Docker** — one-command deployment

## Quick Start (Coming Soon)

```bash
# Clone the repo
git clone https://github.com/your-org/mobster.git
cd mobster

# Start with Docker
docker compose up

# Or run in dev mode
pnpm install
pnpm dev
```

## Documentation

- [Master Plan](.docs/00-master-plan.md)
- [Architecture](.docs/01-architecture.md)
- [Data Model](.docs/02-data-model.md)
- [Testing Strategy](.docs/07-testing-strategy.md)
- [Security](.docs/08-security.md)

## License

MIT — see [LICENSE](LICENSE) for details.
