# 02 — Data Model

**Phase:** 0 (Foundation Setup) — **Complete**  
**Last Updated:** 2026-05-29

---

## 1. Database: SQLite via Drizzle ORM

- **Driver:** better-sqlite3
- **File:** `/data/mobster.db` (Docker volume)
- **Mode:** WAL (Write-Ahead Logging)
- **Schema setup:** Embedded DDL in `schema-ddl.ts` (no runtime migration files)

---

## 2. Entity Relationship Diagram

```
app_settings (key-value config)
users (1) ──── (N) github_repos
                       │
                       │ (N)
                       ▼
                    issues (1) ──── (N) prds (1) ──── (N) build_jobs
```

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

---

## 5. Schema Updates

When the Drizzle schema changes:
1. Run `cd packages/db && npx drizzle-kit generate`
2. Copy the generated SQL into `schema-ddl.ts`, wrapping each `CREATE TABLE` with `IF NOT EXISTS`
3. Migrations are kept in `migrations/` for version history but not used at runtime
