import { ApiDocs } from './swagger-ui'

export default function ApiDocsPage() {
  return <ApiDocs spec={openApiSpec} />
}

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Mobster API',
    version: '1.0.0',
    description:
      'Self-hosted GitHub issue manager with AI-powered PRD generation and code integration.',
  },
  servers: [{ url: '/api', description: 'Same origin' }],
  security: [{ cookieAuth: [] }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey' as const,
        in: 'cookie' as const,
        name: 'authjs.session-token',
        description: 'JWT session cookie set after GitHub PAT login at /login',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'object' },
        },
      },
      PrdStatus: {
        type: 'string',
        enum: ['draft', 'reviewed', 'approved', 'scheduled', 'building', 'done', 'failed', 'generating'],
      },
      BuildJobStatus: {
        type: 'string',
        enum: ['queued', 'running', 'success', 'failed'],
      },
      IssueType: {
        type: 'string',
        enum: ['bug', 'feature', 'question', 'other'],
      },
      IssueState: {
        type: 'string',
        enum: ['open', 'closed'],
      },
      AgentProvider: {
        type: 'string',
        enum: ['claude-code', 'anthropic-sdk'],
      },
      PrdGenerateInput: {
        type: 'object',
        required: ['issueIds'],
        properties: {
          issueIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 10 },
        },
      },
      PrdStatusInput: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { $ref: '#/components/schemas/PrdStatus' },
          comment: { type: 'string', maxLength: 10000 },
        },
      },
      PrdCombineInput: {
        type: 'object',
        required: ['prdIds', 'title'],
        properties: {
          prdIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 2, maxItems: 10 },
          title: { type: 'string', minLength: 1, maxLength: 500 },
        },
      },
      PrdCommentInput: {
        type: 'object',
        required: ['content'],
        properties: { content: { type: 'string', minLength: 1, maxLength: 10000 } },
      },
      IntegrateInput: {
        type: 'object',
        required: ['targetType'],
        properties: {
          targetType: { type: 'string', enum: ['new-branch', 'existing-branch', 'pull-request'] },
          branchName: { type: 'string', pattern: '^[a-zA-Z0-9._/-]+$', maxLength: 200 },
          cleanWorkspace: { type: 'boolean' },
          force: { type: 'boolean' },
        },
      },
      AgentCreateInput: {
        type: 'object',
        required: ['name', 'providerType', 'apiKey', 'modelOpus', 'modelSonnet', 'modelHaiku'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          providerType: { $ref: '#/components/schemas/AgentProvider' },
          apiKey: { type: 'string', minLength: 1 },
          baseUrl: { type: 'string', format: 'uri' },
          modelOpus: { type: 'string', minLength: 1 },
          modelSonnet: { type: 'string', minLength: 1 },
          modelHaiku: { type: 'string', minLength: 1 },
          extraEnvVars: { type: 'object', additionalProperties: { type: 'string' } },
          systemPromptTemplate: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
      IssueUpdateInput: {
        type: 'object',
        properties: {
          userNotes: { type: 'string', maxLength: 10000 },
          userTags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 10 },
          issueType: { $ref: '#/components/schemas/IssueType' },
        },
      },
      RepoSelectInput: {
        type: 'object',
        required: ['owner', 'name', 'fullName'],
        properties: {
          owner: { type: 'string' },
          name: { type: 'string' },
          fullName: { type: 'string' },
        },
      },
      AddRepoByUrlInput: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string', description: 'GitHub URL, e.g. https://github.com/owner/repo' } },
      },
    },
  },
  paths: {
    // ─── Agents ───
    '/agents': {
      get: {
        tags: ['Agents'],
        summary: 'List all agents',
        responses: { '200': { description: 'Array of agents (API keys masked)' } },
      },
      post: {
        tags: ['Agents'],
        summary: 'Create an agent',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentCreateInput' } } } },
        responses: { '201': { description: 'Agent created' }, '400': { description: 'Validation error' } },
      },
    },
    '/agents/{id}': {
      get: {
        tags: ['Agents'],
        summary: 'Get agent by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Agent detail (API key masked)' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['Agents'],
        summary: 'Update agent',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentCreateInput' } } } },
        responses: { '200': { description: 'Agent updated' } },
      },
      delete: {
        tags: ['Agents'],
        summary: 'Delete agent',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },

    // ─── Auth ───
    '/auth/signout': {
      get: {
        tags: ['Auth'],
        summary: 'Sign out',
        responses: { '302': { description: 'Redirects to /login' } },
      },
    },

    // ─── Issues ───
    '/issues': {
      get: {
        tags: ['Issues'],
        summary: 'List issues',
        parameters: [
          { name: 'repoId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'type', in: 'query', schema: { $ref: '#/components/schemas/IssueType' } },
          { name: 'state', in: 'query', schema: { $ref: '#/components/schemas/IssueState' } },
          { name: 'label', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search query' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated issue list' } },
      },
    },
    '/issues/{id}': {
      get: {
        tags: ['Issues'],
        summary: 'Get issue by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Issue detail' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['Issues'],
        summary: 'Update issue annotations',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/IssueUpdateInput' } } } },
        responses: { '200': { description: 'Issue updated' } },
      },
    },

    // ─── PRDs ───
    '/prds': {
      get: {
        tags: ['PRDs'],
        summary: 'List PRDs',
        parameters: [
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/PrdStatus' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated PRD list' } },
      },
      post: {
        tags: ['PRDs'],
        summary: 'Create PRD and trigger async generation',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PrdGenerateInput' } } } },
        responses: {
          '201': { description: 'PRD created (status: generating)' },
          '400': { description: 'Validation error' },
          '409': { description: 'Issue already linked to another PRD' },
          '429': { description: 'Rate limited (10/min)' },
        },
      },
    },
    '/prds/{id}': {
      get: {
        tags: ['PRDs'],
        summary: 'Get PRD detail',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'PRD with linked issues, comments, agent info' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['PRDs'],
        summary: 'Update PRD status or trigger feedback regeneration',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PrdStatusInput' } } } },
        responses: { '200': { description: 'Status updated or regeneration triggered' } },
      },
      delete: {
        tags: ['PRDs'],
        summary: 'Delete PRD',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/prds/combine': {
      post: {
        tags: ['PRDs'],
        summary: 'Combine multiple PRDs into one',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PrdCombineInput' } } } },
        responses: { '201': { description: 'Combined PRD created (status: generating)' }, '400': { description: 'Validation error' } },
      },
    },
    '/prds/{id}/comments': {
      get: {
        tags: ['PRDs'],
        summary: 'List comments for a PRD',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Array of comments' } },
      },
      post: {
        tags: ['PRDs'],
        summary: 'Add a comment to a PRD',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PrdCommentInput' } } } },
        responses: { '201': { description: 'Comment added' } },
      },
    },
    '/prds/{id}/integrate': {
      get: {
        tags: ['PRDs'],
        summary: 'Get latest build job status for a PRD',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Latest build job or null' } },
      },
      post: {
        tags: ['PRDs'],
        summary: 'Start PRD integration (branch, push, PR)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/IntegrateInput' } } } },
        responses: {
          '201': { description: 'Integration started' },
          '400': { description: 'Invalid status or branch validation error' },
          '409': { description: 'Integration already in progress' },
          '429': { description: 'Rate limited (5/min)' },
        },
      },
    },

    // ─── Repos ───
    '/repos': {
      get: {
        tags: ['Repos'],
        summary: 'List GitHub repos merged with connection status',
        responses: { '200': { description: 'Array of repos with connected boolean' } },
      },
      post: {
        tags: ['Repos'],
        summary: 'Save selected repos to local DB',
        requestBody: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RepoSelectInput' } } } } },
        responses: { '201': { description: 'Repos saved' } },
      },
    },
    '/repos/{id}': {
      delete: {
        tags: ['Repos'],
        summary: 'Remove a connected repo and its issues',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/repos/{id}/sync': {
      post: {
        tags: ['Repos'],
        summary: 'Sync issues from GitHub for a repo',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Sync complete' } },
      },
    },
    '/repos/add-by-url': {
      post: {
        tags: ['Repos'],
        summary: 'Add a repo by GitHub URL',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AddRepoByUrlInput' } } } },
        responses: { '201': { description: 'Repo added with metadata' }, '400': { description: 'Invalid URL' } },
      },
    },

    // ─── Runners ───
    '/runners': {
      get: {
        tags: ['Runners'],
        summary: 'List all agent sessions (active + history)',
        responses: { '200': { description: '{ sessions, active, history } — active = generating or building PRDs' } },
      },
    },
    '/runners/{sessionId}': {
      get: {
        tags: ['Runners'],
        summary: 'Get session detail with full event log',
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' }, description: 'e.g. prd-{uuid}-v1 or build-{uuid}-v1' }],
        responses: { '200': { description: 'Session with events array' }, '404': { description: 'Session not found' } },
      },
    },
    '/runners/refresh': {
      post: {
        tags: ['Runners'],
        summary: 'Detect and repair stuck sessions (>1 hour inactive)',
        responses: { '200': { description: '{ repaired: number }' } },
      },
    },
  },
}
