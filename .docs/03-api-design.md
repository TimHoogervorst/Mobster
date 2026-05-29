# 03 — API Design

**Phase:** 1 (GitHub Sync Engine)  
**Status:** In Progress  
**Date:** 2026-05-29

---

## 1. API Principles

- **RESTful** — resource-oriented URLs, standard HTTP methods
- **JSON** — all request/response bodies are JSON
- **Auth required** — all `/api/*` routes require a valid session (NextAuth middleware)
- **Error format** — `{ error: string, details?: string }` with appropriate HTTP status codes
- **Pagination** — `{ data: T[], total: number, page: number, pageSize: number }` for list endpoints

---

## 2. Repos API

### GET `/api/repos`

List the authenticated user's GitHub repos. Includes connection status for each.

**Response (200):**
```json
{
  "repos": [
    {
      "id": 123456,
      "fullName": "owner/repo",
      "owner": "owner",
      "name": "repo",
      "description": "A cool project",
      "language": "TypeScript",
      "stars": 42,
      "defaultBranch": "main",
      "connected": true,
      "connectedRepoId": "uuid-if-connected",
      "lastSyncedAt": "2026-05-29T12:00:00Z",
      "issueCount": 15
    }
  ]
}
```

**Error (401):** `{ "error": "Not authenticated" }`
**Error (403):** `{ "error": "GitHub token not configured" }`

---

### POST `/api/repos`

Save selected repos to start syncing.

**Request:**
```json
{
  "repos": [
    {
      "owner": "owner",
      "name": "repo",
      "fullName": "owner/repo"
    }
  ]
}
```

**Response (201):**
```json
{
  "created": 2,
  "repos": [
    { "id": "uuid", "fullName": "owner/repo" }
  ]
}
```

**Error (400):** `{ "error": "Invalid request", "details": "..." }`

---

### DELETE `/api/repos/[id]`

Remove a repo connection. Cascades to delete all synced issues.

**Response (200):** `{ "deleted": true }`
**Error (404):** `{ "error": "Repo not found" }`

---

### POST `/api/repos/[id]/sync`

Trigger a sync for a specific connected repo.

**Response (200):**
```json
{
  "repoId": "uuid",
  "fullName": "owner/repo",
  "created": 5,
  "updated": 3,
  "skipped": 10,
  "syncedAt": "2026-05-29T13:00:00Z"
}
```

**Error (404):** `{ "error": "Repo not found" }`
**Error (502):** `{ "error": "GitHub API error", "details": "rate limit exceeded" }`

---

## 3. Issues API

### GET `/api/issues`

List synced issues with optional filters.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `repo` | string | — | Filter by repo ID |
| `type` | string | — | bug, feature, question, other |
| `state` | string | open | open, closed |
| `label` | string | — | Filter by label (exact match) |
| `q` | string | — | Full-text search in title + body |
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page (max 100) |
| `sort` | string | updatedAt | Sort field |
| `order` | string | desc | asc, desc |

**Response (200):**
```json
{
  "issues": [
    {
      "id": "uuid",
      "repoId": "uuid",
      "repoFullName": "owner/repo",
      "githubId": 123456,
      "number": 42,
      "title": "Fix login bug",
      "body": "When clicking login...",
      "state": "open",
      "issueType": "bug",
      "labels": ["bug", "p1"],
      "assignee": "username",
      "milestone": "v1.0",
      "githubUrl": "https://github.com/owner/repo/issues/42",
      "githubCreatedAt": "2026-05-20T10:00:00Z",
      "githubUpdatedAt": "2026-05-28T15:00:00Z",
      "userNotes": "Need to check auth flow",
      "userTags": ["quick-win"]
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

---

### GET `/api/issues/[id]`

Get a single issue by its internal ID.

**Response (200):** Single issue object (same shape as list item, plus full body)
**Error (404):** `{ "error": "Issue not found" }`

---

### PATCH `/api/issues/[id]`

Update local annotations on an issue.

**Request:**
```json
{
  "userNotes": "Updated analysis notes",
  "userTags": ["p0", "security"],
  "issueType": "bug"
}
```

All fields are optional — only provided fields are updated.

**Response (200):** Updated issue object
**Error (400):** `{ "error": "Invalid request", "details": "..." }`
**Error (404):** `{ "error": "Issue not found" }`

---

## 4. HTTP Status Code Map

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input (Zod validation failed) |
| 401 | Unauthorized | No valid session |
| 403 | Forbidden | Valid session but no GitHub token |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Error | Unexpected server error |
| 502 | Bad Gateway | GitHub API returned an error |

---

## 5. Error Response Format

All errors follow the same shape:

```json
{
  "error": "Human-readable error message",
  "details": "Optional technical details (not exposed in production)",
  "code": "MACHINE_READABLE_CODE"
}
```

Error codes:
- `UNAUTHORIZED` — no session
- `NO_GITHUB_TOKEN` — session exists but no GitHub token stored
- `VALIDATION_ERROR` — Zod validation failed
- `NOT_FOUND` — resource not found
- `GITHUB_API_ERROR` — GitHub API returned an error
- `RATE_LIMITED` — GitHub rate limit hit
- `INTERNAL_ERROR` — unexpected server error
