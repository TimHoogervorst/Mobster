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
  'generating',
] as const
export type PrdStatus = (typeof PRD_STATUSES)[number]

export const BUILD_JOB_STATUSES = ['queued', 'running', 'success', 'failed'] as const
export type BuildJobStatus = (typeof BUILD_JOB_STATUSES)[number]

export const ISSUE_STATES = ['open', 'closed'] as const
export type IssueState = (typeof ISSUE_STATES)[number]

export const ISSUE_TYPES = ['bug', 'feature', 'question', 'other'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

export const AGENT_PROVIDERS = ['claude-code', 'anthropic-sdk'] as const
export type AgentProvider = (typeof AGENT_PROVIDERS)[number]

// ─── API Schemas ─────────────────────────────────────

export const PrdGenerateInput = z.object({
  issueIds: z.array(z.string().uuid()).min(1).max(10),
})

export const PrdUpdateInput = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  status: z.enum(PRD_STATUSES).optional(),
})

export const PrdScheduleInput = z.object({
  prdId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
})

export const PrdCombineInput = z.object({
  prdIds: z.array(z.string().uuid()).min(2).max(10),
  title: z.string().min(1).max(500),
})

export const PrdCommentInput = z.object({
  content: z.string().min(1).max(10000),
})

export const PrdStatusInput = z.object({
  status: z.enum(PRD_STATUSES),
  comment: z.string().max(10000).optional(),
})

export const IntegrateInput = z.object({
  targetType: z.enum(['new-branch', 'existing-branch', 'pull-request']),
  branchName: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9._/-]+$/)
    .optional(),
  cleanWorkspace: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional(),
  force: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional(),
})

export const AgentCreateInput = z.object({
  name: z.string().min(1).max(200),
  providerType: z.enum(AGENT_PROVIDERS),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional().or(z.literal('')),
  modelOpus: z.string().min(1),
  modelSonnet: z.string().min(1),
  modelHaiku: z.string().min(1),
  extraEnvVars: z.record(z.string(), z.string()).optional(),
  systemPromptTemplate: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const AgentUpdateInput = z.object({
  name: z.string().min(1).max(200).optional(),
  providerType: z.enum(AGENT_PROVIDERS).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional().or(z.literal('')).optional(),
  modelOpus: z.string().min(1).optional(),
  modelSonnet: z.string().min(1).optional(),
  modelHaiku: z.string().min(1).optional(),
  extraEnvVars: z.record(z.string(), z.string()).optional(),
  systemPromptTemplate: z.string().optional(),
  isActive: z.boolean().optional(),
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

export const AddRepoByUrlInput = z.object({
  url: z
    .string()
    .min(1, 'URL is required')
    .transform((val, ctx) => {
      let cleaned = val.trim()

      // Remove protocol prefix
      cleaned = cleaned.replace(/^https?:\/\//, '')

      // Remove github.com/ prefix
      cleaned = cleaned.replace(/^github\.com\//, '')

      // Remove trailing .git
      cleaned = cleaned.replace(/\.git$/, '')

      // Remove trailing slash
      cleaned = cleaned.replace(/\/$/, '')

      // Remove trailing tree/main, tree/master, etc.
      cleaned = cleaned.replace(/\/tree\/[^/]+$/, '')

      const parts = cleaned.split('/')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Invalid GitHub URL. Expected format: https://github.com/owner/repo',
        })
        return z.NEVER
      }

      return {
        owner: parts[0],
        name: parts[1],
        fullName: `${parts[0]}/${parts[1]}`,
      }
    }),
})

// ─── Type Exports ────────────────────────────────────

export type PrdGenerateInput = z.infer<typeof PrdGenerateInput>
export type PrdUpdateInput = z.infer<typeof PrdUpdateInput>
export type PrdScheduleInput = z.infer<typeof PrdScheduleInput>
export type PrdCombineInput = z.infer<typeof PrdCombineInput>
export type PrdCommentInput = z.infer<typeof PrdCommentInput>
export type PrdStatusInput = z.infer<typeof PrdStatusInput>
export type IntegrateInput = z.infer<typeof IntegrateInput>
export type AgentCreateInput = z.infer<typeof AgentCreateInput>
export type AgentUpdateInput = z.infer<typeof AgentUpdateInput>
export type IssueUpdateInput = z.infer<typeof IssueUpdateInput>
export type RepoSelectInput = z.infer<typeof RepoSelectInput>
export type AddRepoByUrlInput = z.infer<typeof AddRepoByUrlInput>
