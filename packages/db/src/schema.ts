import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ─── App Settings ─────────────────────────────────────

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ─── User ────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  githubId: text('github_id').notNull().unique(),
  githubToken: text('github_token').notNull(), // Encrypted PAT
  name: text('name'),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ─── GitHub Repos ────────────────────────────────────

export const githubRepos = sqliteTable('github_repos', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull().unique(),
  defaultBranch: text('default_branch').notNull().default('main'),
  description: text('description'),
  language: text('language'),
  stars: integer('stars').default(0),
  syncedAt: text('synced_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ─── Issues ──────────────────────────────────────────

export const issues = sqliteTable('issues', {
  id: text('id').primaryKey(),
  repoId: text('repo_id')
    .notNull()
    .references(() => githubRepos.id, { onDelete: 'cascade' }),
  githubId: integer('github_id').notNull(),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  state: text('state').notNull().$type<'open' | 'closed'>(),
  issueType: text('issue_type').$type<'bug' | 'feature' | 'question' | 'other'>(),
  labels: text('labels'),
  assignee: text('assignee'),
  milestone: text('milestone'),
  githubUrl: text('github_url').notNull(),
  githubCreatedAt: text('github_created_at'),
  githubUpdatedAt: text('github_updated_at'),

  // Local-only fields
  userNotes: text('user_notes'),
  userTags: text('user_tags'),

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ─── PRDs ────────────────────────────────────────────

export const prds = sqliteTable('prds', {
  id: text('id').primaryKey(),
  issueId: text('issue_id').references(() => issues.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  status: text('status')
    .notNull()
    .$type<'draft' | 'reviewed' | 'approved' | 'scheduled' | 'building' | 'done' | 'failed' | 'generating'>(),
  agentModel: text('agent_model'),
  agentPrompt: text('agent_prompt'),
  version: integer('version').notNull().default(1),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  parentPrdId: text('parent_prd_id'),
  scheduledAt: text('scheduled_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ─── Agents ─────────────────────────────────────────

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  providerType: text('provider_type')
    .notNull()
    .$type<'claude-code' | 'anthropic-sdk'>(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  baseUrl: text('base_url'),
  modelOpus: text('model_opus').notNull(),
  modelSonnet: text('model_sonnet').notNull(),
  modelHaiku: text('model_haiku').notNull(),
  extraEnvVars: text('extra_env_vars'),
  systemPromptTemplate: text('system_prompt_template'),
  isActive: integer('is_active').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// ─── PRD Issues (junction) ───────────────────────────

export const prdIssues = sqliteTable('prd_issues', {
  id: text('id').primaryKey(),
  prdId: text('prd_id')
    .notNull()
    .references(() => prds.id, { onDelete: 'cascade' }),
  issueId: text('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' })
    .unique(),
  createdAt: text('created_at').notNull(),
})

// ─── PRD Comments ────────────────────────────────────

export const prdComments = sqliteTable('prd_comments', {
  id: text('id').primaryKey(),
  prdId: text('prd_id')
    .notNull()
    .references(() => prds.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
})

// ─── Agent Logs ──────────────────────────────────────

export const agentLogs = sqliteTable('agent_logs', {
  id: text('id').primaryKey(),
  prdId: text('prd_id')
    .notNull()
    .references(() => prds.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  sessionId: text('session_id').notNull(),
  eventType: text('event_type')
    .notNull()
    .$type<'thinking' | 'tool_call' | 'tool_result' | 'output' | 'error' | 'status'>(),
  content: text('content').notNull(),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
})

// ─── Build Jobs ──────────────────────────────────────

export const buildJobs = sqliteTable('build_jobs', {
  id: text('id').primaryKey(),
  prdId: text('prd_id')
    .notNull()
    .references(() => prds.id, { onDelete: 'cascade' }),
  status: text('status')
    .notNull()
    .$type<'queued' | 'running' | 'success' | 'failed'>(),
  agentLog: text('agent_log'),
  prUrl: text('pr_url'),
  branchName: text('branch_name'),
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
