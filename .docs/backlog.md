# Backlog

> Ongoing list of improvements, technical debt, and future ideas.  
> Items here are not scheduled — they're candidates for future planning.

---

## Technical Debt

### Standardize Sync Engine Boundaries

**Status:** Deferred  
**Raised:** 2026-06-04  
**Context:** Phase 3.5 planning (`35-project-phase-technical.md`)

The current sync engine (`sync.ts`) and its planned extension to the unified `items` table have a few rough edges that should be cleaned up:

1. **Normalization lives in the wrong place**: The `normalizeIssue()` / `normalizePullRequest()` logic currently sits in `apps/web/src/lib/github.ts` alongside the Octokit client. This mixes two concerns — API transport vs. data normalization. The normalization should move to a dedicated `lib/item-normalizer.ts` or a per-source normalizer module, keeping the GitHub client purely about API calls.

2. **Repo lookup is duplicated**: Both `syncIssues` and `syncPullRequests` independently look up the repo record and check for existence. This should be hoisted into a shared helper or the sync caller.

3. **The `DbClient` type is passed around everywhere**: Every sync function, normalizer, and helper takes `db` as a parameter. After the `items` table migration, we should consider a lightweight repository/dao layer so sync logic doesn't raw-Drizzle every query. This matters more as the number of tables grows with projects/phases/history.

4. **No provider abstraction**: The sync engine directly imports `createGitHubClient` and calls `listIssues` / `listPullRequests`. For future multi-source support (GitLab, Azure DevOps, etc.), the sync engine should call a generic `ItemProvider` interface instead — each source implements `listItems(repo, since?) → NormalizedItem[]`.

**What to do:**

| # | Task | Files |
|---|------|-------|
| 1 | Extract normalizers from `github.ts` into `lib/providers/github-normalizer.ts` | `lib/github.ts`, `lib/providers/github-normalizer.ts` |
| 2 | Hoist repo lookup into the sync route or a shared `getRepoOrThrow()` helper | `lib/sync.ts`, `api/repos/[id]/sync/route.ts` |
| 3 | Define `ItemProvider` interface with `listItems()` and `normalize()` | `lib/providers/types.ts` |
| 4 | Implement `GitHubProvider` implementing `ItemProvider` | `lib/providers/github-provider.ts` |
| 5 | Refactor `syncIssues` / `syncPullRequests` to use `ItemProvider` | `lib/sync.ts` |

**Target:** After Phase 0 (unified `items` table) ships and is stable. Before Phase 2 (Intake Hub) if possible, since the Intake page will query the unified table and benefits from clean sync boundaries.

**Why now matters**: The standardization of the `items` table is the right time to also standardize how items get into that table. Doing the items migration first, then cleaning up the sync boundaries, avoids baking the messy patterns into the new unified model.

---

### Project Detail Page Performance Audit

**Status:** Deferred (needs measurement first)  
**Raised:** 2026-06-04  
**Context:** Phase 3.5 planning (`35-project-phase-technical.md`)

The project detail page (`/projects/[id]`) fetches project → phases → project_items → items (JOIN) → history. In a naive implementation, this produces:

```
1 project query + 1 repo query + 1 phases query
  + N queries for project_items per phase
  + N×M queries for item display data
  + 1 history query
```

For a project with 3 phases × 4 items = ~18 queries. For larger projects this grows linearly.

**Plan**: Build naively first, measure with real data. If page load exceeds ~500ms, apply optimizations in order:

| Priority | Optimization | Impact |
|----------|-------------|--------|
| 1 | Batch item JOIN — single `WHERE id IN (...)` instead of per-item queries | 12 queries → 1 |
| 2 | Prefetch all project_items in one pass, group by phaseId in code | N phase queries → 1 |
| 3 | Drizzle `innerJoin` to fetch items + item data in one trip | Eliminates the N×M entirely |
| 4 | React `<Suspense>` per phase card — stream phases progressively | Perceived load time drops |
| 5 | History cursor-based pagination ("Load more") | Caps history query cost |

**Decision gate**: Measure first. Don't optimize prematurely. The existing Phase 4 performance sweep (see `04-phase-4-performance.md`) already covers N+1 elimination — roll this page into that effort if needed.

---

## Features (Future Candidates)

### Multi-Platform Issue Providers
Connect Azure DevOps, GitLab, Linear, and Jira as item sources. The standardized `items` table and `ItemProvider` interface make this a well-scoped addition.

### Runner Communication Channel
Bidirectional communication between AI runners and users during PRD generation and integration. Runners can ask clarifying questions; users can send mid-run feedback.

### Project Templates
Pre-defined phase structures for common workflows: "Bug Fix Release" (integration → testing → finalization), "Feature Sprint" (planning → integration → testing → review → merge).

### Release Notes Auto-Generation
Generate release notes from project history entries. Pull item titles, PR links, and integration summaries into a markdown changelog.

### Dashboard Metrics & Token Usage
Usage charts, agent success rates, cost projection, and activity timelines. Track `input_tokens`, `output_tokens` per agent/build session.

---

### Migrate Runners & PRDs to Events API

**Status:** Planned — Phase 3.6c  
**Raised:** 2026-06-04  
**Context:** [`36-event-logger-api.md`](36-event-logger-api.md)

Once the Events API ships with API key support, migrate the existing `agent_logs` / `SessionLogger` / `runner-log-viewer.tsx` stack onto the unified `event_log` + `EventLogger` + `EventTimeline` platform. This is scoped as a dedicated phase (3.6c), not technical debt — the migration builds on a stable external API rather than refactoring internal plumbing. Full plan in [`36-event-logger-api.md`](36-event-logger-api.md#phase-36c-migrate-existing-systems-post-v10).
