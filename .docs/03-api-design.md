# 03 — API Design

**Phase:** 1 (GitHub Sync Engine) — **Complete**  
**Last Updated:** 2026-05-29

---

## 1. API Principles

- **RESTful** — resource-oriented URLs, standard HTTP methods
- **JSON** — all request/response bodies are JSON
- **Auth** — via custom JWT session cookie. `auth()` helper verifies the cookie, decrypts the PAT from the DB, and returns `{ accessToken, user }`. Routes return 401 if no valid session.
- **Error format** — `{ error: string, details?: string }` with appropriate HTTP status codes
- **Pagination** — `{ data: T[], total: number, page: number, pageSize: number }` for list endpoints

---

## 2. Repos API

### GET `/api/repos`
List the authenticated user's GitHub repos with connection status.

**Response (200):**
```json
{
  "repos": [
    {
      "id": 123456,
      "fullName": "owner/repo",
      "connected": true,
      "connectedRepoId": "uuid",
      "lastSyncedAt": "2026-05-29T12:00:00Z"
    }
  ]
}
```

### POST `/api/repos`
Save selected repos to start syncing. Body: `{ repos: [{ owner, name, fullName }] }`. Returns 201.

### DELETE `/api/repos/[id]`
Remove a repo connection. Cascades to delete synced issues. Returns 200.

### POST `/api/repos/[id]/sync`
Trigger a manual sync. Returns `{ created, updated, skipped, syncedAt }`.

---

## 3. Issues API

### GET `/api/issues`
List synced issues with filters.

**Query params:** `repo`, `type` (bug/feature/question/other), `state` (open/closed), `label`, `q` (search), `page`, `pageSize`, `sort` (githubUpdatedAt/title), `order` (asc/desc)

**Response (200):**
```json
{
  "issues": [{
    "id": "uuid", "number": 42, "title": "Fix login bug",
    "state": "open", "issueType": "bug",
    "labels": ["bug", "p1"], "assignee": "username",
    "repoFullName": "owner/repo",
    "userNotes": "...", "userTags": ["quick-win"]
  }],
  "total": 42, "page": 1, "pageSize": 20
}
```

### GET `/api/issues/[id]`
Single issue by internal ID.

### PATCH `/api/issues/[id]`
Update local annotations. Body: `{ userNotes?, userTags?, issueType? }`. All optional.

---

## 4. Error Codes

| Code | When |
|------|------|
| 401 | No valid session |
| 400 | Validation error (Zod) |
| 404 | Resource not found |
| 502 | GitHub API error |
| 500 | Internal server error |
