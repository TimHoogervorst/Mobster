# Phase 3.5: Projects & Intake Hub — Technical Implementation

> **Companion to:** `35-project-phase.md` (vision & product spec)  
> **Status:** Planning  
> **Target:** Post-Phase 2, pre-V1.0

---

## Design Principle: Standardized Item Model

### The Problem with Per-Source Tables

The current implementation has a single `issues` table tightly coupled to GitHub. If we add pull request syncing the natural instinct is a second `pull_requests` table. Then later: `azure_devops_work_items`, `gitlab_issues`, `linear_tickets`, `jira_issues`... and `project_items` needs a polymorphic `itemType` + `itemId` that points to N different tables.

This explodes in complexity. Every new source requires:
- A new table
- New Zod schemas
- New filter components
- New branches in every query that touches items
- N-way polymorphic references in project_items

### The Solution: One `items` Table to Rule Them All

A single `items` table is the **canonical work item** in Mobster. Every piece of work — regardless of where it came from — becomes an `item` with a common schema.

**80/20 rule**: ~80% of fields are universal across all sources (title, description, type, state, labels, assignee, repo). The ~20% that are source-specific go into a `sourceData` JSON column.

```
                    ┌─────────────────────────┐
                    │        items             │
                    │  (canonical work item)   │
                    │                          │
                    │  id, title, description  │
                    │  itemType, status, size  │
                    │  requiresReview, origin  │
                    │  source, sourceId        │
                    │  sourceData (JSON)       │
                    │  labels, assignee, etc.  │
                    │  repoId, userNotes, ...  │
                    └──────────┬──────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
    source: 'github'    source: 'gitlab'    source: 'manual'
    sourceData: {        sourceData: {      sourceData: null
      githubId: ..,        gitlabId: ..,
      number: ..,          iid: ..,
      url: ..,             webUrl: ..,
      ...                  ...
    }                    }
```

### Benefits

| Aspect | Polymorphic (old) | Standardized (new) |
|--------|-------------------|-------------------|
| New source | New table + schema + components | Add `source` enum value, map into `sourceData` |
| Project references | `itemType` + `itemId` pointing to N tables | Single FK: `items.id` |
| Filtering | Per-source filter components | One filter system, source-aware tabs |
| Metadata | Schema changes per source | `sourceData` JSON — no migration needed |
| Size/review tracking | Nowhere to put it | Built-in `size` and `requiresReview` columns |
| Query complexity | UNIONs across tables or N queries | Single table query |

### Source Abstraction Layer

Future sources implement a simple interface:

```typescript
interface ItemProvider {
  source: ItemSource                    // 'github' | 'gitlab' | 'azure-devops' | ...
  listItems(repo, since?): Promise<NormalizedItem[]>
  normalize(raw: unknown): NormalizedItem
}
```

The sync engine calls the provider, gets back `NormalizedItem[]`, and upserts into the unified `items` table. The Intake page queries `items` filtered by source tabs — no new tables needed.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      NEW LAYER                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │
│  │ Intake   │  │ Projects │  │ Project      │              │
│  │ Hub      │  │ List     │  │ Detail/Board │              │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘              │
│       │             │               │                        │
│  ┌────┴─────────────┴───────────────┴────────────────────┐  │
│  │                  NEW API LAYER                         │  │
│  │  /api/items   /api/projects/*                         │  │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │                                   │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │             UNIFIED ITEMS TABLE                         │  │
│  │  items  ←── GitHub issues, PRs, manual, (future:       │  │
│  │            GitLab, Azure DevOps, Linear, Jira, ...)     │  │
│  │                                                         │  │
│  │  projects  project_phases  project_items                │  │
│  │  event_log                                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              EXISTING (UNCHANGED)                       │  │
│  │  prds  prd_issues  build_jobs  agents                  │  │
│  │  agent_logs  github_repos  users  app_settings         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              LEGACY (migrated → items)                  │  │
│  │  issues  (kept read-only during transition,            │  │
│  │           then dropped after migration verified)        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key change from v1 of this doc**: The separate `pull_requests` table is gone. Instead, a single `items` table holds everything — GitHub issues, GitHub PRs, manually created bugs/features, and all future source types. `project_items` always references `items.id` directly — no more polymorphic FK.

---

## Phase 0: Unified Items Table

This phase creates the standardized `items` table, extends the sync engine to populate it (issues + PRs), migrates existing data, and provides a single `/api/items` endpoint.

### 0.1 Database: `items` table

**File: `packages/db/src/schema.ts`**

Add the unified `items` table. This replaces the need for separate `issues` and `pull_requests` tables going forward:

```typescript
export const items = sqliteTable('items', {
  id: text('id').primaryKey(),

  // ─── Core identity ───
  title: text('title').notNull(),
  description: text('description'),
  itemType: text('item_type')
    .notNull()
    .$type<'bug' | 'feature' | 'pull_request' | 'task' | 'question' | 'other'>(),

  // ─── State ───
  status: text('status')
    .notNull()
    .$type<'open' | 'closed' | 'merged' | 'draft'>(),

  // ─── Source abstraction ───
  source: text('source')
    .notNull()
    .$type<'github' | 'manual'>(),
    // Future: 'azure-devops' | 'gitlab' | 'linear' | 'jira' | 'webhook'
  sourceId: text('source_id'),         // External ID (e.g., GitHub issue number as string)
  sourceUrl: text('source_url'),       // Link back to original
  sourceData: text('source_data'),     // JSON blob for source-specific fields

  // ─── Classification ───
  size: text('size').$type<'xs' | 'small' | 'medium' | 'large' | 'xl'>(),
  requiresReview: integer('requires_review').notNull().default(1),
  reviewReason: text('review_reason'),

  // ─── Repo association ───
  repoId: text('repo_id')
    .notNull()
    .references(() => githubRepos.id, { onDelete: 'cascade' }),

  // ─── Denormalized common fields (for query performance) ───
  number: integer('number'),           // GitHub issue/PR number (or equivalent)
  labels: text('labels'),              // JSON array string
  assignee: text('assignee'),
  author: text('author'),              // PR author / issue reporter
  milestone: text('milestone'),

  // ─── PR-specific (nullable, also captured in sourceData) ───
  headBranch: text('head_branch'),
  baseBranch: text('base_branch'),
  isDraft: integer('is_draft').default(0),

  // ─── GitHub-specific denormalized (for backward compat during migration) ───
  githubId: integer('github_id'),
  githubCreatedAt: text('github_created_at'),
  githubUpdatedAt: text('github_updated_at'),

  // ─── Local annotations ───
  userNotes: text('user_notes'),
  userTags: text('user_tags'),

  // ─── Origin tracking ───
  origin: text('origin')
    .notNull()
    .$type<'sync' | 'manual' | 'project'>(),
    // 'sync'    = came from a connected source (GitHub, etc.)
    // 'manual'  = created by user in Intake
    // 'project' = created directly inside a project

  // ─── Timestamps ───
  syncedAt: text('synced_at'),         // Last time source data was refreshed
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

**`sourceData` JSON structure** — examples per source:

```typescript
// GitHub Issue
{ "githubId": 123456, "issueNumber": 42, "stateReason": "completed",
  "reactions": {...}, "commentsCount": 5 }

// GitHub Pull Request
{ "githubId": 789012, "prNumber": 55, "mergedAt": "2026-06-01T...",
  "additions": 120, "deletions": 45, "changedFiles": 7,
  "mergeCommitSha": "abc123..." }

// Manually created (in Intake or in-project)
{ "createdVia": "intake" }  // or { "createdVia": "project", "projectId": "..." }

// Future: GitLab
{ "gitlabId": 999, "iid": 12, "webUrl": "https://gitlab.com/...", ... }

// Future: Jira
{ "jiraId": "PROJ-123", "jiraKey": "PROJ-123", "issueType": "Story", ... }
```

### 0.2 Size & Review Classification

The `size` and `requiresReview` fields form a simple triage system:

| Size | Typical scope | Default review? | Rationale |
|------|--------------|-----------------|-----------|
| `xs` | Typo, config tweak, one-line fix | No | Trivial, low risk |
| `small` | Single function change, dependency bump | Optional | Usually safe |
| `medium` | Multi-file change, new feature | Yes | Needs human review |
| `large` | New module, API change | Yes | High impact |
| `xl` | Architecture change, major refactor | Yes | Requires deep review |

- `size` can be auto-detected by the AI agent during PRD generation (based on codebase exploration) or set manually
- `requiresReview` defaults to `1` (true). Small bugs/features can be flagged as `requiresReview: 0` to skip the PRD review gate and go straight to integration
- `reviewReason` explains why review is/isn't needed (e.g., "touches auth system", "low-risk dependency update", "cosmetic only")
- **Every action is still logged** in the project history — skipping review doesn't skip the audit trail, it just streamlines the workflow for low-risk items

Auto-detection during PRD generation (future enhancement):
```
Agent explores codebase → determines change scope → sets item.size
Based on size + affected modules → sets item.requiresReview + item.reviewReason
```

### 0.3 Embedded DDL

**File: `packages/db/src/schema-ddl.ts`**

Append `CREATE TABLE IF NOT EXISTS items (...)` to `SCHEMA_DDL`, matching the existing pattern for all columns above.

Also append an index for common queries:
```sql
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
CREATE INDEX IF NOT EXISTS idx_items_repo_id ON items(repo_id);
CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(item_type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_origin ON items(origin);
```

### 0.4 GitHub Client Extension

**File: `apps/web/src/lib/github.ts`**

Add `GitHubPullRequest` interface and `listPullRequests(owner, repo, since?)`. Mirrors `listIssues` pattern but uses `octokit.rest.pulls.list`. Also keep the existing `listIssues` method.

The key change: both methods return `NormalizedItem` structs (see below) rather than raw GitHub shapes. The normalization happens at the client boundary.

```typescript
export interface NormalizedItem {
  title: string
  description: string | null
  itemType: 'bug' | 'feature' | 'pull_request' | 'task' | 'question' | 'other'
  status: 'open' | 'closed' | 'merged' | 'draft'
  source: 'github'
  sourceId: string
  sourceUrl: string
  sourceData: Record<string, unknown>
  number: number
  labels: string[]
  assignee: string | null
  author: string | null
  milestone: string | null
  // PR-specific (null for issues)
  headBranch: string | null
  baseBranch: string | null
  isDraft: boolean
  // GitHub denormalized
  githubId: number
  githubCreatedAt: string
  githubUpdatedAt: string
}
```

The existing `listIssues` method is updated to return `NormalizedItem[]` using a `normalizeIssue()` helper. The new `listPullRequests` returns `NormalizedItem[]` via `normalizePullRequest()`.

### 0.5 Sync Engine — Unified

**File: `apps/web/src/lib/sync.ts`**

Replace the current `syncRepo` (which writes to `issues` table) with two functions that both write to the unified `items` table:

```typescript
export async function syncIssues(
  db: DbClient,
  accessToken: string,
  repoId: string,
): Promise<SyncResult> {
  const github = createGitHubClient(accessToken)
  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, repoId)).get()
  if (!repo) throw new Error(`Repo not found: ${repoId}`)

  const since = repo.syncedAt ? new Date(repo.syncedAt) : undefined
  const normalizedItems = await github.listIssues(repo.owner, repo.name, since)

  let created = 0
  let updated = 0
  const now = new Date().toISOString()

  for (const ni of normalizedItems) {
    const existing = db.select({ id: items.id })
      .from(items)
      .where(and(eq(items.source, 'github'), eq(items.sourceId, ni.sourceId), eq(items.repoId, repoId)))
      .get()

    if (existing) {
      db.update(items).set({
        title: ni.title, description: ni.description,
        status: ni.status, labels: JSON.stringify(ni.labels),
        assignee: ni.assignee, milestone: ni.milestone,
        sourceData: JSON.stringify(ni.sourceData),
        githubUpdatedAt: ni.githubUpdatedAt,
        syncedAt: now, updatedAt: now,
      }).where(eq(items.id, existing.id)).run()
      updated++
    } else {
      db.insert(items).values({
        id: uuid(),
        title: ni.title, description: ni.description,
        itemType: ni.itemType, status: ni.status,
        source: 'github', sourceId: ni.sourceId,
        sourceUrl: ni.sourceUrl,
        sourceData: JSON.stringify(ni.sourceData),
        size: null, requiresReview: 1,
        repoId, number: ni.number,
        labels: JSON.stringify(ni.labels),
        assignee: ni.assignee, author: ni.author,
        milestone: ni.milestone,
        headBranch: ni.headBranch, baseBranch: ni.baseBranch,
        isDraft: ni.isDraft ? 1 : 0,
        githubId: ni.githubId,
        githubCreatedAt: ni.githubCreatedAt,
        githubUpdatedAt: ni.githubUpdatedAt,
        origin: 'sync',
        syncedAt: now, createdAt: now, updatedAt: now,
      }).run()
      created++
    }
  }

  return { repoId: repo.id, fullName: repo.fullName, created, updated, skipped: 0, syncedAt: now }
}

// syncPullRequests follows the same pattern as syncIssues but calls github.listPullRequests()
export async function syncPullRequests(
  db: DbClient,
  accessToken: string,
  repoId: string,
): Promise<SyncResult> {
  // Same structure as syncIssues — iterates normalized items, upserts into `items` table
  // PRs get itemType: 'pull_request', status mapped: open→'open', closed+merged→'merged', closed+!merged→'closed'
}
```

**Issue type classification** (from labels) is now done inside `normalizeIssue()` in the GitHub client, not in the sync engine. This keeps the sync engine source-agnostic.

### 0.6 Migration from `issues` Table

**File: `apps/web/src/lib/migrate-to-items.ts`** (new, one-shot)

A startup migration that runs once:

```typescript
export function migrateIssuesToItems(db: DbClient): void {
  // Check if migration already ran
  const flag = db.select().from(appSettings).where(eq(appSettings.key, 'migrated_issues_to_items')).get()
  if (flag) return

  const existingIssues = db.select().from(issues).all()
  const now = new Date().toISOString()

  for (const issue of existingIssues) {
    // Check if already in items table
    const exists = db.select({ id: items.id })
      .from(items)
      .where(and(eq(items.source, 'github'), eq(items.githubId, issue.githubId)))
      .get()
    if (exists) continue

    db.insert(items).values({
      id: issue.id,  // Preserve existing IDs so PRD links don't break
      title: issue.title,
      description: issue.body,
      itemType: issue.issueType || 'other',
      status: issue.state,
      source: 'github',
      sourceId: String(issue.githubId),
      sourceUrl: issue.githubUrl,
      sourceData: JSON.stringify({
        githubId: issue.githubId,
        issueNumber: issue.number,
        migratedFrom: 'issues_table',
      }),
      size: null, requiresReview: 1,
      repoId: issue.repoId,
      number: issue.number,
      labels: issue.labels,
      assignee: issue.assignee,
      milestone: issue.milestone,
      githubId: issue.githubId,
      githubCreatedAt: issue.githubCreatedAt,
      githubUpdatedAt: issue.githubUpdatedAt,
      userNotes: issue.userNotes,
      userTags: issue.userTags,
      origin: 'sync',
      syncedAt: now,
      createdAt: issue.createdAt,
      updatedAt: now,
    }).run()
  }

  // Mark migration as done
  db.insert(appSettings).values({ key: 'migrated_issues_to_items', value: 'true', updatedAt: now }).run()
}
```

Called from `initializeApp()` in `startup.ts` after `ensureSchema()`. Preserves existing issue IDs so `prd_issues` junction references remain valid.

### 0.7 Items API Route

**File: `apps/web/src/app/api/items/route.ts`** (new)

Unified GET endpoint replacing `api/issues/route.ts` (and the never-built `api/pull-requests/route.ts`):

- **Filters**: `source` (github/manual), `itemType` (bug/feature/pull_request/...), `status` (open/closed/merged/draft), `repo`, `size`, `requiresReview`, `label`, `q` (search), `origin`
- **Pagination**: `page`, `pageSize`
- **Sort**: `sort` (updatedAt, createdAt, title, number), `order` (asc/desc)

Response:
```json
{
  "items": [...],
  "total": 142,
  "page": 1,
  "pageSize": 25
}
```

### 0.8 Shared Types

**File: `packages/shared/src/index.ts`**

Add:
```typescript
export const ITEM_SOURCES = ['github', 'manual'] as const
export type ItemSource = (typeof ITEM_SOURCES)[number]

export const ITEM_ORIGINS = ['sync', 'manual', 'project'] as const
export type ItemOrigin = (typeof ITEM_ORIGINS)[number]

export const ITEM_SIZES = ['xs', 'small', 'medium', 'large', 'xl'] as const
export type ItemSize = (typeof ITEM_SIZES)[number]

export const ITEM_STATUSES = ['open', 'closed', 'merged', 'draft'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

// ITEM_TYPES replaces the old ISSUE_TYPES
export const ITEM_TYPES = ['bug', 'feature', 'pull_request', 'task', 'question', 'other'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export const ItemUpdateInput = z.object({
  userNotes: z.string().max(10000).optional(),
  userTags: z.array(z.string().max(50)).max(10).optional(),
  itemType: z.enum(ITEM_TYPES).optional(),
  size: z.enum(ITEM_SIZES).optional(),
  requiresReview: z.boolean().optional(),
  reviewReason: z.string().max(500).optional(),
})

export const ItemCreateInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  itemType: z.enum(['bug', 'feature', 'pull_request', 'task']),
  repoId: z.string().uuid(),
  size: z.enum(ITEM_SIZES).optional(),
  requiresReview: z.boolean().optional(),
  reviewReason: z.string().max(500).optional(),
})
```

---

## Phase 1: Projects Data Model + API

### 1.1 Database: Four New Tables

**File: `packages/db/src/schema.ts`**

#### `projects`

```typescript
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status')
    .notNull()
    .$type<'draft' | 'active' | 'testing' | 'complete' | 'archived'>(),
  repoId: text('repo_id')
    .notNull()
    .references(() => githubRepos.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

Status flow: `draft → active → testing → complete` (or `archived` from any state).

#### `project_phases`

```typescript
export const projectPhases = sqliteTable('project_phases', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  phaseType: text('phase_type')
    .notNull()
    .$type<'integration' | 'testing' | 'review'>(),
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status')
    .notNull()
    .$type<'pending' | 'active' | 'passed' | 'failed'>(),
  gateCriteria: text('gate_criteria'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

Status flow: `pending → active → passed` (or `failed` from `active`).

#### `project_items`

```typescript
export const projectItems = sqliteTable('project_items', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  phaseId: text('phase_id')
    .notNull()
    .references(() => projectPhases.id, { onDelete: 'cascade' }),
  itemId: text('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
    // ↑ Always references the unified items table — no polymorphism needed
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status')
    .notNull()
    .$type<'pending' | 'in_progress' | 'integrated' | 'tested' | 'passed' | 'failed' | 'on_hold'>(),
  prdId: text('prd_id').references(() => prds.id, { onDelete: 'set null' }),
  // For cross-project PRs: references the source project
  sourceProjectId: text('source_project_id'),
  sourceItemId: text('source_item_id'),
  addedAt: text('added_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

**No more polymorphic FK**: `itemId` always references `items.id`. The item's type, source, size, and origin are all on the `items` table itself — `project_items` only needs to know *which* item and *where* it sits in the project structure.

**Origin tracking**: The `items.origin` field records whether the item came from a sync (`'sync'`), was manually created in the Intake (`'manual'`), or was created directly inside a project (`'project'`). No separate `origin` column needed on `project_items`.

**Cross-project references**: `sourceProjectId` and `sourceItemId` optionally link back to another project's item. Used when a PR item in Project B (v1.1) is created to merge work completed in Project A (hotfix v1.0). This preserves the lineage without breaking the "one item, one project" rule — the item still belongs only to Project B, but carries a pointer to its origin.

Status flow: `pending → in_progress → integrated → tested → passed` (or `failed` / `on_hold` at any point).

**`on_hold` status**: An item can be put on hold from `pending`, `in_progress`, or `integrated`. This pauses the item — it's excluded from gate advancement checks (a phase with held items can still advance if all non-held items are complete). Held items must be resolved (returned to their previous status or marked `failed`) before the project can be completed.

#### `event_log` — Unified event log (replaces separate `project_history`)

Instead of a project-specific history table, we use a single `event_log` table that serves all entity types — projects, agent sessions, builds, and future use cases. This is an evolution of the existing `agent_logs` table, generalized to support any entity.

```typescript
export const eventLog = sqliteTable('event_log', {
  id: text('id').primaryKey(),

  // ─── Entity context — what is this event about? ───
  entityType: text('entity_type')
    .notNull()
    .$type<'project' | 'prd' | 'build' | 'agent_session'>(),
    // Future: 'item', 'release', 'repo', etc.
  entityId: text('entity_id').notNull(),
    // References the entity by its table's PK (projects.id, prds.id, etc.)
    // Not a true FK — polymorphic, handled at app layer like the existing agent_logs.prd_id

  // ─── Optional parent entity (for hierarchical events) ───
  parentEntityType: text('parent_entity_type'),
  parentEntityId: text('parent_entity_id'),
    // e.g., a phase event has parent: { entityType: 'project', entityId: project.id }

  // ─── Event classification ───
  eventType: text('event_type').notNull(),
    // Namespaced: '{domain}.{action}'
    // Project: 'project.created', 'project.activated', 'phase.started',
    //          'phase.passed', 'item.added', 'item.integrated', 'item.on_hold', ...
    // Agent:   'agent.thinking', 'agent.tool_call', 'agent.tool_result',
    //          'agent.output', 'agent.error', 'agent.status'
    // Build:   'build.queued', 'build.started', 'build.completed', 'build.failed'

  // ─── Session grouping (used by agent sessions, optional for projects) ───
  sessionId: text('session_id'),
    // For agent runs: 'prd-{prdId}-v{version}' or 'build-{prdId}-v{version}'
    // For project integration runs: 'project-{projectId}-integrate-{itemId}'

  // ─── Human-readable ───
  summary: text('summary'),
    // One-line description: "Phase 'Bug Fixes' passed all gates"

  // ─── Payload ───
  content: text('content'),
    // For agent events: thinking text, tool output, error message
    // For project events: usually null (summary is sufficient)
  metadata: text('metadata'),
    // JSON blob: { phaseId, itemId, buildJobId, prUrl, previousStatus, newStatus, ... }

  createdAt: text('created_at').notNull(),
})
```

**Why one table instead of two:**

| Aspect | Two tables (`agent_logs` + `project_history`) | One `event_log` |
|--------|-----------------------------------------------|-----------------|
| Query project history | `SELECT * FROM project_history WHERE project_id = ?` | `SELECT * FROM event_log WHERE entity_type = 'project' AND entity_id = ?` |
| Query agent session | `SELECT * FROM agent_logs WHERE session_id = ?` | `SELECT * FROM event_log WHERE session_id = ?` |
| Cross-entity timeline | UNION across tables with different columns | Single query: `WHERE entity_id IN (...)` |
| Add new entity type | New table + new logger + new UI | New `entity_type` value, same logger, same UI |
| UI components | Separate timeline components | One `EventTimeline` component, entity-aware rendering |

**Migration path from existing `agent_logs`**: Not part of Phase 3.5 — the existing `agent_logs` table continues to work. Migration to the unified `event_log` is scoped as Phase 3.6c, which builds on the Events API (see [`36-event-logger-api.md`](36-event-logger-api.md)).

#### `EventLogger` — Internal logger class

**File: `apps/web/src/lib/event-logger.ts`** (new)

A generalized version of the existing `SessionLogger`, usable by both agent runners and project operations:

```typescript
import { v4 as uuid } from 'uuid'
import type { DbClient } from '@mobster/db'
import { eventLog } from '@mobster/db'

export type EntityType = 'project' | 'prd' | 'build' | 'agent_session'

export class EventLogger {
  private db: DbClient
  private entityType: EntityType
  private entityId: string
  private parentEntityType?: EntityType
  private parentEntityId?: string
  private sessionId?: string

  constructor(opts: {
    db: DbClient
    entityType: EntityType
    entityId: string
    parentEntityType?: EntityType
    parentEntityId?: string
    sessionId?: string
  }) {
    this.db = opts.db
    this.entityType = opts.entityType
    this.entityId = opts.entityId
    this.parentEntityType = opts.parentEntityType
    this.parentEntityId = opts.parentEntityId
    this.sessionId = opts.sessionId
  }

  /** Core log method — everything flows through here */
  log(eventType: string, opts?: {
    summary?: string
    content?: string
    metadata?: Record<string, unknown>
  }): void {
    try {
      this.db.insert(eventLog).values({
        id: uuid(),
        entityType: this.entityType,
        entityId: this.entityId,
        parentEntityType: this.parentEntityType ?? null,
        parentEntityId: this.parentEntityId ?? null,
        eventType,
        sessionId: this.sessionId ?? null,
        summary: opts?.summary ?? null,
        content: opts?.content ?? null,
        metadata: opts?.metadata ? JSON.stringify(opts.metadata) : null,
        createdAt: new Date().toISOString(),
      }).run()
    } catch (err) {
      console.error('EventLogger: failed to write event', err)
    }
  }
}
```

**Usage for project events:**

```typescript
const logger = new EventLogger({ db, entityType: 'project', entityId: project.id })

// Lifecycle
logger.log('project.created', { summary: 'Project "Release v1.1" created' })
logger.log('project.activated', { summary: 'Project activated', metadata: { previousStatus: 'draft' } })

// Phases (parented to the project)
const phaseLogger = new EventLogger({
  db, entityType: 'project', entityId: phase.id,
  parentEntityType: 'project', parentEntityId: project.id,
})
phaseLogger.log('phase.started', { summary: `Phase "${phase.name}" started` })
phaseLogger.log('phase.passed', { summary: `Phase "${phase.name}" completed — all items integrated` })

// Items
logger.log('item.added', {
  summary: `Bug #42 "Login crash" added to phase "Bug Fixes"`,
  metadata: { itemId, phaseId, itemType: 'bug', origin: 'intake' },
})
logger.log('item.integrated', {
  summary: `Bug #42 integrated successfully`,
  metadata: { itemId, buildJobId, prUrl: 'https://github.com/...' },
})
```

**Usage for agent sessions** (replaces current `SessionLogger` — future migration):

```typescript
const logger = new EventLogger({
  db, entityType: 'agent_session', entityId: prdId,
  sessionId: `prd-${prdId}-v${version}`,
})

logger.log('agent.thinking', { content: 'Let me explore the codebase first...' })
logger.log('agent.tool_call', { summary: 'Calling read_file', metadata: { toolName: 'read_file', toolInput: {...} } })
logger.log('agent.status', { summary: 'PRD generation started' })
```

Common action values: `project_created`, `project_activated`, `project_completed`, `phase_created`, `phase_started`, `phase_passed`, `phase_failed`, `item_added`, `item_removed`, `item_integrated`, `item_failed`, `item_tested`, `bug_added`, `gate_checked`, `gate_failed`.

### 1.2 Build Jobs Extension

**File: `packages/db/src/schema.ts`** — Add to `buildJobs`:

```typescript
projectItemId: text('project_item_id').references(() => projectItems.id, { onDelete: 'set null' }),
```

**File: `packages/db/src/schema-ddl.ts`** — Append:

```sql
ALTER TABLE build_jobs ADD COLUMN project_item_id text;
```

Wrap in the existing try/catch pattern used for other ALTER TABLE statements in `ensureSchema()`.

### 1.3 Embedded DDL for New Tables

**File: `packages/db/src/schema-ddl.ts`**

Append `CREATE TABLE IF NOT EXISTS` statements for all four new tables to the `SCHEMA_DDL` string, following the exact same formatting as existing statements.

### 1.4 Barrel Export

**File: `packages/db/src/index.ts`**

Add exports for all new tables: `projects`, `projectPhases`, `projectItems`, `eventLog`.

### 1.5 Shared Types

**File: `packages/shared/src/index.ts`**

Status enums:
```typescript
export const PROJECT_STATUSES = ['draft', 'active', 'testing', 'complete', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PHASE_TYPES = ['integration', 'testing', 'review'] as const
export type PhaseType = (typeof PHASE_TYPES)[number]

export const PHASE_STATUSES = ['pending', 'active', 'passed', 'failed'] as const
export type PhaseStatus = (typeof PHASE_STATUSES)[number]

export const PROJECT_ITEM_STATUSES = ['pending', 'in_progress', 'integrated', 'tested', 'passed', 'failed', 'on_hold'] as const
export type ProjectItemStatus = (typeof PROJECT_ITEM_STATUSES)[number]

// Note: ITEM_TYPES, ITEM_SOURCES, ITEM_SIZES, ITEM_STATUSES (open/closed/merged/draft)
// are defined on the items table in Phase 0.8. PROJECT_ITEM_STATUSES is the pipeline
// status within a project phase — a separate concept from the item's own status.
```

Zod schemas:
```typescript
export const ProjectCreateInput = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  repoId: z.string().uuid(),
})

export const ProjectUpdateInput = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
})

export const ProjectAddItemsInput = z.object({
  items: z.array(z.object({
    itemId: z.string().uuid(),     // Always references items.id — no itemType needed
    phaseId: z.string().uuid(),
    sortOrder: z.number().int().min(0).optional(),
  })).min(1).max(50),
})

export const ProjectCreateItemInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  itemType: z.enum(['bug', 'feature', 'pull_request', 'task']),
  phaseId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
  // For cross-project PRs
  sourceProjectId: z.string().uuid().optional(),
  sourceBranch: z.string().optional(),   // e.g. "hotfix/v1.0"
  targetBranch: z.string().optional(),   // e.g. "main" (defaults to repo default)
})

export const ProjectPhaseCreateInput = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  phaseType: z.enum(PHASE_TYPES),
  gateCriteria: z.string().optional(),
})

export const ProjectPhaseUpdateInput = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(PHASE_STATUSES).optional(),
  gateCriteria: z.string().optional(),
})

export const ProjectItemUpdateInput = z.object({
  status: z.enum(PROJECT_ITEM_STATUSES).optional(),
  sortOrder: z.number().int().min(0).optional(),
})
```

### 1.6 API Routes

Every route follows the established pattern: `const session = await auth()` (401 if null) → `const db = getDb()` → Zod validation → `NextResponse.json()`.

#### `api/projects/route.ts` (new)
- **GET** — List projects. Params: `status`, `repo`, `page`, `pageSize`, `sort`, `order`. Returns paginated list with item/phase counts enriched.
- **POST** — Create project. Body validated with `ProjectCreateInput`. Creates project, records history entry. Returns created project.

#### `api/projects/[id]/route.ts` (new)
- **GET** — Project detail. Returns project with all phases (ordered by `sortOrder`), items per phase (ordered by `sortOrder`, enriched with display data from issues/PRs/PRDs tables via JOINs), and recent history entries.
- **PATCH** — Update project. Body validated with `ProjectUpdateInput`. Records history on status changes.
- **DELETE** — Delete project (cascades to phases, items, history).

#### `api/projects/[id]/phases/route.ts` (new)
- **GET** — List phases for a project (ordered by `sortOrder`).
- **POST** — Create phase. Body validated with `ProjectPhaseCreateInput`. Auto-assigns `sortOrder` as max+1.

#### `api/projects/[id]/phases/[phaseId]/route.ts` (new)
- **PATCH** — Update phase. Body validated with `ProjectPhaseUpdateInput`. Records history on status changes.
- **DELETE** — Delete phase (with confirmation that no in-progress items exist).

#### `api/projects/[id]/items/route.ts` (new)
- **GET** — List items. Filterable by `phaseId`, `status`, `itemType`.
- **POST** — Add items from Intake. Body validated with `ProjectAddItemsInput`. Validates items exist in their respective tables. Validates items aren't already in this project. Records history.

#### `api/projects/[id]/items/create/route.ts` (new)
- **POST** — Create a new item directly within the project (no Intake source). Body validated with `ProjectCreateItemInput`.
  - Creates a record in the unified `items` table with `origin: 'project'` and the appropriate `itemType` (`bug`, `feature`, `pull_request`, or `task`)
  - Creates the `project_items` junction row pointing to the new record
  - For cross-project PRs with `sourceProjectId` set: stores the back-reference, resolves `sourceBranch` → `targetBranch` from the referenced project's completed integrations
  - Records history: `item_created_in_project`
  - Returns the created item with its new IDs

#### `api/projects/[id]/items/[itemId]/route.ts` (new)
- **PATCH** — Update item. Body validated with `ProjectItemUpdateInput`. Records history on status changes.
- **DELETE** — Remove item from project. Records history.

### 1.7 Server Utility: Phase Gate Logic

**File: `apps/web/src/lib/project-gates.ts`** (new)

```typescript
import type { DbClient } from '@mobster/db'
import { projectPhases, projectItems } from '@mobster/db'
import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

/**
 * Check if all items in a phase have reached a "completed" status.
 * For integration phases: all items must be 'integrated' or beyond.
 * For testing phases: all items must be 'tested' or beyond.
 * For review phases: all items must be 'passed'.
 */
export function canAdvancePhase(db: DbClient, phaseId: string): boolean {
  const phase = db.select().from(projectPhases).where(eq(projectPhases.id, phaseId)).get()
  if (!phase) return false

  const items = db.select().from(projectItems).where(eq(projectItems.phaseId, phaseId)).all()
  // Exclude on_hold items from gate checks — they're intentionally paused
  const activeItems = items.filter((item) => item.status !== 'on_hold')
  if (activeItems.length === 0) return false

  const terminalStatuses = {
    integration: ['integrated', 'tested', 'passed'],
    testing: ['tested', 'passed'],
    review: ['passed'],
  }

  const valid = terminalStatuses[phase.phaseType] || ['passed']
  return activeItems.every((item) => valid.includes(item.status))
}

/**
 * Transition a phase to 'passed' and record history.
 */
export function advancePhase(db: DbClient, phaseId: string): void {
  const now = new Date().toISOString()
  db.update(projectPhases)
    .set({ status: 'passed', completedAt: now, updatedAt: now })
    .where(eq(projectPhases.id, phaseId))
    .run()
}

/**
 * Find the next pending phase (by sortOrder) and activate it.
 */
export function activateNextPhase(db: DbClient, projectId: string): void {
  const next = db
    .select()
    .from(projectPhases)
    .where(and(eq(projectPhases.projectId, projectId), eq(projectPhases.status, 'pending')))
    .orderBy(projectPhases.sortOrder)
    .limit(1)
    .get()

  if (!next) return

  const now = new Date().toISOString()
  db.update(projectPhases)
    .set({ status: 'active', startedAt: now, updatedAt: now })
    .where(eq(projectPhases.id, next.id))
    .run()

  const logger = new EventLogger({ db, entityType: 'project', entityId: projectId })
  logger.log('phase.started', {
    summary: `Phase "${next.name}" started`,
    metadata: { phaseId: next.id },
  })
}
```

---

## Phase 2: Intake Hub (Rename Inbox + PR Tab)

### 2.1 Intake Page

**File: `apps/web/src/app/intake/page.tsx`** (new server component)

Replaces the current `/inbox` page. Fetches issues and PRs server-side for the initial render, then passes data to the `IntakeTabs` client component.

```typescript
import { auth } from '@/lib/auth'
import { getDb } from '@mobster/db'
import { IntakeTabs } from '@/components/intake-tabs'

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; repo?: string; /* ... */ }>
}) {
  const session = await auth()
  if (!session) { /* redirect to login */ }

  const params = await searchParams
  const activeTab = params.tab || 'issues'
  const db = getDb()

  // Fetch initial data based on active tab
  // ... same query logic as current inbox page for issues
  // ... new query logic for PRs

  return <IntakeTabs activeTab={activeTab} /* ... */ />
}
```

### 2.2 IntakeTabs Component

**File: `apps/web/src/components/intake-tabs.tsx`** (new client component)

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { IssueTable } from '@/components/issue-table'
import { IssueFilters } from '@/components/issue-filters'
import { PrTable } from '@/components/pr-table'
import { PrFilters } from '@/components/pr-filters'

const TABS = [
  { key: 'issues', label: 'Issues' },
  { key: 'prs', label: 'Pull Requests' },
] as const

export function IntakeTabs({ activeTab, ...props }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`/intake?${params.toString()}`)
  }

  return (
    <div>
      <div className="flex gap-2 border-b mb-4">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={activeTab === tab.key ? 'border-b-2 border-primary' : ''}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'issues' && (
        <>
          <IssueFilters />
          <IssueTable issues={props.issues} />
        </>
      )}
      {activeTab === 'prs' && (
        <>
          <PrFilters />
          <PrTable pullRequests={props.pullRequests} />
        </>
      )}
    </div>
  )
}
```

### 2.3 PR Table Component

**File: `apps/web/src/components/pr-table.tsx`** (new client component)

Mirrors `IssueTable` structure but adapted for PR data:

- **Columns**: Checkbox, type icon (draft/open/merged), title + number (links to GitHub PR), repo name, head→base branch indicator, labels, author, relative time
- **Selection**: Checkbox per row, "Select all" header checkbox
- **Bulk action bar**: "Add to Project" (opens `ProjectAddItemDialog`), shows count of selected
- **Empty state**: Illustrated empty state when no PRs match filters

### 2.4 PR Filters Component

**File: `apps/web/src/components/pr-filters.tsx`** (new client component)

Mirrors `IssueFilters`:
- Repo selector dropdown (lists connected repos)
- State toggle: Open / Closed / Merged
- Draft filter checkbox
- Search input with Enter-to-search
- Sort: Newest, Oldest, Title A-Z, Title Z-A
- All filters update URL search params

### 2.5 Sidebar Changes

**File: `apps/web/src/components/sidebar.tsx`**

```typescript
// Import change:
import { FolderKanban, /* ... existing imports */ } from 'lucide-react'

// NAV_ITEMS changes:
const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Repos', href: '/repos', icon: FolderGit2 },
  { label: 'Intake', href: '/intake', icon: Inbox },        // ← was "Inbox"
  { label: 'Projects', href: '/projects', icon: FolderKanban }, // ← was "Triage"
  { label: 'PRDs', href: '/prds', icon: FileText },
  { label: 'Runners', href: '/runners', icon: Activity },
  { label: 'Agents', href: '/agents', icon: Bot },
  { label: 'Settings', href: '/settings', icon: Settings },
]
```

### 2.6 Redirect from /inbox

**File: `apps/web/src/app/inbox/page.tsx`**

Replace full content with:
```typescript
import { redirect } from 'next/navigation'

export default function InboxRedirect() {
  redirect('/intake')
}
```

### 2.7 Back Link Update

**File: `apps/web/src/app/issues/[id]/page.tsx`**

Change the "Back to Inbox" link text to "Back to Intake" and href from `/inbox` to `/intake`.

---

## Phase 3: Project Pages

### 3.1 Project List Page

**File: `apps/web/src/app/projects/page.tsx`** (new server component)

Following the pattern of `apps/web/src/app/prds/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { getDb } from '@mobster/db'
import { projects, projectPhases, projectItems } from '@mobster/db'
import { eq, sql } from 'drizzle-orm'
import { ProjectList } from '@/components/project-list'

export default async function ProjectsPage() {
  const session = await auth()
  if (!session) { /* redirect */ }
  const db = getDb()

  const allProjects = db.select().from(projects).orderBy(/* updatedAt desc */).all()

  // Enrich with phase/item counts
  const enriched = allProjects.map(p => ({
    ...p,
    phaseCount: db.select({ count: sql`count(*)` }).from(projectPhases)
      .where(eq(projectPhases.projectId, p.id)).get()?.count ?? 0,
    itemCount: db.select({ count: sql`count(*)` }).from(projectItems)
      .where(eq(projectItems.projectId, p.id)).get()?.count ?? 0,
    completedPhaseCount: /* count where status = 'passed' */,
  }))

  return <ProjectList projects={enriched} />
}
```

### 3.2 Project List Component

**File: `apps/web/src/components/project-list.tsx`** (new client component)

Displays projects as cards (not a table, since projects are higher-level entities). Each card shows:
- Status indicator dot (colored: gray=draft, blue=active, yellow=testing, green=complete)
- Project name
- Description (truncated)
- Repo name
- Progress: "2/3 phases complete"
- **Stat bar**: four at-a-glance counts:
  - 🏃 **Running**: active build jobs in this project
  - 👁 **Needs review**: items with PRDs awaiting approval, or phases with pending gates
  - ✓ **Done**: completed items across all phases
  - ⏸ **On hold**: items in `on_hold` status
- Relative time ("Updated 3 hours ago")

These counts are computed server-side when listing projects. **For completed and archived projects, all stat queries are skipped** — the project is done, so the card simply shows "All items finished!" with zero queries:

```typescript
function getProjectStats(db: DbClient, project: { id: string; status: string }) {
  // Skip all stat queries for finished projects
  if (project.status === 'complete' || project.status === 'archived') {
    return null  // Card renders "All items finished!" instead of stat bar
  }

  const running = db.select({ count: sql`count(*)` }).from(buildJobs)
    .innerJoin(projectItems, eq(buildJobs.projectItemId, projectItems.id))
    .where(and(eq(projectItems.projectId, project.id), eq(buildJobs.status, 'running')))
    .get()?.count ?? 0

  const needsReview = db.select({ count: sql`count(*)` }).from(projectItems)
    .where(and(
      eq(projectItems.projectId, project.id),
      eq(projectItems.status, 'in_progress')
    )).get()?.count ?? 0

  const done = db.select({ count: sql`count(*)` }).from(projectItems)
    .where(and(
      eq(projectItems.projectId, project.id),
      inArray(projectItems.status, ['integrated', 'tested', 'passed'])
    )).get()?.count ?? 0

  const onHold = db.select({ count: sql`count(*)` }).from(projectItems)
    .where(and(
      eq(projectItems.projectId, project.id),
      eq(projectItems.status, 'on_hold')
    )).get()?.count ?? 0

  return { running, needsReview, done, onHold }
}
```

**Performance note**: Most workspaces will have 1–2 active projects and many completed/archived ones. The early-return on finished projects means stats are only computed for the handful of active projects, keeping total queries low. For N projects with A active, this runs ~4A queries instead of ~4N.

"New Project" button in the top-right opens `ProjectCreateDialog`.

### 3.3 Project Detail Page

**File: `apps/web/src/app/projects/[id]/page.tsx`** (new server component)

The most complex page. Fetches and renders:

```typescript
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const db = getDb()
  const { id } = await params

  // 1. Fetch project
  const project = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) { notFound() }

  // 2. Fetch repo info
  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, project.repoId)).get()

  // 3. Fetch phases ordered by sortOrder
  const phases = db.select().from(projectPhases)
    .where(eq(projectPhases.projectId, id))
    .orderBy(projectPhases.sortOrder).all()

  // 4. For each phase, fetch project items JOINed with the items table for display data
  const phasesWithItems = await Promise.all(phases.map(async (phase) => {
    const pItems = db.select()
      .from(projectItems)
      .where(eq(projectItems.phaseId, phase.id))
      .orderBy(projectItems.sortOrder).all()

    // Single JOIN to the unified items table — no polymorphic resolution needed
    const enrichedItems = pItems.map(pi => {
      const item = db.select({
        title: items.title,
        number: items.number,
        itemType: items.itemType,
        source: items.source,
        size: items.size,
        requiresReview: items.requiresReview,
        status: items.status,
      }).from(items).where(eq(items.id, pi.itemId)).get()

      return {
        ...pi,
        displayTitle: item?.title,
        displayNumber: item?.number,
        itemType: item?.itemType,
        itemSource: item?.source,
        itemSize: item?.size,
        itemStatus: item?.status,
        requiresReview: item?.requiresReview,
      }
    })

    return { ...phase, items: enrichedItems }
  }))

  // 5. Fetch recent events for this project
  // Matches both: events directly on the project (entityType='project', entityId=<id>)
  // AND events on child entities (phases, items) parented to this project
  const history = db.select().from(eventLog)
    .where(
      or(
        and(eq(eventLog.entityType, 'project'), eq(eventLog.entityId, id)),
        and(eq(eventLog.parentEntityType, 'project'), eq(eventLog.parentEntityId, id)),
      )
    )
    .orderBy(/* createdAt desc */).limit(50).all()

  return (
    <div>
      <ProjectHeader project={project} repo={repo} />
      {phasesWithItems.map(phase => (
        <ProjectPhaseCard
          key={phase.id}
          phase={phase}
          items={phase.items}
          projectId={id}
        />
      ))}
      <ProjectHistoryTimeline entries={history} />
    </div>
  )
}
```

### 3.4 Project Components

All new client components:

#### `ProjectHeader` — `components/project-header.tsx`
- Displays project name, description, status badge (using the existing `PrdStatusBadge` pattern), repo name
- Action buttons based on status: Activate (draft→active), Start Testing (active→testing), Complete (testing→complete), Archive, Edit, Delete
- Edit button opens an inline edit form or a small dialog for name/description
- Each action PATCHes `/api/projects/[id]` and refreshes

#### `ProjectPhaseCard` — `components/project-phase-card.tsx`
- Collapsible card per phase
- Header: phase name, type badge (integration/testing/review), status badge, gate criteria snippet
- Body: ordered list of items, each showing:
  - Sort order number
  - Item type icon (Bug/Feature/PR/Document)
  - Title + external link (GitHub issue, GitHub PR, or PRD detail page)
  - Status badge
  - Action buttons: Generate PRD (for issues without one), View PRD, Integrate (for approved PRDs), Remove, Move Up/Down
- Footer: "+" dropdown button with options:
  - **"Add from Intake"** → opens `ProjectAddItemDialog` (search existing issues/PRs)
  - **"New Bug"** → opens `ProjectCreateItemDialog` pre-filled with type=bug
  - **"New Feature"** → opens `ProjectCreateItemDialog` pre-filled with type=feature
  - **"New Pull Request"** → opens `ProjectCreateItemDialog` pre-filled with type=pull-request
- "Add Phase" button between cards to insert a new phase

#### `ProjectAddItemDialog` — `components/project-add-item-dialog.tsx`
- Modal with search input and filter tabs (Issues / PRs)
- Fetches from `/api/items` with `itemType` filter (e.g., `?itemType=bug,feature,question,other` for issues, `?itemType=pull_request` for PRs)
- Filters out items already in this project
- Multi-select with checkboxes
- "Add to Phase" button with phase selector dropdown
- POSTs to `/api/projects/[id]/items`

#### `ProjectCreateItemDialog` — `components/project-create-item-dialog.tsx`
- Modal for creating a brand-new item directly within the project (no Intake source)
- Fields: title (required), description (optional), item type (pre-filled from dropdown selection)
- For cross-project PRs: additional fields appear:
  - **Source project** selector (lists completed/active projects in the same repo)
  - **Source branch** (auto-populated from the selected project's integration branches)
  - **Target branch** (defaults to repo default branch)
- POSTs to `/api/projects/[id]/items/create`
- On success, the new item appears in the phase with `origin: 'project'` badge

#### `ProjectCreateDialog` — `components/project-create-dialog.tsx`
- Modal: name input, description textarea, repo selector dropdown
- POSTs to `/api/projects`
- On success, navigates to `/projects/[newId]`

#### `ProjectPhaseCreateDialog` — `components/project-phase-create-dialog.tsx`
- Modal: name, description, phase type selector (integration/testing/review), gate criteria textarea
- POSTs to `/api/projects/[id]/phases`

#### `EventTimeline` — `components/event-timeline.tsx`

A reusable timeline component that renders `event_log` entries for any entity type. Designed to eventually replace both the project history timeline and the runner log viewer:

- **Props**: `events: EventLogEntry[]`, `entityType: EntityType`, `groupByDate?: boolean`
- **Rendering**: Each event shows an icon (varies by `eventType` prefix: `project.*`, `agent.*`, `build.*`), the `summary` text, and relative timestamp
- **Collapsible detail**: Events with `content` or `metadata` can be expanded to show full details (reuses the collapsible pattern from `runner-log-viewer.tsx`)
- **Date grouping**: Optional — groups events under "Today", "Yesterday", "June 2, 2026" headers
- **Entity-aware icons**: Uses `FolderKanban` for project events, `Bot` for agent events, `Hammer` for build events
- **Reusability**: The same component renders project history, agent session logs, and build job logs — only the `entityType` filter and query differ

For Phase 3.5, the component is used for project timelines. The existing `runner-log-viewer.tsx` continues to use `agent_logs` directly until the migration is done (see backlog).

#### `ProjectIntegrateButton` — `components/project-integrate-button.tsx`
- Reuses the existing `IntegrateDialog` but passes `projectItemId`
- Button appears on project items that have an approved PRD
- After integration completes, the item status updates automatically (polled or via page refresh)

---

## Phase 4: Project Integration Flow

### 4.1 Project Integration API

**File: `apps/web/src/app/api/projects/[id]/integrate/route.ts`** (new)

POST endpoint that wraps the existing integration logic with project awareness:

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { id: projectId } = await params

  // Parse body: { projectItemId, targetType, branchName?, cleanWorkspace?, force? }
  const body = await request.json()
  const input = IntegrateInput.parse(body)  // reuse existing schema

  // Validate project item
  const item = db.select().from(projectItems)
    .where(eq(projectItems.id, input.projectItemId)).get()
  if (!item || item.projectId !== projectId) {
    return NextResponse.json({ error: 'Invalid project item' }, { status: 400 })
  }

  // Validate item has a PRD
  if (!item.prdId) {
    return NextResponse.json({ error: 'Item has no PRD' }, { status: 400 })
  }

  // Validate phase is active
  const phase = db.select().from(projectPhases)
    .where(eq(projectPhases.id, item.phaseId)).get()
  if (!phase || phase.status !== 'active') {
    return NextResponse.json({ error: 'Phase is not active' }, { status: 400 })
  }

  // Mark item as in_progress
  const now = new Date().toISOString()
  db.update(projectItems)
    .set({ status: 'in_progress', updatedAt: now })
    .where(eq(projectItems.id, item.id))
    .run()

  const logger = new EventLogger({ db, entityType: 'project', entityId: projectId })
  logger.log('item.integration_started', {
    summary: `Integration started for item ${item.id}`,
    metadata: { itemId: item.id, itemType: item.itemType },
  })

  // Create build job (existing logic from api/prds/[id]/integrate/route.ts)
  // ... but with projectItemId set
  const buildJobId = uuid()
  db.insert(buildJobs).values({
    id: buildJobId,
    prdId: item.prdId,
    projectItemId: item.id,  // ← new field
    status: 'queued',
    // ...
    createdAt: now,
    updatedAt: now,
  }).run()

  // Update PRD status to building
  db.update(prds).set({ status: 'building', updatedAt: now })
    .where(eq(prds.id, item.prdId)).run()

  // Fire-and-forget integration
  setTimeout(() => {
    import('@/lib/agents/integration-runner').then(({ integratePrd }) => {
      integratePrd(db, buildJobId)
    })
  }, 0)

  return NextResponse.json({ buildJobId, itemStatus: 'in_progress' })
}
```

### 4.2 Integration Runner Extension

**File: `apps/web/src/lib/agents/integration-runner.ts`**

After the existing success/failure handling (around where build job status is updated), add:

```typescript
// If this build is part of a project, update the project item
if (buildJob.projectItemId) {
  const item = db.select().from(projectItems)
    .where(eq(projectItems.id, buildJob.projectItemId)).get()

  if (item) {
    const newStatus = buildJob.status === 'success' ? 'integrated' : 'failed'
    const now = new Date().toISOString()

    db.update(projectItems)
      .set({ status: newStatus, updatedAt: now })
      .where(eq(projectItems.id, item.id))
      .run()

    const logger = new EventLogger({ db, entityType: 'project', entityId: item.projectId })
    logger.log(buildJob.status === 'success' ? 'item.integrated' : 'item.failed', {
      summary: `Integration ${buildJob.status === 'success' ? 'succeeded' : 'failed'} for item ${item.id}`,
      metadata: { itemId: item.id, buildJobId: buildJob.id, prUrl: buildJob.prUrl },
    })

    // Check if phase can advance
    if (buildJob.status === 'success' && canAdvancePhase(db, item.phaseId)) {
      advancePhase(db, item.phaseId)

      const phase = db.select().from(projectPhases)
        .where(eq(projectPhases.id, item.phaseId)).get()

      logger.log('phase.passed', {
        summary: `Phase "${phase?.name}" completed — all items integrated`,
        metadata: { phaseId: item.phaseId },
      })

      activateNextPhase(db, item.projectId)
    }
  }
}
```

### 4.3 IntegrateDialog Extension

**File: `apps/web/src/components/integrate-dialog.tsx`**

Accept an optional `projectItemId` prop. When provided:
- POST to `/api/projects/[projectId]/integrate` instead of `/api/prds/[prdId]/integrate`
- Show "Integrating within Project: [project name] — Phase: [phase name]" context in the dialog
- The dialog logic (branch name, fork detection, clean workspace, force restart) remains identical

---

## Migration Strategy

### Database

The `ensureSchema()` function in `packages/db/src/startup.ts` (called from `instrumentation.ts` at startup) runs embedded DDL. Since all new tables use `CREATE TABLE IF NOT EXISTS`, they're created automatically on first startup after deployment. The `ALTER TABLE build_jobs ADD COLUMN project_item_id` is wrapped in a try/catch (matching the existing ALTER TABLE pattern) so it's idempotent.

No existing data needs migration — all new tables start empty.

### Routes

- `/inbox` → redirects to `/intake` (no data loss, just a URL change)
- `/api/issues/*` continues to work (redirects to `/api/items?source=github&itemType=...`)
- All `/api/prds/*` routes remain unchanged
- New `/api/items/*` and `/api/projects/*` routes are purely additive

### No Breaking Changes

- Existing PRD generation from the issue table still works
- Existing standalone integration still works
- All existing pages, API routes, and database tables are untouched

---

## Component File Summary

| File | Type | Purpose |
|------|------|---------|
| `components/intake-tabs.tsx` | client | Tab switcher for Issues / PRs / (future sources) in Intake — both tabs query `/api/items` with different `itemType` filters |
| `components/item-table.tsx` | client | Unified table for items (replaces `issue-table.tsx` + `pr-table.tsx`). Shows type icon, title, source badge, size indicator, status, selection |
| `components/item-filters.tsx` | client | Unified filter bar: source tabs, type, status, size, repo, search, sort. Replaces separate `issue-filters.tsx` + `pr-filters.tsx` |
| `components/project-list.tsx` | client | Card grid listing all projects |
| `components/project-header.tsx` | client | Project detail header with actions |
| `components/project-phase-card.tsx` | client | Single phase card with ordered item list |
| `components/project-add-item-dialog.tsx` | client | Modal to search & add existing Intake items to a phase |
| `components/project-create-item-dialog.tsx` | client | Modal to create a new item (bug/feature/PR) directly in-project |
| `components/project-create-dialog.tsx` | client | Modal to create a new project |
| `components/project-phase-create-dialog.tsx` | client | Modal to create a new phase |
| `components/project-integrate-button.tsx` | client | Integration trigger in project context |
| `components/event-timeline.tsx` | client | Reusable event timeline for any entity type (project, agent, build). Renders `event_log` entries with icons, summaries, timestamps, collapsible details, and date grouping |

### Existing Components Modified

| File | Change |
|------|--------|
| `components/sidebar.tsx` | "Inbox" → "Intake", "Triage" → "Projects" |
| `components/issue-table.tsx` | Replaced by unified `item-table.tsx` — queries `/api/items` instead of direct DB |
| `components/issue-filters.tsx` | Replaced by unified `item-filters.tsx` — source-aware, size filter added |
| `components/integrate-dialog.tsx` | Accept optional `projectItemId`; POST to project endpoint when set |
| `components/prd-generate-button.tsx` | Updated to accept `itemIds` (from `items` table) instead of `issueIds` |

---

## API Route File Summary

### New Routes

| File | Methods | Purpose |
|------|---------|---------|
| `api/items/route.ts` | GET | Unified endpoint: list items (paginated, filterable by source, itemType, status, repo, size, origin) |
| `api/items/[id]/route.ts` | GET, PATCH | Detail + update a single item (annotations, size, review flag) |
| `api/items/create/route.ts` | POST | Manually create an item (from Intake or quick-add) |
| `api/items/create/route.ts` | POST | Manually create an item (e.g., from Intake) |
| `api/projects/route.ts` | GET, POST | List/create projects |
| `api/projects/[id]/route.ts` | GET, PATCH, DELETE | Detail, update, delete project |
| `api/projects/[id]/phases/route.ts` | GET, POST | List/create phases |
| `api/projects/[id]/phases/[phaseId]/route.ts` | PATCH, DELETE | Update/delete phase |
| `api/projects/[id]/items/route.ts` | GET, POST | List/add existing Intake items to project |
| `api/projects/[id]/items/create/route.ts` | POST | Create new item directly in-project (bug/feature/PR) |
| `api/projects/[id]/items/[itemId]/route.ts` | PATCH, DELETE | Update/remove project item |
| `api/projects/[id]/integrate/route.ts` | POST | Integrate within project context |

### Modified Routes

| File | Change |
|------|--------|
| `api/repos/[id]/sync/route.ts` | Call `syncIssues` + `syncPullRequests` — both write to unified `items` table |
| `api/issues/route.ts` | Deprecated — redirects to `/api/items?source=github&itemType=bug,feature,question,other` |

---

---

## Performance Considerations

### Potential Bottleneck: Project Detail Page

The project detail page (`/projects/[id]`) is the most query-heavy page in the system. In the naive implementation, it makes:

```
1 query:  Fetch project
1 query:  Fetch repo info
1 query:  Fetch all phases for project
N queries: For each phase, fetch its project_items
N×M queries: For each project_item, JOIN to items table for display data
1 query:  Fetch history entries (last 50)
```

For a project with 3 phases and 4 items per phase, that's **1 + 1 + 1 + 3 + 12 = 18 queries**. For larger projects, this grows linearly.

### Mitigation Strategy

The plan is to implement this naively first, then measure. Several optimizations are available if needed:

1. **Batch the item JOIN**: Instead of querying `items` once per `project_item`, collect all `itemId`s and do a single `WHERE id IN (...)` query. 12 queries → 1 query.

2. **Single query with JOINs**: Drizzle supports joins — fetch `project_items` INNER JOIN `items` in one trip:
   ```typescript
   db.select().from(projectItems)
     .innerJoin(items, eq(projectItems.itemId, items.id))
     .where(eq(projectItems.phaseId, phaseId))
   ```

3. **Prefetch everything in one pass**: Fetch ALL project_items for the project in one query (across all phases), then group by `phaseId` in application code. This is 1 query instead of N.

4. **React Streaming + Suspense**: The page can stream in phases progressively — Phase 1 renders immediately while Phase 2+3 data is still loading. Next.js App Router supports this natively with `loading.tsx` boundaries and `<Suspense>` per phase card.

5. **History pagination**: The history timeline fetches the last 50 entries. For projects with extensive history, add cursor-based pagination ("Load more") instead of fetching everything.

### What to Optimize and When

| Scenario | Queries (naive) | Queries (optimized) | When to optimize |
|----------|----------------|---------------------|-----------------|
| Small project (3 phases, 12 items) | ~18 | ~5 | Don't optimize — this is fast enough |
| Medium project (5 phases, 25 items) | ~32 | ~6 | Batch the item JOIN only |
| Large project (8+ phases, 50+ items) | ~60+ | ~6 | Full optimization + streaming |

**Decision**: Build it naively, test with real data, and only optimize if page load exceeds ~500ms. The existing roadmap Phase 4 already covers N+1 query elimination across the app — this page will be included in that sweep.

**Backlog item**: See [`backlog.md`](backlog.md) → "Project Detail Page Performance Audit."

---

## Verification

### Per-Phase Testing

**Phase 0 (Unified Items Table):**
1. `pnpm db:generate` — verify migration SQL includes `items` table with all columns
2. Start app — verify migration script copies existing `issues` rows into `items`
3. Trigger a repo sync via UI or API — verify both issues and PRs populate `items` table
4. `curl '/api/items?source=github&itemType=bug,feature'` — verify filtered issue response
5. `curl '/api/items?source=github&itemType=pull_request'` — verify filtered PR response
6. Query `items` table directly — verify `source`, `sourceData`, `size`, `origin` columns populated
7. Verify existing PRD links still work (item IDs preserved during migration)
8. Verify standalone PRD generation from Intake still works (now references `items.id`)

**Phase 1 (Projects API):**
1. `pnpm db:generate` — verify all 4 new tables + ALTER TABLE
2. Create project: `curl -X POST /api/projects -H 'Content-Type: application/json' -d '{"name":"Test Release","repoId":"<id>"}'`
3. List projects: `curl /api/projects`
4. Create phase: `curl -X POST /api/projects/<id>/phases -d '{"name":"Bug Fixes","phaseType":"integration"}'`
5. Add item: `curl -X POST /api/projects/<id>/items -d '{"items":[{"itemId":"<item-id>","phaseId":"<phase-id>"}]}'`
6. Get detail: `curl /api/projects/<id>` — verify nested phases+items+history
7. Test gate logic: manually set all items to `integrated`, call `canAdvancePhase` — verify returns true

**Phase 2 (Intake Hub):**
1. Start app, navigate to `/intake` — verify Issues tab renders (same as old inbox)
2. Click "Pull Requests" tab — verify PR table renders with synced data
3. Verify PR filters work (state, draft, repo, search, sort)
4. Navigate to `/inbox` — verify redirect to `/intake`
5. Check sidebar — "Intake" and "Projects" links present, old "Inbox" and "Triage" gone
6. Open an issue detail page — "Back to Intake" link works

**Phase 3 (Project Pages):**
1. Navigate to `/projects` — verify project cards render
2. Click "New Project" — create a project, verify redirect to detail
3. Add phases via UI — verify they appear in correct order
4. Add items to phases — verify they render with correct display data
5. Verify history timeline updates on each action
6. Test item reordering (move up/down)

**Phase 4 (Project Integration):**
1. From project detail, generate a PRD for an issue item
2. Review and approve the PRD
3. Click "Integrate" on the item — verify build job created with `projectItemId`
4. After integration completes, verify item status updated to `integrated`
5. If it was the last item in the phase, verify phase auto-advances and next phase activates

### End-to-End Smoke Test

1. Sync a repo → issues and PRs populate the unified `items` table
2. Go to Intake → verify both tabs (Issues, PRs) show data from `/api/items`
3. Create project "Test Release v1.0" for the synced repo
4. Add 2 phases: "Bug Fixes" (integration) and "Polish" (review)
5. Assign 2 bugs to Phase 1, 1 PR to Phase 2
6. Activate project → Phase 1 becomes active
7. Generate PRD for first bug → review → approve → integrate
8. Generate PRD for second bug → review → approve → integrate
9. Verify Phase 1 auto-advances to `passed`, Phase 2 activates
10. Add a newly discovered bug to Phase 1 (reopen it)
11. Generate PRD → integrate the new bug → Phase 1 passes again
12. Verify full history log captures every action
13. Complete the project → verify status transitions to `complete`
