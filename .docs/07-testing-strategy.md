# 07 — Testing Strategy

**Phase:** 0 (Foundation Setup) — **Complete**  
**Last Updated:** 2026-05-29

---

## 1. Test Pyramid

```
         ┌──────┐
         │ E2E  │  ← Playwright: critical user flows (planned)
         ├──────┤
         │ Int. │  ← Vitest: API routes, DB ops, sync engine
         ├──────┤
         │ Unit │  ← Vitest: pure functions, utilities, encryption
         └──────┘
```

---

## 2. What's Implemented

| Layer | Tests | Location |
|-------|-------|----------|
| Unit | 20 tests | `packages/shared/src/*.test.ts`, `packages/db/src/*.test.ts`, `apps/web/src/lib/*.test.ts` |
| Integration | Schema roundtrip, encryption roundtrip | DB test creates tables in `:memory:`, verifies CRUD + cascades |
| E2E | Not yet | Playwright configured, no test files yet |

### Test Files
- `packages/shared/src/index.test.ts` — 4 tests: status enums, type exports
- `packages/shared/src/encryption.test.ts` — 11 tests: encrypt/decrypt roundtrip, tamper detection, missing key
- `packages/db/src/index.test.ts` — 2 tests: insert + query, cascade delete
- `apps/web/src/lib/utils.test.ts` — 3 tests: cn() class merging

---

## 3. Tooling

| Tool | Purpose |
|------|---------|
| Vitest | Unit + integration tests |
| Playwright | E2E browser tests (configured, tests pending) |
| GitHub Actions | CI: lint → typecheck → test |

---

## 4. Running Tests

```bash
pnpm test          # All tests
pnpm test --filter=@mobster/shared  # Just shared package
pnpm e2e           # Playwright (when tests are added)
```

---

## 5. Planned (Phase 2+)

- Playwright E2E tests for full user flows
- MSW (Mock Service Worker) for GitHub API mocking in integration tests
- Test fixtures directory
- Visual regression testing
