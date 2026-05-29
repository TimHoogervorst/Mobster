# 07 — Testing Strategy

**Phase:** 0 (Foundation Setup)  
**Status:** In Progress  
**Date:** 2026-05-29

---

## 1. Test Pyramid

```
         ┌──────┐
         │ E2E  │  ← Playwright: critical user flows
         ├──────┤
         │ Int. │  ← Vitest + MSW: API routes, DB ops, agent calls
         ├──────┤
         │ Unit │  ← Vitest: pure functions, utilities, state machines
         └──────┘
```

### Distribution Target
- **Unit:** ~60% of tests (fast, focused)
- **Integration:** ~30% (API routes, sync engine, agent pipeline)
- **E2E:** ~10% (happy paths that cross multiple systems)

---

## 2. Tooling

| Tool | Purpose | Config Location |
|------|---------|-----------------|
| **Vitest** | Unit + integration tests | `vitest.config.ts` per package |
| **Playwright** | E2E browser tests | `playwright.config.ts` in `apps/web` |
| **MSW (Mock Service Worker)** | Mock GitHub API + Anthropic API in integration tests | `apps/web/src/mocks/` |
| **@testing-library/react** | Component tests | Used within Vitest |
| **GitHub Actions** | CI runner | `.github/workflows/ci.yml` |

---

## 3. What We Test Per Layer

### 3.1 Unit Tests (Vitest)

**Location:** `*.test.ts` co-located with source files

**What to test:**
- Pure utility functions (date formatting, label parsing, URL builders)
- State machine transitions (PRD status, BuildJob status)
- Encryption/decryption roundtrips
- Prompt template rendering
- Schedule parsing (cron expression → next run time)

**What NOT to test:**
- Drizzle ORM operations (tested via integration)
- Next.js page rendering (tested via component/E2E)
- Third-party library internals

### 3.2 Integration Tests (Vitest + MSW)

**Location:** `apps/web/src/__tests__/` and `packages/*/src/__tests__/`

**What to test:**
- API route handlers: request → response cycle with mocked external APIs
- GitHub sync engine: mock GitHub API, verify DB insert/update
- Agent PRD generation: mock Anthropic API, verify PRD stored
- Database operations: real SQLite in-memory, verify CRUD
- Auth flow: mock GitHub OAuth, verify session creation
- Job scheduler: enqueue job, verify worker picks it up

**MSW Setup:**
```typescript
// Mock GitHub API
http.get('https://api.github.com/repos/:owner/:repo/issues', ({ params }) => {
  return HttpResponse.json([/* fixture data */])
})

// Mock Anthropic API
http.post('https://api.anthropic.com/v1/messages', () => {
  return HttpResponse.json({ content: [{ text: "Generated PRD..." }] })
})
```

### 3.3 E2E Tests (Playwright)

**Location:** `apps/web/e2e/`

**What to test (happy paths):**
1. **Login flow:** Click "Sign in with GitHub" → redirected to dashboard
2. **Repo connection:** Browse repos → select one → see issues appear
3. **PRD generation:** Click issue → click "Generate PRD" → see PRD in list
4. **PRD scheduling:** Approve PRD → click "Schedule" → see it in build queue
5. **Build monitoring:** Queue a job → see status change → see PR link on success

**Playwright config:**
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

---

## 4. Test Infrastructure

### 4.1 Database in Tests

- **Unit tests:** No DB needed (mock at function boundary)
- **Integration tests:** SQLite in-memory (`:memory:`) — fast, isolated, real SQL
- **E2E tests:** SQLite file in temp directory — replica of production

### 4.2 Fixtures

```
packages/db/src/fixtures/
├── issues.ts         ← Sample GitHub issues
├── repos.ts          ← Sample repos
├── prds.ts           ← Sample PRDs in various statuses
└── user.ts           ← Sample user with mock token
```

### 4.3 Test Database Setup

```typescript
// vitest setup file
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../src/schema'

beforeEach(async () => {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  // Run migrations on in-memory DB
  // Seed if needed
})
```

---

## 5. CI Pipeline (GitHub Actions)

```yaml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint        # ESLint + Prettier check

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm typecheck   # tsc --noEmit across all packages

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test        # Vitest unit + integration

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm e2e         # Playwright E2E
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces
          path: apps/web/test-results/
```

---

## 6. Testing Conventions

- **Test file location:** `__tests__/` directory or co-located `*.test.ts`
- **Naming:** `describe('ThingBeingTested', () => { it('should do X when Y', () => {}) })`
- **Coverage:** Aim for 80%+ on `packages/shared`, 70%+ on `packages/db`, 60%+ on `apps/web`
- **No snapshots** for dynamic data (use inline assertions instead)
- **Snapshots OK** for static UI components

---

## 7. Phase 0 Testing Deliverables

| Test | Type | What It Proves |
|------|------|---------------|
| `packages/shared` has one unit test | Unit | Vitest works, imports resolve |
| `packages/db` migration roundtrip | Integration | Drizzle can create tables in SQLite |
| `apps/web` smoke test page | E2E | Next.js starts, page loads |
| CI pipeline runs green | CI | All three jobs pass |

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Should we use Turborepo's `--cache` for test caching in CI? | → Yes, configure after initial CI is green |
| 2 | Visual regression testing with Playwright? | → Phase 4, not needed for foundation |
