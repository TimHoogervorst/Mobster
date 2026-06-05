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

// ─── Phase 3.5: Items & Projects ─────────────────────

export const ITEM_SOURCES = ['github', 'manual'] as const
export type ItemSource = (typeof ITEM_SOURCES)[number]

export const ITEM_ORIGINS = ['sync', 'manual', 'project'] as const
export type ItemOrigin = (typeof ITEM_ORIGINS)[number]

export const ITEM_SIZES = ['xs', 'small', 'medium', 'large', 'xl'] as const
export type ItemSize = (typeof ITEM_SIZES)[number]

export const ITEM_STATUSES = ['open', 'closed', 'merged', 'draft'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

export const ITEM_TYPES = ['bug', 'feature', 'pull_request', 'task', 'question', 'other'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export const PROJECT_STATUSES = ['draft', 'active', 'testing', 'complete', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PHASE_TYPES = ['integration', 'testing', 'review'] as const
export type PhaseType = (typeof PHASE_TYPES)[number]

export const PHASE_STATUSES = ['pending', 'active', 'passed', 'failed'] as const
export type PhaseStatus = (typeof PHASE_STATUSES)[number]

export const PROJECT_ITEM_STATUSES = ['pending', 'in_progress', 'integrated', 'tested', 'passed', 'failed', 'on_hold'] as const
export type ProjectItemStatus = (typeof PROJECT_ITEM_STATUSES)[number]

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

// ─── Phase 3.5: Items & Projects Schemas ──────────────

export const ItemUpdateInput = z.object({
  userNotes: z.string().max(10000).optional(),
  userTags: z.array(z.string().max(50)).max(10).optional(),
  itemType: z.enum(ITEM_TYPES).optional(),
  size: z.enum(ITEM_SIZES).optional(),
  requiresReview: z.boolean().optional(),
  reviewReason: z.string().max(500).optional(),
})

export const ItemCreateInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  itemType: z.enum(['bug', 'feature', 'pull_request', 'task']),
  repoId: z.string().uuid(),
  size: z.enum(ITEM_SIZES).optional(),
  requiresReview: z.boolean().optional(),
  reviewReason: z.string().max(500).optional(),
})

export const ProjectCreateInput = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  repoId: z.string().uuid(),
})

export const ProjectUpdateInput = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
})

export const ProjectAddItemsInput = z.object({
  items: z.array(z.object({
    itemId: z.string().uuid(),
    phaseId: z.string().uuid(),
    sortOrder: z.number().int().min(0).optional(),
  })).min(1).max(50),
})

export const ProjectCreateItemInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  itemType: z.enum(['bug', 'feature', 'pull_request', 'task']),
  phaseId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
  sourceProjectId: z.string().uuid().optional(),
  sourceBranch: z.string().optional(),
  targetBranch: z.string().optional(),
})

export const ProjectPhaseCreateInput = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  phaseType: z.enum(PHASE_TYPES),
  gateCriteria: z.string().optional(),
})

export const ProjectPhaseUpdateInput = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(PHASE_STATUSES).optional(),
  gateCriteria: z.string().optional(),
})

export const ProjectItemUpdateInput = z.object({
  status: z.enum(PROJECT_ITEM_STATUSES).optional(),
  sortOrder: z.number().int().min(0).optional(),
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
export type ItemUpdateInput = z.infer<typeof ItemUpdateInput>
export type ItemCreateInput = z.infer<typeof ItemCreateInput>
export type ProjectCreateInput = z.infer<typeof ProjectCreateInput>
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateInput>
export type ProjectAddItemsInput = z.infer<typeof ProjectAddItemsInput>
export type ProjectCreateItemInput = z.infer<typeof ProjectCreateItemInput>
export type ProjectPhaseCreateInput = z.infer<typeof ProjectPhaseCreateInput>
export type ProjectPhaseUpdateInput = z.infer<typeof ProjectPhaseUpdateInput>
export type ProjectItemUpdateInput = z.infer<typeof ProjectItemUpdateInput>
