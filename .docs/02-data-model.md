# 02 — Data Model

**Phase:** 0 (Foundation Setup) — **Complete**  
**Phase 3.5 additions:** Planned (see [35-project-phase-technical.md](35-project-phase-technical.md))  
**Last Updated:** 2026-06-04

---

## 1. Database: SQLite via Drizzle ORM

- **Driver:** better-sqlite3
- **File:** `/data/mobster.db` (Docker volume)
- **Mode:** WAL (Write-Ahead Logging)
- **Schema setup:** Embedded DDL in `schema-ddl.ts` (no runtime migration files)

---

## 2. Entity Relationship Diagram

### Current (Phase 2)

```
app_settings (key-value config)
users (1) ──── (N) github_repos
                       │
                       │ (N)
                       ▼
                    issues (1) ──── (N) prds (1) ──── (N) build_jobs
                                    │                    │
                                    │ (N)                │ (1)
                                    ▼                    ▼
                               prd_issues          agent_logs
                               prd_comments        agents
```

### Phase 3.5 (Planned)

```
app_settings (key-value config)
users (1) ──── (N) github_repos
                  │            │
                  │ (N)        │ (N)
                  ▼            ▼
               items ◄──── projects
          (unified work    │
           items table)    │ (N)
                  ▲        ▼
                  │   project_phases (ordered)
                  │        │
                  │        │ (N)
                  │        ▼
                  └── project_items (ordered, FK → items.id)
                           │
                           │ (1)
                           ▼
                         prds (1) ──── (N) build_jobs
                           │               │
                           │               │ (1)
                           ▼               ▼
                       event_log ◄─────────┘
                    (unified event log for all entities)
```

**Key:** `project_items.itemId` always references `items.id` — no polymorphic FK. The item's type, source, size, and origin are on the `items` table itself.

**`issues` table:** Retained read-only during transition. After migration to `items` is verified, it will be dropped.

---

## 3. Tables

### 3.1 `app_settings`

Key-value store for app configuration.

| Column | Type | Purpose |
|--------|------|---------|
| `key` | TEXT PK | Setting name |
| `value` | TEXT | Setting value |
| `updated_at` | TEXT | ISO 8601 timestamp |

**Rows:** `auth_secret`, `encryption_key`, optionally `github_app_id`

### 3.2 `users`

Stores the single user's GitHub identity and encrypted PAT.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `github_id` | TEXT UNIQUE | GitHub user ID |
| `github_token` | TEXT | AES-256-GCM encrypted PAT |
| `name` | TEXT | GitHub display name |
| `email` | TEXT | GitHub email |
| `avatar_url` | TEXT | GitHub avatar URL |
| `created_at` | TEXT | ISO 8601 |
| `updated_at` | TEXT | ISO 8601 |

### 3.3 `github_repos`

Repos the user has chosen to sync.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT FK → users | Owner |
| `owner` | TEXT | e.g. "facebook" |
| `name` | TEXT | e.g. "react" |
| `full_name` | TEXT UNIQUE | e.g. "facebook/react" |
| `default_branch` | TEXT | Default "main" |
| `description` | TEXT | From GitHub |
| `language` | TEXT | Primary language |
| `stars` | INTEGER | Star count |
| `synced_at` | TEXT | Last successful sync |
| `created_at` | TEXT | ISO 8601 |
| `updated_at` | TEXT | ISO 8601 |

### 3.4 `issues`

Cached GitHub issues.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `repo_id` | TEXT FK → github_repos | Parent repo |
| `github_id` | INTEGER | GitHub's issue ID |
| `number` | INTEGER | Issue number (#42) |
| `title` | TEXT | Issue title |
| `body` | TEXT | Markdown body |
| `state` | TEXT | 'open' or 'closed' |
| `issue_type` | TEXT | 'bug', 'feature', 'question', 'other' |
| `labels` | TEXT | JSON array of labels |
| `assignee` | TEXT | GitHub username |
| `milestone` | TEXT | Milestone title |
| `github_url` | TEXT | Link to GitHub issue |
| `github_created_at` | TEXT | Original timestamp |
| `github_updated_at` | TEXT | Last GitHub update |
| `user_notes` | TEXT | Local-only notes |
| `user_tags` | TEXT | JSON array of local tags |
| `created_at` | TEXT | ISO 8601 |
| `updated_at` | TEXT | ISO 8601 |

### 3.5 `prds`

Product Requirement Documents (Phase 2).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `issue_id` | TEXT FK → issues | Source issue |
| `title` | TEXT | PRD title |
| `content` | TEXT | Markdown content |
| `status` | TEXT | draft/reviewed/approved/scheduled/building/done/failed |
| `agent_model` | TEXT | Model used to generate |
| `agent_prompt` | TEXT | Prompt used |
| `version` | INTEGER | Edit version |
| `parent_prd_id` | TEXT | For combined PRDs |
| `scheduled_at` | TEXT | When scheduled |
| `created_at` | TEXT | ISO 8601 |
| `updated_at` | TEXT | ISO 8601 |

### 3.6 `build_jobs`

Tracks agent code-generation jobs (Phase 3).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `prd_id` | TEXT FK → prds | Source PRD |
| `status` | TEXT | queued/running/success/failed |
| `agent_log` | TEXT | Full agent output |
| `pr_url` | TEXT | Created PR URL |
| `branch_name` | TEXT | Agent's branch |
| `error` | TEXT | Error details |
| `retry_count` | INTEGER | Attempts |
| `max_retries` | INTEGER | Default 3 |
| `started_at` | TEXT | ISO 8601 |
| `completed_at` | TEXT | ISO 8601 |
| `created_at` | TEXT | ISO 8601 |
| `updated_at` | TEXT | ISO 8601 |

---

### 3.7 `items` (Phase 3.5 — planned)

The unified work item table. Replaces `issues` long-term and absorbs pull requests, manual items, and future sources.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `title` | TEXT NOT NULL | Item title |
| `description` | TEXT | Markdown body |
| `item_type` | TEXT NOT NULL | 'bug', 'feature', 'pull_request', 'task', 'question', 'other' |
| `status` | TEXT NOT NULL | 'open', 'closed', 'merged', 'draft' |
| `source` | TEXT NOT NULL | 'github', 'manual' (future: 'gitlab', 'azure-devops', ...) |
| `source_id` | TEXT | External ID (GitHub issue number as string) |
| `source_url` | TEXT | Link back to original |
| `source_data` | TEXT | JSON blob for source-specific fields |
| `size` | TEXT | 'xs', 'small', 'medium', 'large', 'xl' |
| `requires_review` | INTEGER | 0 or 1 (default 1) |
| `review_reason` | TEXT | Human-readable explanation |
| `repo_id` | TEXT FK → github_repos | Parent repo |
| `number` | INTEGER | Issue/PR number (denormalized) |
| `labels` | TEXT | JSON array |
| `assignee` | TEXT | GitHub username |
| `author` | TEXT | PR author / issue reporter |
| `milestone` | TEXT | Milestone title |
| `head_branch` | TEXT | PR source branch |
| `base_branch` | TEXT | PR target branch |
| `is_draft` | INTEGER | 0 or 1 |
| `github_id` | INTEGER | GitHub's ID (denormalized for migration compat) |
| `github_created_at` | TEXT | Original GitHub timestamp |
| `github_updated_at` | TEXT | Last GitHub update |
| `user_notes` | TEXT | Local-only notes |
| `user_tags` | TEXT | JSON array of local tags |
| `origin` | TEXT NOT NULL | 'sync' (from connected source), 'manual' (created in Intake), 'project' (created in-project) |
| `synced_at` | TEXT | Last source refresh |
| `created_at` | TEXT NOT NULL | ISO 8601 |
| `updated_at` | TEXT NOT NULL | ISO 8601 |

### 3.8 `projects` (Phase 3.5 — planned)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | Project name |
| `description` | TEXT | Optional description |
| `status` | TEXT NOT NULL | 'draft', 'active', 'testing', 'complete', 'archived' |
| `repo_id` | TEXT FK → github_repos | Linked repo |
| `created_at` | TEXT NOT NULL | ISO 8601 |
| `updated_at` | TEXT NOT NULL | ISO 8601 |

### 3.9 `project_phases` (Phase 3.5 — planned)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `project_id` | TEXT FK → projects | Parent project |
| `name` | TEXT NOT NULL | Phase name |
| `description` | TEXT | Optional description |
| `phase_type` | TEXT NOT NULL | 'integration', 'testing', 'review' |
| `sort_order` | INTEGER NOT NULL | Order within project |
| `status` | TEXT NOT NULL | 'pending', 'active', 'passed', 'failed' |
| `gate_criteria` | TEXT | Conditions for passing the gate |
| `started_at` | TEXT | When activated |
| `completed_at` | TEXT | When passed/failed |
| `created_at` | TEXT NOT NULL | ISO 8601 |
| `updated_at` | TEXT NOT NULL | ISO 8601 |

### 3.10 `project_items` (Phase 3.5 — planned)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `project_id` | TEXT FK → projects | Parent project |
| `phase_id` | TEXT FK → project_phases | Parent phase |
| `item_id` | TEXT FK → items | Always references `items.id` — no polymorphism |
| `sort_order` | INTEGER NOT NULL | Order within phase |
| `status` | TEXT NOT NULL | 'pending', 'in_progress', 'integrated', 'tested', 'passed', 'failed', 'on_hold' |
| `prd_id` | TEXT FK → prds | Generated PRD (nullable) |
| `source_project_id` | TEXT | Cross-project reference: source project |
| `source_item_id` | TEXT | Cross-project reference: source item |
| `added_at` | TEXT NOT NULL | When added to project |
| `created_at` | TEXT NOT NULL | ISO 8601 |
| `updated_at` | TEXT NOT NULL | ISO 8601 |

### 3.11 `event_log` (Phase 3.5 — planned)

Unified event log for all entity types — replaces separate project history and (eventually) `agent_logs`.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `entity_type` | TEXT NOT NULL | 'project', 'prd', 'build', 'agent_session' |
| `entity_id` | TEXT NOT NULL | References entity by PK (polymorphic, handled at app layer) |
| `parent_entity_type` | TEXT | For hierarchical events |
| `parent_entity_id` | TEXT | e.g., phase event parented to project |
| `event_type` | TEXT NOT NULL | Namespaced: 'project.created', 'agent.thinking', 'build.completed', etc. |
| `session_id` | TEXT | Groups related events (agent runs, integration sessions) |
| `summary` | TEXT | One-line human-readable description |
| `content` | TEXT | Full event content (agent thinking text, tool output) |
| `metadata` | TEXT | JSON blob with structured data (phaseId, buildJobId, prUrl, etc.) |
| `created_at` | TEXT NOT NULL | ISO 8601 |

### 3.12 `build_jobs` extension (Phase 3.5 — planned)

Add to the existing table:

| Column | Type | Purpose |
|--------|------|---------|
| `project_item_id` | TEXT FK → project_items (nullable) | Links build job to project context |

---

## 4. State Machines

### PRD Status
```
draft → reviewed → approved → scheduled → building → done
  │        │          │           │           │         │
  └────────┴──────────┴───────────┴───────────┴───→ failed (any stage)
```

### BuildJob Status
```
queued → running → success
  │         │
  └─────────┴──→ failed (retry if retryCount < maxRetries)
```

### Project Status (Phase 3.5)
```
draft → active → testing → complete
  │        │         │
  └────────┴─────────┴──→ archived (from any state)
```

### Phase Status (Phase 3.5)
```
pending → active → passed
              │
              └──→ failed
```

### Project Item Status (Phase 3.5)
```
pending ──→ in_progress ──→ integrated ──→ tested ──→ passed
     │           │               │
     │           └──→ on_hold ←──┘
     │
     └──→ failed
```
`on_hold` items are excluded from gate checks. A phase can advance if all non-held items are complete. Held items must be resolved before project completion.

### Item Size & Review (Phase 3.5)
| Size | Scope | Default review? |
|------|-------|-----------------|
| `xs` | Typo, config tweak, one-line fix | No |
| `small` | Single function change, dependency bump | Optional |
| `medium` | Multi-file change, new feature | Yes |
| `large` | New module, API change | Yes |
| `xl` | Architecture change, major refactor | Yes |

---

## 5. Schema Updates

When the Drizzle schema changes:
1. Run `cd packages/db && npx drizzle-kit generate`
2. Copy the generated SQL into `schema-ddl.ts`, wrapping each `CREATE TABLE` with `IF NOT EXISTS`
3. Migrations are kept in `migrations/` for version history but not used at runtime
