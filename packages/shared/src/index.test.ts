import { describe, it, expect } from 'vitest'
import {
  PRD_STATUSES,
  BUILD_JOB_STATUSES,
  ISSUE_STATES,
  ISSUE_TYPES,
  AGENT_PROVIDERS,
  AgentCreateInput,
  AgentUpdateInput,
  PrdGenerateInput,
  PrdCommentInput,
  PrdStatusInput,
  PrdCombineInput,
} from './index'

describe('shared constants', () => {
  it('should have all PRD statuses', () => {
    expect(PRD_STATUSES).toHaveLength(8)
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

  it('should have all agent providers', () => {
    expect(AGENT_PROVIDERS).toHaveLength(2)
    expect(AGENT_PROVIDERS).toContain('claude-code')
    expect(AGENT_PROVIDERS).toContain('anthropic-sdk')
  })
})

describe('AgentCreateInput', () => {
  it('should accept valid agent config', () => {
    const result = AgentCreateInput.safeParse({
      name: 'My Agent',
      providerType: 'anthropic-sdk',
      apiKey: 'sk-ant-123',
      modelOpus: 'claude-opus-4',
      modelSonnet: 'claude-sonnet-4',
      modelHaiku: 'claude-haiku-4',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid provider type', () => {
    const result = AgentCreateInput.safeParse({
      name: 'Bad',
      providerType: 'openai',
      apiKey: 'sk-123',
      modelOpus: 'm1',
      modelSonnet: 'm2',
      modelHaiku: 'm3',
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty model names', () => {
    const result = AgentCreateInput.safeParse({
      name: 'Bad',
      providerType: 'anthropic-sdk',
      apiKey: 'sk-123',
      modelOpus: '',
      modelSonnet: 'm2',
      modelHaiku: 'm3',
    })
    expect(result.success).toBe(false)
  })

  it('should accept optional fields', () => {
    const result = AgentCreateInput.safeParse({
      name: 'Full Config',
      providerType: 'claude-code',
      apiKey: 'sk-123',
      baseUrl: 'https://api.deepseek.com/anthropic',
      modelOpus: 'deepseek-v4-pro',
      modelSonnet: 'deepseek-v4-pro',
      modelHaiku: 'deepseek-v4-flash',
      extraEnvVars: { CLAUDE_CODE_EFFORT_LEVEL: 'max' },
      systemPromptTemplate: 'You are a helpful assistant.',
      isActive: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('AgentUpdateInput', () => {
  it('should allow partial updates', () => {
    const result = AgentUpdateInput.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('should allow empty object', () => {
    const result = AgentUpdateInput.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('PrdGenerateInput', () => {
  it('should accept single issue ID array', () => {
    const result = PrdGenerateInput.safeParse({
      issueIds: ['550e8400-e29b-41d4-a716-446655440000'],
    })
    expect(result.success).toBe(true)
  })

  it('should accept multiple issue IDs', () => {
    const result = PrdGenerateInput.safeParse({
      issueIds: [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ],
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty array', () => {
    const result = PrdGenerateInput.safeParse({ issueIds: [] })
    expect(result.success).toBe(false)
  })

  it('should reject more than 10 issues', () => {
    const result = PrdGenerateInput.safeParse({
      issueIds: Array.from({ length: 11 }, () =>
        '550e8400-e29b-41d4-a716-446655440000',
      ),
    })
    expect(result.success).toBe(false)
  })
})

describe('PrdCommentInput', () => {
  it('should accept valid comment', () => {
    const result = PrdCommentInput.safeParse({ content: 'Looks good!' })
    expect(result.success).toBe(true)
  })

  it('should reject empty content', () => {
    const result = PrdCommentInput.safeParse({ content: '' })
    expect(result.success).toBe(false)
  })
})

describe('PrdStatusInput', () => {
  it('should accept valid status', () => {
    const result = PrdStatusInput.safeParse({ status: 'approved' })
    expect(result.success).toBe(true)
  })

  it('should accept status with optional comment', () => {
    const result = PrdStatusInput.safeParse({
      status: 'draft',
      comment: 'Please revise the risks section.',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid status', () => {
    const result = PrdStatusInput.safeParse({ status: 'deleted' })
    expect(result.success).toBe(false)
  })
})

describe('PrdCombineInput', () => {
  it('should accept valid combine input', () => {
    const result = PrdCombineInput.safeParse({
      prdIds: [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ],
      title: 'Combined PRD',
    })
    expect(result.success).toBe(true)
  })

  it('should reject single PRD ID', () => {
    const result = PrdCombineInput.safeParse({
      prdIds: ['550e8400-e29b-41d4-a716-446655440000'],
      title: 'Combined PRD',
    })
    expect(result.success).toBe(false)
  })
})
