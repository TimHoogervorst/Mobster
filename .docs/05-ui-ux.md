# 05 — UI/UX Design

**Phase:** 1 (GitHub Sync Engine)  
**Status:** In Progress  
**Date:** 2026-05-29

---

## 1. Screen Inventory

### 1.1 Login (`/login`)
Already built in Phase 0. Shows "Sign in with GitHub" card.

**States:**
- Default: sign-in card
- Loading: button shows spinner during OAuth redirect

### 1.2 Dashboard (`/`)
Landing page after login.

**States:**
- **Connected:** Shows stats cards (connected repos, issues synced, last sync time), quick links
- **Not connected:** Shows "Connect GitHub" prompt card prominently

### 1.3 Settings (`/settings`) — NEW
GitHub connection management and repo configuration.

**Sections:**
1. **GitHub Connection** — avatar, username, "Connected ✅" or "Connect" button
2. **Repository List** — connected repos with "Sync Now" button per repo, "Add Repo" button
3. **Repo Selector** (modal/sheet) — searchable list of GitHub repos to connect

**States:**
- Connected with repos → full UI
- Connected, no repos → "Add a repository to get started"
- Not connected → "Connect GitHub" CTA

### 1.4 Inbox (`/inbox`) — NEW
Filterable table of all synced issues.

**Layout:**
```
┌──────────────────────────────────────────────┐
│ Filter Bar                                    │
│ [Repo ▾] [Type ▾] [State ▾] [Label ▾] [🔍]  │
├──────────────────────────────────────────────┤
│ Bulk actions: [Close] [Label] [Type]          │
├────┬─────────────────────────────────────────┤
│ ☐  │ 🐛 Fix login bug        owner/repo ...  │
│ ☐  │ ✨ Add dark mode        owner/repo ...  │
│ ☐  │ ❓ How to configure?    owner/repo ...  │
├────┴─────────────────────────────────────────┤
│ Page 1 of 3    ← →                           │
└──────────────────────────────────────────────┘
```

**States:**
- Issues loaded → table with data
- No issues → "No issues synced yet. Go to Settings to sync a repo."
- Loading → skeleton rows
- Error → "Failed to load issues. Retry."

### 1.5 Issue Detail (`/issues/[id]`) — NEW
Full view of a single issue.

**Layout:**
```
┌──────────────────────────────────────────────┐
│ ← Back to Inbox                               │
│                                               │
│ #42 Fix login bug               🟢 Open       │
│ owner/repo · opened by @user · May 20         │
│                                               │
│ [bug] [p1] [frontend]                         │
│                                               │
│ ─── Issue Body (Markdown) ───                 │
│ When clicking the login button on mobile...   │
│                                               │
│ ─── Annotations ───                           │
│ Type: [bug ▾]                                 │
│ Tags: [quick-win ✕] [security ✕] [+ Add]     │
│ Notes:                                        │
│ ┌────────────────────────────────────────┐    │
│ │ Need to check the auth middleware flow │    │
│ └────────────────────────────────────────┘    │
│                                               │
│ View on GitHub ↗                              │
└──────────────────────────────────────────────┘
```

**States:**
- Loaded → full detail view
- Loading → skeleton
- Not found → 404 message
- Save in progress → subtle loading indicator on notes/tags

---

## 2. Component Specifications

### 2.1 `github-connection-status`

Server component. Reads session, shows connection state.

```
Props: none (reads from auth())
States:
  - Connected: shows avatar, "@username", green badge "Connected", [Disconnect]
  - Not connected: shows "No GitHub account connected", [Connect GitHub Account]
```

### 2.2 `repo-selector`

Client component. Modal with searchable list.

```
Props:
  - repos: Array<{ id, fullName, description, language, stars, connected }>
  - onSave: (selectedRepos) => Promise<void>

States:
  - Loading: skeleton list
  - Loaded: searchable checkbox list
  - Saving: button shows spinner
  - Error: inline error message + retry
```

### 2.3 `repo-sync-button`

Client component. Button that triggers sync.

```
Props:
  - repoId: string
  - repoName: string

States:
  - Idle: "Sync Now" button
  - Syncing: spinner + "Syncing..."
  - Done: "Synced 2m ago" (checks last synced time)
  - Error: "Sync failed" + retry
```

### 2.4 `issue-table`

Client component. Sortable, selectable table.

```
Props:
  - issues: Issue[]
  - total: number
  - onFilterChange: (filters) => void
  - onSort: (field, order) => void

States:
  - Loaded: table with data
  - Empty: "No issues found"
  - Loading: skeleton rows
```

### 2.5 `issue-filters`

Client component. Filter bar above the table.

```
Filters:
  - Repo: dropdown (populated from connected repos)
  - Type: button group (All, Bug, Feature, Question, Other)
  - State: toggle (Open, Closed)
  - Label: text input with autocomplete
  - Search: text input (searches title + body)
  - Sort: dropdown (Newest, Oldest, Title A-Z)
```

### 2.6 `issue-detail`

Client component. Issue body + annotations editor.

```
Props:
  - issue: Issue (the full object)
  - onUpdate: (updates) => Promise<void>

Annotation auto-save:
  - Notes: textarea, debounced save on blur (500ms)
  - Tags: tag input, save on add/remove
  - Type: dropdown, save on change
```

### 2.7 `user-avatar`

Client component. Avatar with dropdown menu.

```
Props:
  - user: { name, email, image }
  - onSignOut: () => void

Dropdown items:
  - Signed in as @username
  - ───
  - Settings
  - Sign Out
```

### 2.8 `empty-state`

Reusable empty state component.

```
Props:
  - icon: string (emoji)
  - title: string
  - description: string
  - action?: { label: string, href?: string, onClick?: () => void }
```

---

## 3. Design Tokens (Tailwind / shadcn-ui)

Using shadcn/ui design tokens defined in `globals.css`:

- **Background:** `bg-background` (white / gray-950)
- **Cards:** `bg-card` with `border` and `rounded-lg`
- **Primary actions:** `bg-primary text-primary-foreground`
- **Secondary actions:** `bg-secondary text-secondary-foreground`
- **Muted text:** `text-muted-foreground`
- **Destructive:** `text-destructive` (disconnect, remove)

### Issue Type Icons

| Type | Icon | Color |
|------|------|-------|
| Bug | 🐛 | red-500 |
| Feature | ✨ | blue-500 |
| Question | ❓ | yellow-500 |
| Other | 📋 | gray-500 |

### Status Badges

| Status | Style |
|--------|-------|
| Open | Green dot + "Open" |
| Closed | Purple dot + "Closed" |

---

## 4. Responsive Behavior

- **Desktop (>1024px):** Full table, side-by-side filters
- **Tablet (768-1024px):** Table with horizontal scroll, stacked filters
- **Mobile (<768px):** Card list instead of table, bottom sheet filters

Phase 1 focuses on desktop — mobile responsiveness is Phase 4 polish.
