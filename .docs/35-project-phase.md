# Phase 3.5: Projects & Intake Hub

> **Status:** Planning  
> **Target:** Post-Phase 2, pre-V1.0  
> **Depends on:** Phase 1 (GitHub Sync), Phase 2 (PRD + Integration)

---

## The Problem

Right now, Mobster's workflow is linear and flat:

```
GitHub Issues → Inbox → Select Issues → Generate PRD → Review → Integrate → Done
```

This works for individual bug fixes or small features, but it doesn't reflect how real software development happens. Real releases involve:

- **Multiple items**: Several bugs, features, and PRs that belong together in one release
- **Sequencing**: Some things need to happen before others
- **Testing gates**: You don't just fire off 5 integrations at once — you integrate, test, review, then continue
- **Scope changes**: New bugs are discovered during integration and need to be pulled into the current release
- **Pull requests**: PRs from external contributors or other team members need to be part of the plan
- **History**: You need to look back and see what happened during a release, what was tested, and what changed

The current flat model also doesn't distinguish between "stuff I haven't looked at yet" and "stuff I've committed to working on." Everything is just in the Inbox.

---

## The Vision

Transform Mobster from a linear issue-to-PR pipeline into a **project-based release management tool** with two distinct spaces:

### 1. Intake Hub — The Raw Feed

A single page with multiple tabs (Issues, Pull Requests, and future DevOps signals). This is everything that's come in from GitHub — unfiltered, unassigned. Think of it as the "incoming mail" that hasn't been sorted yet.

**Tabs:**

| Tab | Content | Source |
|-----|---------|--------|
| **Issues** | Bugs, features, questions, other | Synced from GitHub issues |
| **Pull Requests** | Open, closed, merged, draft PRs | Synced from GitHub pulls |
| *(future)* CI Runs | Failed/succeeded workflow runs | GitHub Actions status |
| *(future)* Alerts | Rate limits, security notices, etc. | Various |

From the Intake, you **triage items into projects**. An item moves from "random thing in the feed" to "part of a planned release."

### 2. Projects — The Execution Plan

A **Project represents a release or version** (e.g., "v1.0", "Sprint 24", "Q3 Bug Bash"). It's a container that holds a sequenced plan of work, organized into phases with gates between them.

A project answers the questions:
- What are we shipping in this release?
- In what order do things happen?
- Where are the testing/validation checkpoints?
- What's the current status of each piece?
- What changed along the way?

---

## Project Anatomy

### Structure

```
Project: "Release v1.1"
├── Phase 1: Core Bug Fixes (integration)
│   ├── Issue #42: "Fix login crash"           [integrated ✓]
│   ├── Issue #67: "Handle null session"        [integrated ✓]
│   └── Issue #89: "Update error messages"      [in progress]
│       └── PRD generated → Review → Integrate
│
├── [Testing Gate]                              [pending]
│   └── Criteria: "All 3 fixes verified, no regression in auth flow"
│
├── Phase 2: New Features (integration)
│   ├── Feature #101: "Add dark mode toggle"    [pending]
│   ├── Feature #102: "Export to CSV"           [pending]
│   ├── Feature #103: "Keyboard shortcuts"      [pending]
│   ├── PR: "Merge hotfix/v1.0 into v1.1"       [pending]  ← cross-project PR
│   └── Bug: "Icon alignment in dark header"    [pending]  ← created in-project
│
├── [Testing Gate]                              [pending]
│   └── Criteria: "Full E2E pass, performance < 200ms p95"
│
└── Phase 3: Finalization (review)
    ├── PR #55: "Dependency update"             [pending]
    └── PR #56: "README refresh"                [pending]
```

### Phases

A phase is a named group of work items with a defined purpose. There are three phase types:

| Type | Purpose | Items typically contain |
|------|---------|------------------------|
| **Integration** | Generate PRDs, review them, and integrate code | Issues → PRDs → Builds |
| **Testing** | Validate the integrations so far | Test criteria, manual checks |
| **Review** | Final review steps, PR merges, documentation | PRs, final PRD approvals |

Phases are **ordered** and **gated**. A phase cannot start until the previous phase's gate criteria are met.

### Gates

Each phase has optional **gate criteria** — a description (and potentially structured conditions) that must be satisfied before the next phase unlocks.

Example gate criteria for a testing phase:
> "All 3 integrations pass CI on their branches. Manual smoke test of auth flow completed. No new console errors in production build."

When a phase completes (all items integrated/tested), the system checks the gate. If it passes, the next phase activates automatically. If something fails, the phase can be reopened or new items added to address issues.

### Items

Items are the actual work units inside a phase. They come from **two sources**:

#### Source 1: Pulled from Intake

Items synced from connected sources (GitHub today, more later) that were triaged into the project. All items live in the unified `items` table regardless of source:

| Type | Source | How it flows |
|------|--------|--------------|
| **Bug** | GitHub issue (label: bug) | Triage → Generate PRD → Review* → Integrate → Test → Done |
| **Feature** | GitHub issue (label: feature/enhancement) | Same flow as bug |
| **Pull Request** | GitHub PR (synced) | Triage → Review → Track merge/close |
| **Task** | Any source (or manual) | General work item, flexible flow |

*\* Review can be skipped for XS/Small items flagged `requiresReview: false` — see "Item Size & Review Requirements" above.*

#### Source 2: Created directly in the project

Not everything needs to come through Intake first. Each phase has a **"+ Add"** button that lets you create new items directly from within the project:

| Type | What it is | Use case |
|------|-----------|----------|
| **Bug** | A bug discovered during testing or integration | "Found an alignment issue while testing the dark mode integration" |
| **Feature** | A feature scoped directly in the project plan | "We need an error boundary wrapper before this phase ships" |
| **Pull Request** | A targeted PR task, including cross-project merges | "Merge the v1.0 hotfix branch into v1.1 before continuing" |

Items created in-project follow the **exact same lifecycle** as items pulled from Intake — they get PRDs generated, reviewed, and integrated through the same pipeline. The only difference is their origin.

This is especially powerful for **cross-project pull requests**: when Project A (e.g., a hotfix for v1.0) completes and ships before Project B (v1.1), you can go into Project B and create a PR item: "Merge hotfix/v1.0 → main". This becomes a tracked, sequenced item within Project B's phases, flowing through review → integration → testing like everything else. The system preserves the full lineage — you can trace that this PR originated from Project A's work.

Items within a phase have a **sort order** — you control which one fires first, second, third. Each item tracks its own status independently: `pending → in_progress → integrated → tested → passed (or failed, or on_hold)` (or `failed`).

### Item Size & Review Requirements

Every item carries a **size classification** and a **review flag** that together determine how it flows through the project:

| Size | Scope | Default review? | Examples |
|------|-------|-----------------|----------|
| **XS** | Trivial | No | Typo fix, config tweak, one-line change |
| **Small** | Scoped | Optional | Single function fix, dependency bump |
| **Medium** | Multi-file | Yes | New component, API endpoint change |
| **Large** | New module | Yes | New feature, auth system change |
| **XL** | Architecture | Yes | Major refactor, database migration |

- **Auto-detection**: During PRD generation, the AI agent explores the codebase and automatically sets `size` based on the scope of required changes. This can be manually overridden.
- **Skip review for low-risk items**: An XS or Small item flagged `requiresReview: false` can flow straight from PRD generation → integration, skipping the formal review gate. The history still logs every step.
- **Review reason**: A human-readable explanation is always attached (e.g., "Touches payment processing — mandatory review" or "Cosmetic CSS only — review skipped")

This gives users fine-grained control: critical path items get thorough review, while trivial fixes don't create bottlenecks. And because everything is logged, you can always trace what was reviewed and why.

### The Flexible Scope

A key design principle: **project scope can change during execution.** If you're integrating Phase 2 and discover a new bug, you can add it to the current (or a future) phase without restarting the whole project. The history log captures when and why items were added — including whether they came from Intake or were created in-project.

---

## The Execution Flow

### Within a phase

For an integration phase containing multiple issues:

1. **Plan**: Items are ordered. You decide: "Fix login first, then null session, then error messages."
2. **PRD Generation**: For item #1, generate a PRD (same flow as today — agent explores codebase, produces 6-section document).
3. **Review**: Review the PRD. Send feedback, iterate. Approve when ready.
4. **Integrate**: Fire the integration for this one item. Agent writes code, pushes branch, opens PR.
5. **Observe**: Check the result. Did CI pass? Are tests green?
6. **Continue**: If good, move to item #2. Generate its PRD, review, integrate.
7. **Phase complete**: When all items are integrated and verified, the phase gate is checked. If criteria are met, the next phase unlocks.

### Between phases

When a phase completes and the gate passes:
- The completed phase is marked `passed`
- The next `pending` phase is activated
- A history entry is recorded
- You continue with the next batch of work

### When things go wrong

- **Integration fails**: The item is marked `failed`. You can retry (same as today's retry logic) or investigate and add a new bug item to the current phase.
- **Gate fails**: You can add more items to the phase (e.g., fix the bugs you found), reopen it, or create a new phase to handle the fallout.
- **New bug discovered**: Add it directly to the active phase or a future phase. The project adapts.

---

## The Intake → Project Workflow

The overall flow from raw input to completed release:

```
1. GitHub sync runs (automatic or manual)
       │
       ▼
2. Intake Hub populates
   ├── Issues tab: new bugs, features, questions
   └── PRs tab: new, updated, merged PRs
       │
       ▼
3. Triage: review items in Intake, decide what matters
       │
       ▼
4. Assign to Project: select items → "Add to Project" → choose phase
   (Or: create a new project first, then pull items into it)
       │
       ▼
5. Within the Project:
   ├── Order items within phases
   ├── Generate PRDs for issues (one at a time)
   ├── Review & approve PRDs
   ├── Integrate (one at a time, with testing between)
   ├── Handle bugs discovered during integration
   └── Advance through phases via gates
       │
       ▼
6. Project complete → history preserved → start next release
```

---

## Data Model (Conceptual)

### New entities

**Project**
- Name, description, status (draft/active/testing/complete/archived)
- Linked to a GitHub repo
- Timestamps

**Phase**
- Belongs to a project, has a sort order
- Name, description, type (integration/testing/review)
- Status (pending/active/passed/failed)
- Optional gate criteria
- Started/completed timestamps

**Project Item**
- Belongs to a project and a phase
- **Origin**: `sync` (from GitHub), `manual` (created in Intake), or `project` (created in-project)
- **Item reference**: Always points to `items.id` — a single FK, no polymorphism. The item's type, source, size, and status are all on the `items` table itself
- Sort order within the phase
- Status (pending → in_progress → integrated → tested → passed, or failed, or on_hold)
- Optional link to the generated PRD (for issues)
- **Cross-project reference**: optional `sourceProjectId` + `sourceItemId` linking back to another project's completed work (used when merging a hotfix project into an ongoing release project)
- Timestamps

**Event Log** (unified — see [`36-event-logger-api.md`](36-event-logger-api.md))
- Single `event_log` table serves all entity types (projects, PRDs, builds, agent sessions)
- Namespaced event types: `project.created`, `phase.passed`, `item.integrated`, `agent.thinking`, etc.
- Exposed as a REST API for external tools (custom runners, CI pipelines, dashboards)
- Same logger used internally by project gates and integration runners

### Relationships

```
GitHub Repo ──┬── Items (unified — issues, PRs, manual tasks, future sources)
              └── Projects
                    ├── Phases (ordered)
                    │     └── Project Items (ordered)
                    │           └── links to Items.id (single FK, no polymorphism)
                    └── History entries
```

**The `items` table is the canonical work item in Mobster.** Everything — GitHub issues, GitHub PRs, manually created bugs, future GitLab/Jira tickets — becomes an `item` with a common schema. Source-specific details live in a `sourceData` JSON column. This means:

- Adding a new source (GitLab, Azure DevOps, Linear) is just a new `source` enum value and a provider that maps into the normalized schema — no new tables needed
- `project_items` references `items.id` directly via a simple FK — no polymorphic `itemType` + `itemId` to maintain
- Filters, search, and sorting work uniformly across all item types and sources

Existing entities (PRDs, Build Jobs, Agent Logs) remain largely unchanged. Build Jobs gain an optional link back to their Project Item.

---

## User Interface

### Intake Page (`/intake`)

Replaces the current `/inbox`. The existing issue table, filters, and bulk actions are preserved — they just live under a tab now.

```
┌──────────────────────────────────────────────────┐
│  Intake                                          │
│  ┌─────────┬──────────────────┐                 │
│  │ Issues  │ Pull Requests    │  (+ future tabs)│
│  └─────────┴──────────────────┘                 │
│                                                  │
│  [Repo ▼] [Type ▼] [State ▼] [Search...] [Sort] │
│                                                  │
│  ☐  Bug     #42 Login crash        repo   2h ago│
│  ☐  Feature #101 Dark mode         repo   5h ago│
│  ☐  Bug     #67 Null session       repo   1d ago│
│  ...                                             │
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │  3 selected  [Add to Project ▼]  [Gen PRD]  ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

Key changes from current Inbox:
- Tab bar at top to switch between Issues and PRs
- "Add to Project" bulk action (opens a dialog to select target project + phase)
- The existing "Generate PRD" action remains for quick standalone PRDs

### Projects List Page (`/projects`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Projects                                          [+ New Project]  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ ● Active  Release v1.1                                main-repo ││
│  │           2/3 phases complete  ·  Updated 3 hours ago            ││
│  │                                                                  ││
│  │  🏃 2 running   👁 4 need review   ✓ 8 done   ⏸ 1 on hold      ││
│  └──────────────────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ ○ Draft   Bug Bash Sprint                           side-project││
│  │           0/2 phases  ·  Updated 1 day ago                       ││
│  │                                                                  ││
│  │  🏃 —   👁 —   ✓ —   ⏸ —                                       ││
│  └──────────────────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ ✓ Complete  Release v1.0                              main-repo ││
│  │            3/3 phases complete  ·  Completed June 1, 2026        ││
│  │            All items finished!                                    ││
│  └──────────────────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ 📦 Archived  Sprint 23 (old)                           side-repo││
│  │             All items finished!  ·  Archived May 15, 2026        ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

Each project card shows four at-a-glance indicators:

| Indicator | What it counts | Source |
|-----------|---------------|--------|
| 🏃 **Running** | Active build jobs / agent runners in this project | `build_jobs` with `status = 'running'` and `projectItemId` linked to this project |
| 👁 **Needs review** | Items with generated PRDs awaiting approval, or phases with pending gate checks | Project items with `status = 'in_progress'` (PRD ready, not yet integrated) |
| ✓ **Done** | Items completed across all phases | Project items with `status = 'integrated' | 'tested' | 'passed'` |
| ⏸ **On hold** | Items blocked or paused (new status — see below) | Project items with `status = 'on_hold'` |

These indicators let you scan the project list and immediately see which projects need attention — runners are actively working, reviews are piling up, or things are blocked.

For **completed** and **archived** projects, the stat bar is replaced with a simple "All items finished!" message. No queries for runners, reviews, or held items are executed — the project is done, so there's nothing left to count.

### Item Status: `on_hold`

A new item status for when work is intentionally paused:

```
pending ──→ in_progress ──→ integrated ──→ tested ──→ passed
     │           │               │
     │           └──→ on_hold ←──┘
     │
     └──→ failed
```

An item can be put `on_hold` from `pending`, `in_progress`, or `integrated`. Reasons include:
- Waiting for an external dependency (another PR to merge first)
- Blocked by a discovered bug that needs investigation
- Deferred to a later phase
- Waiting for user input (clarification needed from the issue reporter)

Items `on_hold` are excluded from gate checks — a phase can still advance if all non-held items are complete. Held items must be resolved (returned to their previous status or moved to `failed`) before the project can be marked complete.

### Project Detail Page (`/projects/[id]`) — The Core

This is where the actual work happens. It's a single scrollable page showing all phases and their items, with the history timeline at the bottom.

```
┌────────────────────────────────────────────────────────────────┐
│  ← Projects    Release v1.1    [Active]    [Edit] [Complete]   │
│  main-repo · Created June 2, 2026                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ PHASE 1: Core Bug Fixes                        [passed ✓]   ││
│  │ Integration · Completed June 2                                           │
│  │                                                             ││
│  │  #  Item                          Status       Actions      ││
│  │  ───────────────────────────────────────────────────────    ││
│  │  1  Bug #42: Login crash       integrated ✓   [View PRD]   ││
│  │  2  Bug #67: Null session      integrated ✓   [View PRD]   ││
│  │  3  Bug #89: Error messages    integrated ✓   [View PRD]   ││
│  └─────────────────────────────────────────────────────────────┘│
│                         ▼ gate passed                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ PHASE 2: New Features                          [active ●]   ││
│  │ Integration · Started June 3                                  ││
│  │                                                             ││
│  │  #  Item                          Status       Actions      ││
│  │  ───────────────────────────────────────────────────────    ││
│  │  1  Feature #101: Dark mode   in_progress   [View Run]     ││
│  │  2  Feature #102: CSV export  pending       [Gen PRD]      ││
│  │  3  Feature #103: Shortcuts   pending       [Gen PRD]      ││
│  │  4  PR: Merge hotfix/v1.0     pending       [View PR]  ←cp││
│  │  5  Bug: Icon alignment       pending       [Gen PRD]  ←new││
│  │                                      [+ Add ▼]              ││
│  │                                       ├─ Add from Intake    ││
│  │                                       ├─ New Bug            ││
│  │                                       ├─ New Feature        ││
│  │                                       └─ New Pull Request   ││
│  └─────────────────────────────────────────────────────────────┘│
│  └─────────────────────────────────────────────────────────────┘│
│                         ▼ gate pending                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ PHASE 3: Finalization                         [pending ○]   ││
│  │ Review · Criteria: "All PRs merged, README updated"          ││
│  │                                                             ││
│  │  #  Item                          Status       Actions      ││
│  │  ───────────────────────────────────────────────────────    ││
│  │  1  PR #55: Dep update           pending       [View PR]   ││
│  │  2  PR #56: Docs refresh         pending       [View PR]   ││
│  │                                      [+ Add ▼]              ││
│  │                                       ├─ Add from Intake    ││
│  │                                       ├─ New Bug            ││
│  │                                       ├─ New Feature        ││
│  │                                       └─ New Pull Request   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ─── HISTORY ─────────────────────────────────────────────────  │
│  Jun 3, 14:22  Phase 2 started                                  │
│  Jun 3, 14:20  Gate passed: Phase 1 → Phase 2                  │
│  Jun 2, 18:45  Item integrated: Bug #89                         │
│  Jun 2, 17:30  Bug #110 added to Phase 2 (found during testing) │
│  Jun 2, 16:00  Item integrated: Bug #67                         │
│  ...                                                            │
└────────────────────────────────────────────────────────────────┘
```

---

## Navigation Changes

The sidebar evolves from:

```
Current:                          New:
┌──────────────┐                 ┌──────────────┐
│ Dashboard    │                 │ Dashboard    │
│ Repos        │                 │ Repos        │
│ Inbox        │       →        │ Intake       │  ← renamed, multi-tab
│ PRDs         │                 │ Projects     │  ← new, replaces Triage
│ Runners      │                 │ PRDs         │
│ Triage       │                 │ Runners      │
│ Agents       │                 │ Agents       │
│ Settings     │                 │ Settings     │
└──────────────┘                 └──────────────┘
```

- **Inbox → Intake**: Renamed, now has tabs for Issues / Pull Requests
- **Triage → Projects**: The placeholder Triage page becomes the Projects list
- The standalone PRD list remains — for PRDs created outside of projects

---

## What This Enables

With this system, Mobster can handle real-world release scenarios:

**Scenario 1: Planned Release**
> You're shipping v1.1. You create a project, pull in 5 bugs and 2 features from Intake, organize them into 3 phases, and work through them over a week. Each integration is tested before the next one starts. You discover 2 more bugs during testing, add them to Phase 2, and continue. When all gates pass, the release is done. The full history shows exactly what happened and when.

**Scenario 2: Hotfix**
> A critical bug comes in. You create a quick project with a single integration phase, generate the PRD, integrate, test, and ship. The project serves as a record of the hotfix.

**Scenario 3: Multi-PR Coordination**
> Three contributors have open PRs that need to be merged in a specific order (rebases required). You create a review phase, add the PRs in order, and track their status as each gets merged.

**Scenario 4: Cross-Project Merge (Hotfix → Main Release)**
> You're working on v1.1 (big feature release) when a critical bug is reported in production v1.0. You create a quick hotfix project for v1.0, generate the PRD, integrate the fix, and ship it. Now the fix is on the `hotfix/v1.0` branch. But v1.1 is still in progress and doesn't have this fix. You go to the v1.1 project, hit the "+" button in the active phase, choose "New Pull Request," and set it up as: "Merge hotfix/v1.0 → main (carries the login crash fix into v1.1)." This PR item now sits in the v1.1 phase sequence, flows through review, gets integrated, and the hotfix is absorbed. The history in both projects shows the cross-reference.

**Scenario 5: Roadmap Planning**
> Looking ahead, you create draft projects for v1.2, v1.3, and v2.0. Each has a rough scope. As you complete v1.1, you refine and activate v1.2. The roadmap is just your list of projects.

---

## What Stays the Same

- **PRD generation**: Same 6-section template, same agent, same review workflow
- **Integration**: Same branch/PR push, same build job tracking, same retry logic
- **Issue syncing**: Same incremental sync, same label classification
- **Agent configuration**: Same providers, same settings
- **Runners**: Same log viewer, same session tracking
- **Standalone PRDs**: You can still generate PRDs directly from Intake without a project

Projects are **additive** — they don't replace any existing workflow, they give you a higher-level way to organize it.

---

## Implementation Approach

The work breaks down into 5 logical chunks, each delivering standalone value:

| Step | What | Value Delivered |
|------|------|-----------------|
| **1. Unified Items Table** | New `items` table (replaces separate issues/PRs), GitHub client normalization, sync engine update, `/api/items` endpoint | Issues and PRs live in one table — any source can plug in |
| **2. Project Data Model** | New tables (projects, phases, items, event_log), shared types, API routes (CRUD for all entities) | Projects can be created and managed via API |
| **3. Intake Hub** | Rename `/inbox` → `/intake`, unified item table + filters, sidebar update, redirect | Users see the multi-tab intake with Issues + PRs — both from the same `items` table |
| **4. Project Pages** | Project list page, detail page with phase cards, add-item dialog, event timeline | Full project management UI |
| **5. Project Integration** | Integration within project context, phase gate logic, build job → project item linking | End-to-end project execution flow |

Each step can be tested and merged independently. Steps 1 and 2 have no UI dependencies and can be built in parallel.

---

## Future Possibilities

This foundation enables several natural extensions:

- **Project templates**: Define a standard phase structure for bug-fix releases vs. feature releases
- **Release notes**: Auto-generate release notes from the project history
- **Cross-repo projects**: A project that spans multiple repos (more complex, but the unified `items` table with per-repo source data supports it)
- **Project metrics**: Cycle time (item added → integrated), integration success rate, bugs-discovered-during-testing count
- **Scheduled integration**: Set a phase to auto-start integration at a specific time
- **GitHub Projects sync**: Two-way sync with GitHub Projects for teams using both

---

## Open Questions

1. **Should phases be auto-created when a project is made?** Or fully manual? Leaning toward manual for flexibility, with templates later.
2. **Can an item belong to multiple projects?** No — an item is assigned to exactly one project (or none, if still in Intake). Cross-project relationships are handled via references: a PR item in Project B can point back to the completed item in Project A via `sourceProjectId` / `sourceItemId`, but the item itself lives in only one project. This keeps the data model simple while preserving traceability.
3. **What happens to items when a project is archived?** They remain linked but read-only. Unassigned items could return to Intake.
4. **Should the PRD list page show project context?** Yes — PRDs generated within a project should show which project/phase they belong to.
