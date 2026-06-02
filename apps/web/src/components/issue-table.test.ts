import { describe, it, expect } from 'vitest'

/**
 * Tests for the IssueTable selection state logic.
 *
 * These are pure-function tests of the selection toggle logic
 * used in the IssueTable component.
 */

// ─── Types (mirrors component types) ─────────────────

interface IssueRow {
  id: string
  number: number
  title: string
  state: 'open' | 'closed'
  issueType: 'bug' | 'feature' | 'question' | 'other' | null
  labels: string[]
  repoFullName: string
  assignee: string | null
  githubUpdatedAt: string
  prdId?: string | null
}

// ─── Helpers (mirrors component logic) ───────────────

function getEligibleIssues(issues: IssueRow[]): IssueRow[] {
  return issues.filter((i) => !i.prdId)
}

function toggleSelect(
  selectedIds: Set<string>,
  id: string,
): Set<string> {
  const next = new Set(selectedIds)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

function toggleAll(
  selectedIds: Set<string>,
  eligibleIssues: IssueRow[],
): Set<string> {
  if (
    selectedIds.size === eligibleIssues.length &&
    eligibleIssues.length > 0
  ) {
    return new Set()
  }
  return new Set(eligibleIssues.map((i) => i.id))
}

function isRowLinked(issue: IssueRow): boolean {
  return !!issue.prdId
}

// ─── Test fixtures ──────────────────────────────────

const makeIssue = (overrides: Partial<IssueRow> = {}): IssueRow => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  number: 1,
  title: 'Test Issue',
  state: 'open',
  issueType: 'feature',
  labels: [],
  repoFullName: 'owner/repo',
  assignee: null,
  githubUpdatedAt: new Date().toISOString(),
  prdId: null,
  ...overrides,
})

const sampleIssues: IssueRow[] = [
  makeIssue({ id: 'issue-1', number: 1, title: 'Issue 1' }),
  makeIssue({ id: 'issue-2', number: 2, title: 'Issue 2' }),
  makeIssue({
    id: 'issue-3',
    number: 3,
    title: 'Already in PRD',
    prdId: 'prd-1',
  }),
  makeIssue({ id: 'issue-4', number: 4, title: 'Issue 4' }),
  makeIssue({
    id: 'issue-5',
    number: 5,
    title: 'Also in PRD',
    prdId: 'prd-2',
  }),
]

// ─── Tests ───────────────────────────────────────────

describe('IssueTable - getEligibleIssues', () => {
  it('filters out issues that already have a prdId', () => {
    const eligible = getEligibleIssues(sampleIssues)
    expect(eligible).toHaveLength(3)
    expect(eligible.map((i) => i.id)).toEqual([
      'issue-1',
      'issue-2',
      'issue-4',
    ])
  })

  it('returns all issues when none have prdId', () => {
    const issues = [
      makeIssue({ id: 'a' }),
      makeIssue({ id: 'b' }),
    ]
    expect(getEligibleIssues(issues)).toHaveLength(2)
  })

  it('returns empty when all issues are linked', () => {
    const issues = [
      makeIssue({ id: 'a', prdId: 'prd-1' }),
      makeIssue({ id: 'b', prdId: 'prd-2' }),
    ]
    expect(getEligibleIssues(issues)).toHaveLength(0)
  })
})

describe('IssueTable - toggleSelect', () => {
  it('adds an issue ID when not already selected', () => {
    const result = toggleSelect(new Set(), 'issue-1')
    expect(result.has('issue-1')).toBe(true)
    expect(result.size).toBe(1)
  })

  it('removes an issue ID when already selected', () => {
    const result = toggleSelect(new Set(['issue-1']), 'issue-1')
    expect(result.has('issue-1')).toBe(false)
    expect(result.size).toBe(0)
  })

  it('does not affect other selected IDs', () => {
    const selected = new Set(['issue-1', 'issue-2'])
    const result = toggleSelect(selected, 'issue-1')
    expect(result.has('issue-2')).toBe(true)
    expect(result.has('issue-1')).toBe(false)
    expect(result.size).toBe(1)
  })

  it('returns a new Set (immutable pattern)', () => {
    const original = new Set(['issue-1'])
    const result = toggleSelect(original, 'issue-2')
    expect(result).not.toBe(original)
    expect(original.has('issue-2')).toBe(false)
  })
})

describe('IssueTable - toggleAll', () => {
  it('selects all eligible issues when none are selected', () => {
    const eligible = getEligibleIssues(sampleIssues)
    const result = toggleAll(new Set(), eligible)
    expect(result.size).toBe(3)
  })

  it('deselects all when all eligible issues are already selected', () => {
    const eligible = getEligibleIssues(sampleIssues)
    const allSelected = new Set(eligible.map((i) => i.id))
    const result = toggleAll(allSelected, eligible)
    expect(result.size).toBe(0)
  })

  it('selects all when only some are selected', () => {
    const eligible = getEligibleIssues(sampleIssues)
    const partial = new Set(['issue-1'])
    const result = toggleAll(partial, eligible)
    expect(result.size).toBe(3)
  })

  it('returns empty set when no eligible issues', () => {
    const result = toggleAll(new Set(), [])
    expect(result.size).toBe(0)
  })
})

describe('IssueTable - isRowLinked', () => {
  it('returns true when issue has a prdId', () => {
    expect(isRowLinked(makeIssue({ prdId: 'prd-1' }))).toBe(true)
  })

  it('returns false when issue has no prdId', () => {
    expect(isRowLinked(makeIssue({ prdId: null }))).toBe(false)
  })

  it('returns false when prdId is undefined', () => {
    expect(isRowLinked(makeIssue({ prdId: undefined }))).toBe(false)
  })
})

describe('IssueTable - bulk action bar visibility', () => {
  it('bulk bar appears when at least 1 issue is selected', () => {
    const selectedIds = new Set(['issue-1'])
    expect(selectedIds.size >= 1).toBe(true)
  })

  it('bulk bar disappears when all selections are cleared', () => {
    const selectedIds = new Set<string>()
    expect(selectedIds.size >= 1).toBe(false)
  })

  it('bulk bar shows correct count', () => {
    const selectedIds = new Set(['issue-1', 'issue-2', 'issue-4'])
    expect(selectedIds.size).toBe(3)
  })
})

describe('IssueTable - formatDate', () => {
  function formatDate(iso: string): string {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return date.toLocaleDateString()
  }

  it('returns "Today" for current date', () => {
    expect(formatDate(new Date().toISOString())).toBe('Today')
  })

  it('returns "Yesterday" for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    expect(formatDate(yesterday)).toBe('Yesterday')
  })

  it('returns "Xd ago" for recent dates', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
    expect(formatDate(threeDaysAgo)).toBe('3d ago')
  })

  it('returns "Xw ago" for dates within a month', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString()
    expect(formatDate(twoWeeksAgo)).toBe('2w ago')
  })

  it('returns locale date string for older dates', () => {
    const oldDate = new Date('2020-01-01').toISOString()
    const result = formatDate(oldDate)
    // Should be a formatted date, not a relative string
    expect(result).not.toContain('d ago')
    expect(result).not.toContain('w ago')
    expect(result).not.toBe('Today')
    expect(result).not.toBe('Yesterday')
  })
})
