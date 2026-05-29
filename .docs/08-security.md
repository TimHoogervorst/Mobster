# 08 — Security

**Phase:** 0 (Foundation Setup) — **Complete**  
**Last Updated:** 2026-05-29

---

## 1. Threat Model

Mobster is a **self-hosted, single-user** web application. Primary threats:

| Threat | Severity | Mitigation |
|--------|----------|------------|
| PAT exfiltration | **Critical** | Encrypt at rest (AES-256-GCM), never expose to client after initial entry, HTTP-only session cookie |
| Unauthorized UI access | **High** | JWT session cookie signed with auto-generated `AUTH_SECRET` |
| Session hijacking | **Medium** | HTTP-only, Secure, SameSite=Lax cookies; JWT expiry (30 days) |
| SQL injection | **Low** | Drizzle ORM parameterized queries |
| Docker escape | **Low** | Non-root user, minimal base image, read-only root FS |

---

## 2. Token Handling

### 2.1 PAT Storage

```
User enters PAT on /login
  → Server validates against GET https://api.github.com/user
  → PAT encrypted with AES-256-GCM (key from ENCRYPTION_KEY)
  → Stored in users.github_token (SQLite)
  → PAT never returned to client after initial save
  → On subsequent requests: auth() decrypts PAT from DB for API calls
```

### 2.2 Session Cookie

- Cookie name: `authjs.session-token`
- Signed JWT (HS256) with `AUTH_SECRET`
- Contains: `githubId`, `githubUsername`, `githubAvatar` (NOT the PAT)
- HttpOnly, Secure (production), SameSite=Lax
- 30-day expiry

### 2.3 Encryption

- Algorithm: AES-256-GCM (authenticated encryption)
- Key: 32 bytes, read from `ENCRYPTION_KEY` env var or auto-generated + persisted in `app_settings`
- Format: `iv:tag:ciphertext` (hex-encoded)
- Used for: PAT (`users.github_token`)
- Implementation: `packages/shared/src/encryption.ts`

---

## 3. Web Application Security

### 3.1 Authentication
- Custom JWT implementation using `jose` library
- `AUTH_SECRET` auto-generated on first run, persisted in `app_settings`
- `auth()` helper verifies JWT → looks up user → decrypts PAT → returns `{ accessToken, user }`
- Used by all API routes and server components

### 3.2 HTTP Security Headers
```typescript
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### 3.3 API Rate Limiting
Simple in-memory rate limiting on agent endpoints (Phase 2+).

---

## 4. Docker Security

```yaml
# docker-compose.yml
services:
  mobster:
    read_only: true          # Root FS read-only
    # No privileged mode
    # No host network
    # Runs as non-root user (uid 1001)
```

---

## 5. Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `ENCRYPTION_KEY` | AES-256-GCM key for PAT encryption | Auto-generated if not set |
| `DATABASE_PATH` | SQLite file location | Defaults to `./mobster.db` |
| `WORKSPACE_PATH` | Agent workspace root | Defaults to `./workspaces` |
| `AUTH_URL` | Override base URL for callbacks | Optional (auto-detected) |
| `MIGRATIONS_PATH` | Override path to DDL files | Optional |

`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET` are **not needed** — the PAT is entered via UI, and `AUTH_SECRET` is auto-generated.
