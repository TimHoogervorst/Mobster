# 05 — V1.0 Finalization

**Status:** Planned  
**Last Updated:** 2026-06-03

---

## Goal

Prepare Mobster for a V1.0 release with proper Docker support, finalized documentation, comprehensive testing, and security hardening.

---

## 1. Docker & Deployment

### 1.1 Current State
- Basic `Dockerfile` and `docker-compose.yml` exist in `/docker`
- Not yet tested end-to-end
- No published Docker image

### 1.2 V1.0 Requirements
- Multi-stage Docker build (deps → build → runtime)
- Production-ready `docker-compose.yml` with:
  - Volume mounts for SQLite database persistence
  - Volume mounts for workspace cache
  - Environment variable configuration
  - Health check endpoint
- GitHub Container Registry publication
- One-command startup: `docker compose up`
- Non-root user in container
- Read-only root filesystem

---

## 2. Documentation

### 2.1 User-Facing
- README with complete setup guide
- Screenshots of key pages
- Environment variable reference
- Troubleshooting section
- PAT scope requirements clearly documented

### 2.2 Developer-Facing
- Architecture overview kept up to date
- API documentation (Swagger UI already done)
- Contributing guide
- Local development setup guide

---

## 3. Testing

### 3.1 Unit & Integration Tests
- Increase test coverage for shared package (encryption, validation)
- Add tests for DB schema (CRUD operations, cascades, constraints)
- Add tests for auth flow (JWT sign/verify, PAT decrypt)
- Add tests for GitHub API client
- Add tests for sync engine

### 3.2 E2E Tests (Playwright)
- Login flow (PAT entry → validation → redirect)
- Repo sync flow
- Issue triage flow
- PRD generation flow
- Integration flow (if test repo with write access available)
- Agent configuration CRUD

### 3.3 CI Pipeline
- Lint → typecheck → unit tests → E2E tests
- Docker build verification
- Automated dependency updates (Renovate/Dependabot)

---

## 4. Security Hardening

### 4.1 Token Security
- PAT scope validation at login time (check `X-OAuth-Scopes` header)
- Warn if `repo` scope is missing (required for push/integration)
- Token expiry detection and re-prompt
- Rate limiting on all API endpoints (currently only on PRD endpoints)

### 4.2 Application Security
- CSP headers
- CSRF protection for mutation endpoints
- Input sanitization review
- SQLite WAL mode and foreign keys (already enabled)
- Audit log for sensitive operations

### 4.3 Docker Security
- Run as non-root user (uid 1001)
- Read-only root filesystem
- No privileged mode
- Minimal base image (Alpine or distroless)
- Regular base image updates

---

## 5. Pre-V1 Polish

### 5.1 Error Handling
- Graceful handling of GitHub API rate limits
- Graceful handling of agent timeouts
- Offline/reconnect handling for runner log polling
- Clear error messages for all failure modes

### 5.2 Edge Cases
- Empty repos (no issues)
- Repos with thousands of issues (pagination)
- Very long PRD titles/content
- Unicode/emoji in issue titles
- PAT with minimal scopes (graceful degradation)

### 5.3 Papercuts
- Consistent date formatting everywhere
- Proper loading states on all buttons
- Confirmation dialogs for destructive actions
- Keyboard navigation support
- Focus management in dialogs

---

## 6. Release Checklist

- [ ] All Phase 3 & 4 items complete
- [ ] Docker image builds and runs
- [ ] `docker compose up` works from scratch
- [ ] Documentation reviewed and updated
- [ ] Test suite passes (unit + integration + E2E)
- [ ] Security review complete
- [ ] License headers on all source files
- [ ] CHANGELOG.md created
- [ ] Git tag `v1.0.0`
- [ ] Docker image published to GHCR
