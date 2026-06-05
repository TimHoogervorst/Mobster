# Phase 3.6: Event Logger API

> **Status:** Planning  
> **Target:** Post-Phase 3.5 (Projects & Intake Hub)  
> **Depends on:** Phase 3.5 (uses the `event_log` table defined there)

---

## The Problem

Mobster currently has two isolated logging systems:

| System | Table | Scope |
|--------|-------|-------|
| Agent session logs | `agent_logs` | PRD generation + integration runs — internal only |
| Project history (planned) | `event_log` | Project lifecycle events — internal only |

These are fire-and-forget write paths. There's no way for external tools to:
- Push events into Mobster (e.g., a CI pipeline saying "build passed")
- Query events across entities (e.g., a dashboard showing all `agent.thinking` steps across projects)
- Read the event stream programmatically (e.g., a custom runner reporting its progress)

The `event_log` table designed in Phase 3.5 is already the right schema for this — it just needs to be exposed as an API.

---

## The Vision: Event Platform

Transform the `event_log` table from an internal write-only log into Mobster's **event platform** — a unified, queryable, externally-accessible stream of everything that happens.

```
                    POST /api/events
                    GET  /api/events
                          ↑
┌─────────────────────────┼─────────────────────────┐
│                         │                         │
│  Internal consumers     │  External consumers     │
│                         │                         │
│  • Project timeline     │  • CI/CD pipelines      │
│  • Runner log viewer    │  • Custom dashboards    │
│  • Dashboard stats      │  • External runners     │
│  • Phase gate checks    │  • Webhook consumers    │
│                         │  • Monitoring tools     │
└─────────────────────────┴─────────────────────────┘
                          │
                    event_log table
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    Project events   Agent events    Build events
    (project.*)      (agent.*)       (build.*)
```

### What this enables

| Scenario | How it works |
|----------|-------------|
| **Custom runner reports progress** | External runner POSTs `agent.thinking` / `agent.tool_call` events to the API. Mobster's UI polls the same endpoint and renders them live — no code changes needed in Mobster |
| **CI pipeline logs build status** | GitHub Actions workflow POSTs `build.ci_passed` or `build.ci_failed` with metadata. Project phase gates can consume these events |
| **Cross-project dashboard** | External dashboard GETs `/api/events?entityType=project&from=-30d` and computes cycle time, success rate, review velocity — all from the event stream |
| **New source provider logs sync** | A GitLab connector POSTs `sync.items_created` with counts and repo info. The Intake page shows sync history |
| **Audit/export** | All events are queryable. Export to CSV, feed into analytics tools, or archive for compliance |

---

## API Design

### Authentication

**Phase 1 (now):** Session cookie auth — same `auth()` guard as every other API route. Works for the Mobster UI and any tool that can hold a session cookie.

**Phase 2 (planned):** API key auth — static bearer tokens managed in Settings. External tools use `Authorization: Bearer mob_xxxxxxxx` header.

### Endpoints

#### `POST /api/events`

Create one or more events.

**Request:**
```json
{
  "events": [
    {
      "entityType": "project",
      "entityId": "uuid",
      "eventType": "item.integrated",
      "summary": "Bug #42 integrated successfully",
      "metadata": {
        "itemId": "uuid",
        "buildJobId": "uuid",
        "prUrl": "https://github.com/owner/repo/pull/123"
      },
      "sessionId": "project-uuid-integrate-item-uuid",
      "parentEntityType": "project",
      "parentEntityId": "uuid",
      "timestamp": "2026-06-04T14:30:00Z"
    }
  ]
}
```

**Validation (Zod):**
```typescript
const CreateEventInput = z.object({
  entityType: z.enum(['project', 'prd', 'build', 'agent_session']),
  entityId: z.string().uuid(),
  eventType: z.string().min(1).max(200),
  summary: z.string().max(500).optional(),
  content: z.string().max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
  sessionId: z.string().max(200).optional(),
  parentEntityType: z.enum(['project', 'prd', 'build', 'agent_session']).optional(),
  parentEntityId: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional(),  // defaults to now
})

const CreateEventsInput = z.object({
  events: z.array(CreateEventInput).min(1).max(100),
})
```

**Response:** `201 Created`
```json
{
  "created": 3,
  "eventIds": ["uuid", "uuid", "uuid"]
}
```

**Rate limit:** 100 events per request, 1000 events per minute per user.

#### `GET /api/events`

Query the event stream.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `entityType` | string | Filter by entity type (project, prd, build, agent_session) |
| `entityId` | string | Filter by specific entity |
| `eventType` | string | Filter by event type prefix — supports glob: `project.*`, `agent.thinking`, `*.failed` |
| `sessionId` | string | Filter by session |
| `parentEntityType` | string | Filter events parented to this entity type |
| `parentEntityId` | string | Filter events parented to this entity |
| `from` | ISO datetime | Events after this time (inclusive) |
| `to` | ISO datetime | Events before this time (inclusive) |
| `page` | integer | Page number (default 1) |
| `pageSize` | integer | Per page (default 50, max 250) |
| `sort` | string | `createdAt:asc` or `createdAt:desc` (default) |

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "entityType": "project",
      "entityId": "uuid",
      "eventType": "phase.passed",
      "summary": "Phase 'Bug Fixes' completed — all items integrated",
      "content": null,
      "metadata": { "phaseId": "uuid" },
      "sessionId": null,
      "parentEntityType": "project",
      "parentEntityId": "uuid",
      "createdAt": "2026-06-04T14:30:00.000Z"
    }
  ],
  "total": 142,
  "page": 1,
  "pageSize": 50
}
```

#### `GET /api/events/stats`

Aggregated statistics — useful for dashboards without pulling raw events.

**Query parameters:** Same filters as `GET /api/events` (entityType, entityId, from, to) plus:

| Param | Type | Description |
|-------|------|-------------|
| `groupBy` | string | `entityType`, `eventType`, `hour`, `day`, `week` |

**Response:**
```json
{
  "total": 1423,
  "byEventType": {
    "agent.thinking": 892,
    "agent.tool_call": 341,
    "agent.error": 12,
    "build.completed": 45,
    "build.failed": 3
  },
  "byDay": {
    "2026-06-01": 234,
    "2026-06-02": 189,
    "2026-06-03": 312,
    "2026-06-04": 688
  },
  "period": { "from": "2026-06-01T00:00:00Z", "to": "2026-06-04T23:59:59Z" }
}
```

---

## Event Type Conventions

To keep the event stream queryable and predictable, event types follow a namespaced convention:

```
{domain}.{action}
```

### Reserved domains

| Domain | Used by | Examples |
|--------|---------|----------|
| `project.*` | Project lifecycle | `project.created`, `project.activated`, `phase.started`, `phase.passed`, `item.added`, `item.integrated`, `item.on_hold` |
| `agent.*` | Agent runners | `agent.thinking`, `agent.tool_call`, `agent.tool_result`, `agent.output`, `agent.error`, `agent.status` |
| `build.*` | Build/integration jobs | `build.queued`, `build.started`, `build.completed`, `build.failed`, `build.ci_passed`, `build.ci_failed` |
| `sync.*` | Source syncing | `sync.started`, `sync.completed`, `sync.items_created`, `sync.items_updated`, `sync.failed` |
| `prd.*` | PRD lifecycle | `prd.generation_started`, `prd.generation_complete`, `prd.reviewed`, `prd.approved`, `prd.regenerated` |

### Custom domains

External tools can use any domain not reserved above — e.g., `deploy.*`, `monitor.*`, `custom-tool.*`. The schema doesn't restrict event types; the conventions are for discoverability.

---

## API Key Management (Phase 2)

### Settings UI

A new section in `/settings` → "API Keys":

```
┌──────────────────────────────────────────────────┐
│  API Keys                           [+ Generate] │
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │  mob_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx        ││
│  │  Dashboard reader                            ││
│  │  Created June 4, 2026                        ││
│  │  Last used: June 4, 2026                     ││
│  │  Permissions: read                            ││
│  │  [Copy] [Regenerate] [Delete]                ││
│  └──────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────┐│
│  │  mob_yyyyyyyyyyyyyyyyyyyyyyyyyyyy            ││
│  │  CI pipeline hook                            ││
│  │  Created June 2, 2026                        ││
│  │  Permissions: write                           ││
│  │  [Copy] [Regenerate] [Delete]                ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### Key model

```typescript
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),               // Human label: "CI pipeline hook"
  keyHash: text('key_hash').notNull(),         // SHA-256 of the key
  keyPrefix: text('key_prefix').notNull(),     // First 8 chars for display: "mob_xxxx..."
  permissions: text('permissions').notNull(),  // 'read' | 'write' | 'read_write'
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').notNull(),
})
```

### Auth flow

```
Authorization: Bearer mob_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        │
                        ▼
              Hash the full key (SHA-256)
                        │
                        ▼
              Look up hash in api_keys table
                        │
                        ▼
              Check permissions for the requested action
              (GET = read, POST = write)
                        │
                        ▼
              Authenticated — set req.context as { source: 'api_key', keyId, permissions }
```

---

## Internal vs External Usage

### Internal (server-side code)

The `EventLogger` class writes directly to the `event_log` table via Drizzle — no HTTP overhead, no auth needed since it's already in-process. This is used by project gates, integration runners, and PRD generators.

```typescript
// Fast path — direct DB insert
const logger = new EventLogger({ db, entityType: 'project', entityId: project.id })
logger.log('phase.passed', { summary: 'Phase completed' })
```

### External (HTTP clients)

External tools POST to `/api/events`. They go through the full API path: auth, validation, insert, response. Same table, same schema, different entry point.

```bash
curl -X POST /api/events \
  -H "Authorization: Bearer mob_xxx" \
  -H "Content-Type: application/json" \
  -d '{"events": [{"entityType": "build", "entityId": "...", "eventType": "build.ci_passed", "summary": "CI passed for PR #123"}]}'
```

### Client-side (Mobster UI)

The UI queries events via `GET /api/events` — this is how the project timeline and runner log viewer get their data. Polling, pagination, and filtering all work through the same API that external tools use.

```typescript
// In a client component
const { data } = await fetch('/api/events?entityType=project&entityId=xxx&pageSize=50')
```

---

## Consumer Examples

### Example 1: Custom runner (external Python script)

```python
import requests, os, time

API_URL = "http://localhost:3000/api/events"
API_KEY = os.environ["MOBSTER_API_KEY"]
SESSION_ID = f"custom-runner-{int(time.time())}"

def log(event_type, summary, metadata=None):
    requests.post(API_URL, json={"events": [{
        "entityType": "agent_session",
        "entityId": "custom-runner",
        "eventType": event_type,
        "summary": summary,
        "metadata": metadata,
        "sessionId": SESSION_ID,
    }]}, headers={"Authorization": f"Bearer {API_KEY}"})

log("agent.status", "Custom runner started")
# ... do work ...
log("agent.thinking", "Analyzing codebase structure")
log("agent.tool_call", "Running custom analysis", {"toolName": "analyze", "duration_ms": 1234})
log("agent.output", "Found 3 potential issues")
log("agent.status", "Custom runner finished")
```

### Example 2: Dashboard querying project health

```typescript
// "How many integrations failed across all active projects this week?"
const response = await fetch(
  '/api/events/stats?entityType=project&eventType=item.failed&from=2026-06-01'
)
// Response: { total: 3, byDay: { "2026-06-02": 2, "2026-06-04": 1 } }
```

### Example 3: CI pipeline reporting

```yaml
# .github/workflows/report-to-mobster.yml
- name: Report build status to Mobster
  run: |
    curl -X POST $MOBSTER_URL/api/events \
      -H "Authorization: Bearer $MOBSTER_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "events": [{
          "entityType": "build",
          "entityId": "$BUILD_JOB_ID",
          "eventType": "build.ci_passed",
          "summary": "All checks passed for PR #$PR_NUMBER",
          "metadata": {
            "prNumber": $PR_NUMBER,
            "commitSha": "$COMMIT_SHA",
            "workflowUrl": "$WORKFLOW_URL"
          }
        }]
      }'
```

---

## Implementation Approach

### Phase 3.6a: Core Events API (with Phase 3.5)

Ships alongside the project system:

| Step | What | Depends on |
|------|------|-----------|
| 1 | `event_log` table + `EventLogger` class (already in 3.5) | Nothing |
| 2 | `POST /api/events` + `GET /api/events` routes | `event_log` table |
| 3 | `GET /api/events/stats` route | `event_log` table |
| 4 | `EventTimeline` component queries via `GET /api/events` | Events API |

### Phase 3.6b: API Key System (Post-V1.0)

Ships independently:

| Step | What | Depends on |
|------|------|-----------|
| 1 | `api_keys` table + DDL | Nothing |
| 2 | API key CRUD routes (`/api/settings/api-keys`) | `api_keys` table |
| 3 | API key auth middleware | `api_keys` table |
| 4 | Settings UI section for key management | API key routes |
| 5 | `POST /api/events` accepts both session + API key auth | API key middleware |

### Phase 3.6c: Migrate Existing Systems (Post-V1.0)

Once the Events API is stable and API keys work:

| Step | What |
|------|------|
| 1 | `SessionLogger` becomes a wrapper around `POST /api/events` (or keeps direct-DB for perf) |
| 2 | `runner-log-viewer.tsx` reads from `GET /api/events?sessionId=...` |
| 3 | Existing `agent_logs` rows migrated into `event_log` |
| 4 | `agent_logs` table deprecated |

---

## Related Documents

- [`35-project-phase.md`](35-project-phase.md) — Project system vision (uses `event_log` for project history)
- [`35-project-phase-technical.md`](35-project-phase-technical.md) — Technical implementation (defines `event_log` schema + `EventLogger` class)
- [`backlog.md`](backlog.md) — Backlog items for API key system and system migration
