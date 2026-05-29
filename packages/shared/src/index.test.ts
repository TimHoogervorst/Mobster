import { describe, it, expect } from 'vitest'
import { PRD_STATUSES, BUILD_JOB_STATUSES, ISSUE_STATES, ISSUE_TYPES } from './index'

describe('shared constants', () => {
  it('should have all PRD statuses', () => {
    expect(PRD_STATUSES).toHaveLength(7)
    expect(PRD_STATUSES).toContain('draft')
    expect(PRD_STATUSES).toContain('scheduled')
    expect(PRD_STATUSES).toContain('done')
  })

  it('should have all build job statuses', () => {
    expect(BUILD_JOB_STATUSES).toHaveLength(4)
    expect(BUILD_JOB_STATUSES).toContain('queued')
    expect(BUILD_JOB_STATUSES).toContain('success')
  })

  it('should have all issue states', () => {
    expect(ISSUE_STATES).toHaveLength(2)
    expect(ISSUE_STATES).toContain('open')
    expect(ISSUE_STATES).toContain('closed')
  })

  it('should have all issue types', () => {
    expect(ISSUE_TYPES).toHaveLength(4)
    expect(ISSUE_TYPES).toContain('bug')
    expect(ISSUE_TYPES).toContain('feature')
  })
})
