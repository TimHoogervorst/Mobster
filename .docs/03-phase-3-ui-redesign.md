# 03 — Phase 3: UI Redesign & Branding

**Status:** Planned  
**Last Updated:** 2026-06-03

---

## Goal

Redesign the Mobster UI to be more visually consistent across all pages and introduce branding elements that give Mobster a unique identity rather than looking like a generic shadcn/ui app.

---

## 1. Branding

### 1.1 Visual Identity
- **Logo**: Design a Mobster logo (detective/magnifying glass motif referencing the 🕵️ emoji)
- **Color palette**: Move beyond default shadcn/tailwind colors to a distinctive palette
- **Typography**: Consider a distinctive heading font
- **Favicon & PWA assets**: Proper favicon, app icons

### 1.2 Brand Voice
- Consistent tone across all copy (settings labels, empty states, error messages)
- Onboarding flow with personality

---

## 2. UI Consistency

### 2.1 Current Issues
- Inconsistent spacing and padding across pages
- Mixed card styles (some pages use shadcn cards, others use raw divs)
- Empty states differ in style across pages
- Status badges use inline color values rather than a unified system
- Page headers vary in layout (some have back links, some don't)

### 2.2 Goals
- Unified page header component (title, description, actions)
- Consistent card/list/table patterns
- Standardized empty state, loading state, and error state components
- Unified status badge system used across PRDs, build jobs, issues
- Consistent use of shadcn/ui components (Button, Card, Dialog, etc.)

### 2.3 Pages to Redesign
| Page | Current State | Target |
|------|--------------|--------|
| `/` Dashboard | Stats cards, feature cards | More dynamic, show recent activity |
| `/inbox` | Issue table with filters | Cleaner filter bar, bulk actions |
| `/issues/[id]` | Issue detail + annotations | Improved layout, markdown rendering |
| `/prds` | PRD list table | Card-based or richer list |
| `/prds/[id]` | PRD viewer + comments + integration | Better section organization |
| `/runners` | Session table | Timeline view option |
| `/runners/[sessionId]` | Event log viewer | Improved event rendering |
| `/agents` | Agent config list | Better CRUD UX |
| `/repos` | Repo grid | Improved connection flow |
| `/settings` | Settings sections | More organized layout |
| `/api-docs` | Swagger UI | Already standalone, minor theme tweaks |

---

## 3. Component Standardization

### 3.1 New Shared Components
- `PageHeader` — consistent title + description + actions bar
- `StatusBadge` — unified status indicator (replace ad-hoc inline badges)
- `LoadingSkeleton` — consistent loading states
- `ErrorBanner` — unified error display
- `ConfirmDialog` — reuse across delete operations

### 3.2 Refactoring
- Replace raw `<button>` elements with shadcn `<Button>` variants
- Replace raw `<input>` elements with shadcn `<Input>` components
- Standardize dialog/modal usage (currently mixed between custom and shadcn)

---

## 4. Responsive & Mobile

- Test and fix all pages at mobile widths
- Ensure sidebar works well on small screens
- Touch-friendly tap targets
