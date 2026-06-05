# 🗺️ Mobster Roadmap

**Created:** 2026-06-04
**Current Phase:** Post-Phase 2 → V1.0
**Target:** 1 month to V1.0 launch, then expand platform

---

## 🎯 1 Month Goals (V1.0 Launch — by July 4)

---

### 1. GitHub DevOps Integration (Intake Hub + Unified Items)

Connect the inbox to the full GitHub development lifecycle, not just issues.

> **📋 Implementation plan:** Phase 3.5 ([35-project-phase.md](35-project-phase.md) + [35-project-phase-technical.md](35-project-phase-technical.md)) covers the Intake Hub (tabbed Issues/PRs view), the unified `items` table, and PR syncing. This roadmap item is the motivation; Phase 3.5 is the execution plan.

- [ ] **Unified `items` table** — single table for issues, PRs, manual items, and future sources. Normalized schema with `sourceData` JSON for source-specific fields.
- [ ] **PR syncing** — sync open PRs alongside issues into the unified `items` table, show CI check status (green/red/pending), review state (approved/changes requested)
- [ ] **Intake Hub** — rename Inbox → Intake, tabbed view (Issues / Pull Requests), "Add to Project" bulk action
- [ ] **GitHub Actions visibility** — show workflow run status per repo, surface failing runs in the dashboard
- [ ] **Branch awareness** — show active branches per repo, which issues/PRDs are tied to which branches
- [ ] **Unified activity feed** — `issues + PRs + CI runs + agent builds` in one chronological view with filtering

**Why:** The inbox today is issues-only. Real development involves PRs, CI, and branches. The Intake Hub becomes a command center, not just a list.

---

### 2. UI Consistency & Branding

Give Mobster a distinct visual identity instead of looking like a generic shadcn/ui prototype.

- [ ] **Logo & brand system** — detective/magnifying glass mark, color palette (move beyond default shadcn), distinctive heading font
- [ ] **Design tokens** — define `--mobster-*` CSS custom properties for colors, radii, shadows used everywhere
- [ ] **Page header component** — every page gets consistent `title + description + actions` layout
- [ ] **Status badge system** — unified badges for PRD status, build job status, issue state, CI checks, runner sessions
- [ ] **Card/list/table consistency** — same spacing, same hover states, same empty states across all pages
- [ ] **Dark mode audit** — fix every hardcoded color, ensure all pages look correct in both themes
- [ ] **Empty state illustrations** — consistent empty states with clear CTAs (not just "No items found")

**Pages to standardize:** Dashboard, Inbox, Issue Detail, PRDs List, PRD Detail, Agents, Runners, Repos, Settings, API Docs

---

### 3. Back-End & UI Performance

Eliminate slowness before anyone notices it.

**Back-End:**
- [ ] **N+1 query elimination** — inbox joins repo names at query level, PRD detail batch-loads linked issues/comments/build jobs
- [ ] **Database indexes** — add on `agent_logs(session_id, created_at)`, `build_jobs(prd_id)`, `prd_issues(prd_id)`, `issues(repo_id, state)`
- [ ] **API response caching** — cache repo list and user info (rarely changes), ETag support for issue sync
- [ ] **Pagination hardening** — test and fix with repos that have 500+ issues, add cursor-based pagination to API routes that don't have it

**UI:**
- [ ] **Loading skeletons** — every data-fetching page gets a `loading.tsx` with proper skeleton shapes (not just a spinner)
- [ ] **Dynamic imports** — lazy-load heavy components (PRD viewer markdown renderer, Swagger UI, runner log viewer)
- [ ] **Client-side memoization** — memoize filter/sort computations on inbox and PRD list
- [ ] **Streaming** — use React Suspense boundaries so pages render progressively, not all-at-once

---

### 4. Runner Communication Channel

Runners (AI agents executing PRDs) need a way to ask questions, request clarification, or flag when a PRD doesn't cover something. Today they run in a black box until completion or failure.

**Runner → User messaging:**
- [ ] **Blocking questions** — runner can pause execution and post a question to the user ("Should I use library X or Y?", "The PRD says refactor X but it's already been moved — which file should I touch?")
- [ ] **Clarification requests** — runner flags ambiguous PRD sections ("PRD says 'improve performance' — what target? 50ms? 200ms?")
- [ ] **Out-of-scope detection** — runner identifies work not in the PRD that's needed ("This change requires updating the auth middleware too — include it?")
- [ ] **Approval gates** — before pushing code, runner surfaces a summary diff with key decisions made, user approves or sends feedback

**User → Runner messaging:**
- [ ] **Inline PRD comments trigger re-evaluation** — comment on a PRD section, running agent picks it up if still active
- [ ] **Direct runner command** — send a message to a running session ("Stop and use PostgreSQL instead of SQLite", "Skip the test for now")

**Implementation approach:**
- [ ] Add a `runner_messages` table (session_id, direction, content, status, created_at)
- [ ] Runner polls for new messages at each step boundary
- [ ] UI shows a chat-like thread on the runner session page
- [ ] Unread messages surface in dashboard notifications

**Why this matters:** The #1 failure mode of AI coding agents is doing the wrong thing silently. A communication channel makes the agent a collaborator, not a black box.

---

### 5. Dashboards, Metrics & Token Usage

The current dashboard is three stat cards. Make it a real operations center.

**Dashboard v2:**
- [ ] **Token usage panel** — total tokens consumed per agent, per PRD, per session. Cost estimates based on model pricing (Claude Opus vs Sonnet vs Haiku rates)
- [ ] **Usage charts** — tokens over time (last 7/30 days), per-agent breakdown, per-repo breakdown
- [ ] **Agent success rate** — PRDs generated vs integrated, build job pass/fail ratio, avg time per integration
- [ ] **Repo health view** — open issues per repo, oldest issue, issues without PRDs, CI status summary
- [ ] **Activity timeline** — chronological feed: syncs, PRD generations, integrations, PRs opened, CI results
- [ ] **Cost projection** — "if you integrate 10 more PRDs this month, estimated cost: $X"

**Data needed:**
- [ ] Track token usage in `agent_logs` (add `input_tokens`, `output_tokens`, `model` columns)
- [ ] Track cost in `build_jobs` (add `token_cost` column or compute from usage × model rates)

---

### 6. Project-Based Release Management

Move beyond single-issue PRDs. Let users plan releases with structured phases and gates.

> **📋 Implementation plan:** Phase 3.5 ([35-project-phase.md](35-project-phase.md) + [35-project-phase-technical.md](35-project-phase-technical.md)) implements this as **Projects** (not "Epics" — the terminology was unified). Projects are release containers with ordered phases, gate criteria, and sequenced work items.

**Projects:**
- [ ] **Project entity** — a release/version container (title, description, status, repo). Represents "v1.0", "Sprint 24", or "Q3 Bug Bash"
- [ ] **Phases with gates** — ordered phases (integration / testing / review) with gate criteria between them. A phase auto-advances when all items complete and gate criteria pass
- [ ] **Item sequencing** — drag-to-reorder items within a phase. Items flow: pending → in_progress → integrated → tested → passed
- [ ] **In-project item creation** — add new bugs/features/PRs directly to a phase (not everything needs to come through Intake first)
- [ ] **Cross-project PRs** — create a PR item in Project B that merges work completed in Project A (e.g., hotfix → main release)

**Workflow engine (future — post V1.0):**
- [ ] **Automated transitions** — when CI passes, auto-request PR review. When review approved, auto-merge (if user enables it)
- [ ] **Code review stage** — after integration opens a PR, another agent reviews the diff and posts inline comments
- [ ] **Project templates** — pre-defined phase structures: "Bug Fix Release", "Feature Sprint"
- [ ] **Release notes auto-generation** — generate release notes from project history

**Why this matters:** Single-issue PRDs are great for small fixes. But real software work spans multiple issues and PRs across multiple phases. Projects make Mobster a release management tool, not just a codegen tool.

---

### 7. Proper Settings Page

The current settings page is a single section. Make it the control panel for the entire app.

- [ ] **Profile section** — GitHub user info display, PAT status (valid/expired/missing scopes), re-enter token
- [ ] **Agent defaults** — default model (Opus/Sonnet/Haiku), default max tokens, default PRD template tweaks, global environment variables passed to all agents
- [ ] **Runner configuration** — max concurrent runners, workspace retention policy (delete after N days), default integration mode (new branch vs PR vs existing branch)
- [ ] **Sync preferences** — default sync interval (manual only for now, but configurable), issue classification rules (label→type mappings)
- [ ] **Appearance** — theme (system/light/dark), PRD section visibility (show/hide Risks, show/hide Tests), inbox default filters
- [ ] **Notifications** — (future hook) webhook URL for runner events, Slack/Discord webhook
- [ ] **Data management** — export data (JSON dump of all PRDs/issues), delete all data, workspace cache size display + clear button
- [ ] **API keys** — manage Anthropic API key, (future) OpenAI key, show masked values, validation status
- [ ] **About / system info** — Mobster version, Next.js version, DB size, uptime, git commit hash

---

### 8. Docker, Bugs & V1.0 Finalization

Everything must work reliably in `docker compose up`.

**Docker:**
- [ ] Fix `read_only: true` conflict with SQLite WAL mode (needs writable `/data`)
- [ ] Multi-stage build verified working (deps → build → production runtime)
- [ ] Non-root user (uid 1001) properly configured and tested
- [ ] Volume mounts tested: SQLite DB persists across container restarts, workspace cache persists
- [ ] Health check endpoint (`GET /api/health`) returns 200 + DB status + GitHub API status
- [ ] GitHub Container Registry publication with version tags
- [ ] `.env.example` with all required vars documented

**Bug fixes:**
- [ ] GitHub API rate limit handling (detect 403/429, show "rate limited until X", don't crash)
- [ ] PAT expiry detection (401 → prompt user to update token)
- [ ] Agent timeout handling (graceful error in build job status, retry button)
- [ ] Empty repo handling (repos with no issues don't break the inbox)
- [ ] Unicode/emoji in issue titles don't break the UI
- [ ] Runner session recovery edge cases (process crash mid-step, orphaned workspaces)

**Pre-V1 checklist:**
- [ ] All pages have loading states
- [ ] All destructive actions have confirmation dialogs
- [ ] Consistent date formatting everywhere
- [ ] CI pipeline green (lint → typecheck → test → build)
- [ ] Core path tests: auth, GitHub client, sync engine, encryption
- [ ] E2E smoke tests: login, sync, generate PRD
- [ ] README with screenshots, setup guide, env var reference
- [ ] License headers on all source files
- [ ] CHANGELOG.md started
- [ ] Git tag `v1.0.0`

---

## 🔮 After 1 Month — Platform Expansion

Once V1.0 is stable and public, expand beyond a single-user, GitHub-only, single-agent tool.

### Multi-Platform Input

- [ ] **Azure DevOps connector** — connect via PAT, sync work items (equivalent to GitHub issues), repos, PRs
- [ ] **GitLab connector** — self-hosted + gitlab.com support, sync issues and merge requests
- [ ] **Linear connector** — sync issues from Linear, create PRDs from Linear tickets
- [ ] **Jira connector** — for teams already on Atlassian
- [ ] **Generic webhook input** — accept issues from any system that can POST JSON (Zendesk, Intercom, etc.)
- [ ] **Connector abstraction layer** — `interface IssueProvider { listIssues(), getIssue(), sync(), ... }` so new platforms are plugins, not rewrites

### Multi-User Setup

- [ ] **User registration & invites** — admin creates accounts, invite-by-email
- [ ] **Role-based access** — Admin, Developer (can generate/integrate), Viewer (read-only)
- [ ] **Per-user PAT** — each user connects their own GitHub token, repos visible based on token scope
- [ ] **Shared workspace** — team sees shared inbox, PRDs, epics. Actions attributed to specific user
- [ ] **Audit log** — who generated which PRD, who triggered which integration, who changed settings

### Multi-Agent & Runner Configurations

- [ ] **OpenAI provider** — GPT-4o, GPT-4.1 as alternative to Claude
- [ ] **Local model support** — Ollama integration for fully air-gapped setups
- [ ] **Per-task agent selection** — use Haiku for issue classification, Sonnet for PRD generation, Opus for complex integrations
- [ ] **Agent pools** — configure N runners with different models/keys, round-robin or priority-based dispatch
- [ ] **Custom agent prompts per repo** — different coding standards for different projects
- [ ] **Agent marketplace** — community-shared agent configurations and PRD templates

### Runner Separation (Independent Repo)

Investigating splitting the agent runner into its own service:

```
┌──────────┐       ┌──────────────┐       ┌──────────┐
│  Mobster  │◄─────►│  Runner Hub  │◄─────►│ GitHub   │
│  (Web UI) │  API  │  (separate)  │  Git  │  Repos   │
└──────────┘       └──────────────┘       └──────────┘
                           │
                    ┌──────┴──────┐
                    │  Runners    │
                    │  (workers)  │
                    └─────────────┘
```

- [ ] **Runner Hub** — standalone service (`mobster-runner`), connects to Mobster Web via API key, polls for jobs
- [ ] **Benefits** — scale runners independently, run on beefier hardware, isolate workspace access from web server
- [ ] **Docker compose sidecar** — `docker compose` spins up both `mobster-web` + `mobster-runner` together
- [ ] **Remote runners** — runner hub on a separate machine, connected over Tailscale/private network
- [ ] **Job queue** — proper queue (SQLite-backed initially, Redis optional) with retry, priority, and scheduling

---

## 📊 Success Milestones

| Milestone | Target Date | What "Done" Looks Like |
|---|---|---|
| V1.0-beta | Week 3 | Docker works, core bugs fixed, settings page usable |
| V1.0 | Week 4 | Epic planning, runner messaging, metrics dashboard all functional |
| Public launch | End of Week 4 | README complete, repo public, posted to communities |
| v1.1 (multi-platform) | Month 2 | At least one non-GitHub connector working |
| v1.2 (multi-user) | Month 3 | Team can share an instance |
| v2.0 (runner separation) | Month 4 | Runner Hub as independent repo, self-hosted alongside Mobster |

---

*This roadmap is a living document. Priorities shift based on user feedback after launch.*
