# 05 — UI/UX Design

**Phase:** 1 (GitHub Sync Engine) — **Complete**  
**Last Updated:** 2026-05-29

---

## 1. Screens

### 1.1 Login (`/login`)
PAT entry form. Single text field, "Connect GitHub Account" button, instructions for generating a token at `github.com/settings/tokens`.

**States:**
- Empty: form with token input
- Validating: spinner on button
- Success: checkmark + "Connected as @username" + redirect
- Error: inline error message
- Already connected: shows avatar + username + disconnect option

### 1.2 Dashboard (`/`)
Landing page with context-aware content.

**States:**
- **No PAT:** "Enter your GitHub Personal Access Token to get started" + CTA to `/login`
- **Connected, no repos:** "No repositories connected" + CTA to Settings
- **Connected, repos synced:** Stats cards (repos, issues, last sync) + feature cards

### 1.3 Settings (`/settings`)
GitHub connection status + repo management.

**Sections:**
1. Connection status (avatar, username, "Connected" badge, reconnect link)
2. Connected repos list with "Sync Now" button per repo
3. "Add Repositories" — searchable checkbox list

### 1.4 Inbox (`/inbox`)
Filterable table of synced issues.

**Filters:** repo dropdown, type tabs (All/Bug/Feature/Question/Other), state toggle (Open/Closed), search input, sort dropdown.

**Table columns:** type icon, issue title (#number), repo, labels, assignee, updated date.

**States:** issues loaded, no issues, no repos synced, not connected.

### 1.5 Issue Detail (`/issues/[id]`)
Full issue view with header (title, state, labels, assignee), body (rendered markdown), local annotations (type dropdown, tag input, notes textarea). "View on GitHub" external link.

---

## 2. Components

| Component | Type | Purpose |
|-----------|------|---------|
| `github-connection-status` | Server | Connected/disconnected state with CTA |
| `repo-selector` | Client | Searchable checkbox list of repos |
| `repo-sync-button` | Client | "Sync Now" with loading/success/error states |
| `issue-table` | Client | Sortable table with type icons |
| `issue-filters` | Client | Filter bar (repo, type, state, search, sort) |
| `issue-detail` | Client | Body + annotations editor |
| `user-avatar` | Client | Avatar with sign-out dropdown |
| `empty-state` | Client | Reusable empty state with CTA |
| `pat-form` | Client | PAT input form with validation |

---

## 3. Design Tokens

shadcn/ui design tokens in `globals.css`. Dark mode via `next-themes`.

**Issue type icons:** 🐛 Bug, ✨ Feature, ❓ Question, 📋 Other
