import { z } from 'zod'

export { encrypt, decrypt } from './encryption'

// ─── Status Enums ────────────────────────────────────

export const PRD_STATUSES = [
  'draft',
  'reviewed',
  'approved',
  'scheduled',
  'building',
  'done',
  'failed',
] as const
export type PrdStatus = (typeof PRD_STATUSES)[number]

export const BUILD_JOB_STATUSES = ['queued', 'running', 'success', 'failed'] as const
export type BuildJobStatus = (typeof BUILD_JOB_STATUSES)[number]

export const ISSUE_STATES = ['open', 'closed'] as const
export type IssueState = (typeof ISSUE_STATES)[number]

export const ISSUE_TYPES = ['bug', 'feature', 'question', 'other'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

// ─── API Schemas ─────────────────────────────────────

export const PrdGenerateInput = z.object({
  issueId: z.string().uuid(),
})

export const PrdUpdateInput = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  status: z.enum(PRD_STATUSES).optional(),
})

export const PrdScheduleInput = z.object({
  prdId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(), // If omitted, schedule for next 2am
})

export const PrdCombineInput = z.object({
  prdIds: z.array(z.string().uuid()).min(2).max(10),
  title: z.string().min(1).max(500),
})

export const IssueUpdateInput = z.object({
  userNotes: z.string().max(10000).optional(),
  userTags: z.array(z.string().max(50)).max(10).optional(),
  issueType: z.enum(ISSUE_TYPES).optional(),
})

export const RepoSelectInput = z.object({
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
})

// ─── Type Exports ────────────────────────────────────

export type PrdGenerateInput = z.infer<typeof PrdGenerateInput>
export type PrdUpdateInput = z.infer<typeof PrdUpdateInput>
export type PrdScheduleInput = z.infer<typeof PrdScheduleInput>
export type PrdCombineInput = z.infer<typeof PrdCombineInput>
export type IssueUpdateInput = z.infer<typeof IssueUpdateInput>
export type RepoSelectInput = z.infer<typeof RepoSelectInput>
