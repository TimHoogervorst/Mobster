import { describe, it, expect } from 'vitest'

/**
 * Tests for the PrdGenerateButton label and disabled-state logic.
 *
 * These are pure-function tests of the label formatting rules
 * used in the PrdGenerateButton component.
 */

// ─── Label formatting (mirrors component logic) ─────

function getButtonLabel(
  label: string,
  issueIds: string[],
  loading: boolean,
): string {
  if (loading) return 'Generating...'
  if (issueIds.length > 1) return `${label} (${issueIds.length} issues)`
  return label
}

function isButtonDisabled(
  disabled: boolean,
  loading: boolean,
  issueIds: string[],
): boolean {
  return disabled || loading || issueIds.length === 0
}

describe('PrdGenerateButton label logic', () => {
  it('shows default label for single issue', () => {
    expect(getButtonLabel('Generate PRD', ['id-1'], false)).toBe('Generate PRD')
  })

  it('shows "N issues" suffix for multiple issues', () => {
    expect(getButtonLabel('Generate PRD', ['id-1', 'id-2', 'id-3'], false)).toBe(
      'Generate PRD (3 issues)',
    )
  })

  it('shows custom label for single issue', () => {
    expect(getButtonLabel('PRD', ['id-1'], false)).toBe('PRD')
  })

  it('shows custom label with count for multiple issues', () => {
    expect(
      getButtonLabel('Generate Combined PRD', ['id-1', 'id-2'], false),
    ).toBe('Generate Combined PRD (2 issues)')
  })

  it('shows "Generating..." when loading regardless of count', () => {
    expect(getButtonLabel('Generate PRD', ['id-1', 'id-2', 'id-3'], true)).toBe(
      'Generating...',
    )
    expect(getButtonLabel('Generate PRD', ['id-1'], true)).toBe('Generating...')
  })

  it('shows just label for single issue without "(1 issues)"', () => {
    expect(getButtonLabel('Generate PRD', ['id-1'], false)).not.toContain(
      '1 issue',
    )
  })

  it('handles exactly 10 issues (max)', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`)
    expect(getButtonLabel('Generate PRD', ids, false)).toBe(
      'Generate PRD (10 issues)',
    )
  })
})

describe('PrdGenerateButton disabled logic', () => {
  it('is disabled when issueIds is empty', () => {
    expect(isButtonDisabled(false, false, [])).toBe(true)
  })

  it('is disabled when explicitly disabled', () => {
    expect(isButtonDisabled(true, false, ['id-1'])).toBe(true)
  })

  it('is disabled when loading', () => {
    expect(isButtonDisabled(false, true, ['id-1'])).toBe(true)
  })

  it('is not disabled with valid issueIds', () => {
    expect(isButtonDisabled(false, false, ['id-1'])).toBe(false)
  })

  it('is disabled for all combinations when issueIds is empty', () => {
    expect(isButtonDisabled(false, false, [])).toBe(true)
    expect(isButtonDisabled(true, false, [])).toBe(true)
    expect(isButtonDisabled(false, true, [])).toBe(true)
    expect(isButtonDisabled(true, true, [])).toBe(true)
  })
})
