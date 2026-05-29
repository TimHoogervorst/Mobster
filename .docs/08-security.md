# 08 — Security

**Phase:** 0 (Foundation Setup)  
**Status:** In Progress  
**Date:** 2026-05-29

---

## 1. Threat Model

Mobster is a **self-hosted, single-user** web application. The primary threats:

| Threat | Severity | Mitigation |
|--------|----------|------------|
| GitHub token exfiltration | **Critical** | Encrypt at rest, never expose to client, minimal scope |
| Unauthorized web UI access | **High** | Auth gate all routes, session management |
| Agent escape / workspace breakout | **High** | Sandbox workspaces, no host filesystem access beyond `/workspaces` |
| CSRF attacks | **Medium** | NextAuth CSRF protection, SameSite cookies |
| Malicious repo content fed to agent | **Medium** | Agent runs in isolated workspace, no access to Mobster's DB or config |
| Docker container escape | **Low** | Run as non-root, minimal base image, no privileged mode |
| SQL injection | **Low** | Drizzle ORM parameterized queries |

---

## 2. GitHub Token Handling

### 2.1 OAuth Scope

Request **minimum required scopes**:

```
repo (private repos)      ← Full control of private repos (needed for PR creation)
read:user                 ← Read user profile
user:email                ← Read email addresses
```

Alternatively, use `public_repo` if private repo support isn't needed for v1.

### 2.2 Token Storage

```
┌─────────────────────────────────────────────────────┐
│              Token Encryption Flow                    │
│                                                      │
│  GitHub OAuth ──→ Access Token                       │
│                      │                               │
│                      ▼                               │
│              ┌────────────────┐                      │
│              │  AES-256-GCM   │                      │
│              │  Encrypt       │                      │
│              │  (key from env)│                      │
│              └───────┬────────┘                      │
│                      │                               │
│                      ▼                               │
│              Encrypted blob stored in SQLite         │
│              (users.github_token)                    │
│                                                      │
│  On use: decrypt → use → discard from memory         │
└─────────────────────────────────────────────────────┘
```

### 2.3 Implementation

```typescript
// packages/shared/src/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes, 64 hex chars

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Store as: iv + tag + encrypted (all hex-encoded)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(encoded: string): string {
  const [ivHex, tagHex, encryptedHex] = encoded.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
```

### 2.4 Key Management

- `ENCRYPTION_KEY` passed via Docker environment variable or `.env` file
- Generate with: `openssl rand -hex 32`
- **Never committed to git** — `.env` is in `.gitignore`
- Documented in setup guide
- If key is lost, user must re-authenticate with GitHub

---

## 3. Web Application Security

### 3.1 Authentication

- **NextAuth.js v5** with GitHub OAuth provider
- Session token stored in HTTP-only, Secure, SameSite=Lax cookie
- All routes except `/login` and `/api/auth/*` protected by middleware
- Session persisted in SQLite via Drizzle adapter

### 3.2 CSRF Protection

- NextAuth.js includes CSRF token in all form submissions
- API routes that mutate data check the CSRF token
- SameSite=Lax on session cookie

### 3.3 HTTP Security Headers

```typescript
// next.config.ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

// CSP configured per page, allowing:
// - Self scripts/styles
// - GitHub API for OAuth flow
```

### 3.4 API Rate Limiting

Simple in-memory rate limiting on agent endpoints:

```typescript
// Prevent accidental spam on expensive endpoints
const AGENT_RATE_LIMIT = {
  prdGeneration: { max: 5, windowMs: 60_000 },    // 5 per minute
  codeGeneration: { max: 3, windowMs: 300_000 },   // 3 per 5 minutes
}
```

---

## 4. Agent Workspace Security

### 4.1 Isolation

```
/workspaces/
└── {jobId}/                    ← One directory per build job
    ├── repo/                   ← Cloned repository
    │   └── ...                 ← Agent modifies files here
    └── agent-output.log        ← Captured stdout/stderr

# Agent CAN access:
#   /workspaces/{jobId}/repo/*
#
# Agent CANNOT access:
#   /data/mobster.db            ← Database file
#   /workspaces/other-job/      ← Other job directories
#   /app/                       ← Mobster application code
#   /etc/, /proc/, /sys/        ← Host system
```

### 4.2 Claude Code CLI Hardening

- Run Claude Code with `--dangerously-disable-sandbox` set to **false** (keep sandbox on)
- Set `--max-turns` to limit runaway agent loops
- Set `--output-format json` for parseable logs
- Pass workspace path via `--working-dir /workspaces/{jobId}/repo`
- Timeout: kill process if job exceeds configurable max duration (default: 2 hours)

### 4.3 Git Safety

- Agent creates branch `mobster/{issue-number}-{slug}` — never commits to `main`
- Agent has GitHub token scoped to the specific repo (the user's OAuth token)
- If agent force-pushes, Git history is preserved in reflog
- User reviews PR before merging — final safety gate

---

## 5. Docker Security

### 5.1 Dockerfile Best Practices

```dockerfile
FROM node:22-alpine AS base

# Create non-root user
RUN addgroup -g 1001 mobster && \
    adduser -u 1001 -G mobster -s /bin/sh -D mobster

# ... build steps ...

FROM node:22-alpine AS runner
COPY --from=base /app /app
USER mobster  # Run as non-root
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

### 5.2 docker-compose.yml Security

```yaml
services:
  mobster:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - mobster_data:/data        # SQLite DB
      - mobster_workspaces:/workspaces  # Agent workspaces
    environment:
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - AUTH_SECRET=${AUTH_SECRET}
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    # No privileged mode
    # No host network mode
    # No capability additions
    read_only: true               # Root FS read-only
    tmpfs:                         # Writable /tmp for Next.js
      - /tmp

volumes:
  mobster_data:
  mobster_workspaces:
```

---

## 6. Environment Variables

| Variable | Purpose | Sensitivity | Generate How |
|----------|---------|-------------|-------------|
| `ENCRYPTION_KEY` | Encrypts GitHub tokens | **Secret** | `openssl rand -hex 32` |
| `AUTH_SECRET` | NextAuth signing key | **Secret** | `openssl rand -hex 32` |
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID | **Confidential** | GitHub OAuth app settings |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | **Secret** | GitHub OAuth app settings |
| `ANTHROPIC_API_KEY` | Claude API key | **Secret** | Anthropic console |
| `DATABASE_PATH` | SQLite file location | Not sensitive | Default: `/data/mobster.db` |
| `WORKSPACE_PATH` | Agent workspace root | Not sensitive | Default: `/workspaces` |

---

## 7. Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Should we support a "local only" mode without GitHub OAuth (just paste a PAT)? | → Nice for Phase 4, not needed for Phase 0 |
| 2 | Should we encrypt the entire SQLite DB or just the token column? | → Token column only (simpler, sufficient for single-user threat model) |
| 3 | Audit logging: should we log all agent actions? | → Log to BuildJob.agentLog, sufficient for v1 |
