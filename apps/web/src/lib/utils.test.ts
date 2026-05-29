import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra')
  })

  it('should merge tailwind conflicts', () => {
    expect(cn('px-4 py-2', 'px-6')).toBe('py-2 px-6')
  })
})
