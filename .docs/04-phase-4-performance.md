# 04 — Phase 4: Performance & Simplification

**Status:** Planned  
**Last Updated:** 2026-06-03

---

## Goal

Optimize both UI and back-end performance, and simplify components and code patterns to make the codebase more maintainable and faster.

---

## 1. Back-end Performance

### 1.1 N+1 Query Elimination
- **Runner routes**: Currently query PRD and agent individually per session row. Use JOINs or batch queries.
- **PRD detail page**: Multiple individual DB queries for linked issues, repo info, comments, agent, build jobs. Consolidate into fewer queries.
- **Inbox page**: Enriches issues with repo names via per-issue queries. Join at query level.

### 1.2 Database Indexes
- Add indexes on frequently queried columns:
  - `agent_logs(session_id, created_at)`
  - `agent_logs(prd_id, created_at)`
  - `build_jobs(prd_id, created_at)`
  - `prd_issues(prd_id)`
  - `issues(repo_id)`

### 1.3 API Response Optimization
- Cache GitHub API responses where appropriate (repo list, user info)
- Add ETag/conditional request support for issue sync
- Stream large agent outputs instead of buffering in memory

### 1.4 Agent Runner Performance
- Parallelize workspace setup with other initialization
- Reuse agent connections across sessions where possible
- Implement workspace cleanup policies (max age, max count)

---

## 2. Front-end Performance

### 2.1 Bundle Size
- Audit and tree-shake large dependencies
- Dynamic import for heavy components (already done for Swagger UI, PRD viewer)
- Lazy load icons (lucide-react dynamic imports)

### 2.2 Rendering
- Reduce client-side JavaScript where server components suffice
- Add `loading.tsx` files for route segments that fetch data
- Use React `Suspense` boundaries for streaming
- Memoize expensive computations in client components

### 2.3 Network
- Add proper caching headers to API responses
- Implement stale-while-revalidate pattern for runner status polling
- Batch API calls where multiple fetches happen on page load

---

## 3. Component Simplification

### 3.1 Current Complexity Issues
- `integration-runner.ts` is too large (~500 lines). Split into: workspace manager, git operations, agent runner, PR creator.
- `prd-generator.ts` shares patterns with integration-runner. Extract shared orchestration logic.
- `integrate-dialog.tsx` has too many conditional render paths. Split into sub-components.
- PRD detail page has complex conditional rendering for all status/build-job combinations. Extract into `IntegrationPanel` component.

### 3.2 Proposed Refactoring
```
lib/agents/
├── index.ts                    ← Public exports
├── types.ts                    ← Shared types
├── factory.ts                  ← Runner factory
├── logger.ts                   ← SessionLogger
├── workspace.ts                ← Workspace management
├── tool-use.ts                 ← Workspace tools
├── orchestration.ts            ← NEW: Shared orchestration logic
├── prd-template.ts             ← PRD prompt builder
├── prd-generator.ts            ← PRD generation (uses orchestration)
├── integration-template.ts     ← Integration prompt builder
├── integration-runner.ts       ← Integration (uses orchestration)
│   ├── git-operations.ts       ← NEW: commit, push, PR logic
│   └── workspace-manager.ts    ← NEW: cache, clone, cleanup
├── claude-code-runner.ts
└── anthropic-sdk-runner.ts
```

### 3.3 UI Component Simplification
- Extract `BuildJobPanel` from PRD detail page (handles all build job states)
- Extract `IntegrationHistory` as standalone component
- Simplify `IntegrateDialog` by extracting target-type selector and branch input into sub-components
- Unify `IntegrateButton` and `StatusButton` props pattern

---

## 4. Code Quality

- Add stricter ESLint rules
- Add path aliases for commonly imported modules
- Standardize error handling patterns across API routes
- Add JSDoc to all public functions in `lib/`
- Remove unused `next-auth` dependency (replaced by custom JWT)
