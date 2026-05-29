import { eq, inArray } from 'drizzle-orm'
import type { DbClient } from '@mobster/db'
import { prds, prdIssues, prdComments, issues, githubRepos, agents } from '@mobster/db'
import { createAgentRunner } from './factory'
import { buildPrdPrompt } from './prd-template'
import { prepareWorkspace } from './workspace'
import { SessionLogger } from './logger'
import type { ModelTier } from './types'

/**
 * Orchestrates the full PRD generation lifecycle.
 *
 * 1. Loads PRD + linked issues + repo context from DB
 * 2. Prepares a workspace by cloning the repo (if runner is configured)
 * 3. Finds the active agent configuration
 * 4. Creates the appropriate runner (Claude Code or Anthropic SDK)
 * 5. Builds the prompt using the 6-section PRD template
 * 6. Runs the agent from within the workspace (so it can explore the codebase)
 * 7. Updates the PRD record with the generated content
 *
 * Called asynchronously (fire-and-forget Promise) from API routes.
 *
 * @param db - Database client
 * @param prdId - The PRD ID to generate
 * @param accessToken - GitHub PAT for cloning the repo into the workspace
 */
export async function generatePrd(
  db: DbClient,
  prdId: string,
  accessToken: string,
): Promise<void> {
  const now = new Date().toISOString()

  try {
    // Load PRD record
    const prd = db.select().from(prds).where(eq(prds.id, prdId)).get()
    if (!prd) {
      console.error('[prd-generator] PRD not found:', prdId)
      return
    }

    // Load linked issues via junction table
    const piRows = db.select().from(prdIssues).where(eq(prdIssues.prdId, prdId)).all()
    if (piRows.length === 0) {
      throw new Error('No issues linked to this PRD')
    }

    const issueIds = piRows.map((pi) => pi.issueId)
    const issueRows = db.select().from(issues).where(inArray(issues.id, issueIds)).all()

    if (issueRows.length === 0) {
      throw new Error('Linked issues not found')
    }

    // Load repo context from the first issue
    const firstIssue = issueRows[0]!
    const repo = db.select().from(githubRepos).where(eq(githubRepos.id, firstIssue.repoId)).get()
    if (!repo) {
      throw new Error('Repo not found for issue')
    }

    // Determine which agent to use
    let agentId = prd.agentId
    let agentRow = agentId
      ? db.select().from(agents).where(eq(agents.id, agentId)).get()
      : null

    // Fall back to active agent if PRD's agent is gone or none was set
    if (!agentRow) {
      agentRow = db.select().from(agents).where(eq(agents.isActive, 1)).get()
    }

    if (!agentRow) {
      throw new Error('No active agent configured. Go to /agents to set one up.')
    }

    // Step: Prepare workspace by cloning the repo
    let workspacePath: string | undefined
    try {
      console.log(`[prd-generator] Preparing workspace for ${repo.fullName}...`)
      workspacePath = await prepareWorkspace(
        {
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName,
        },
        accessToken,
        prdId,
      )
      console.log(`[prd-generator] Workspace ready at ${workspacePath}`)
    } catch (error: any) {
      // Non-fatal: continue without workspace
      console.warn(`[prd-generator] Workspace preparation failed (continuing without):`, error.message)
      workspacePath = undefined
    }

    // Load any existing comments (for regeneration feedback)
    const comments = db.select().from(prdComments).where(eq(prdComments.prdId, prdId)).all()
    const feedbackTexts = comments.length > 0 ? comments.map((c) => c.content) : undefined

    // Build prompt
    const issueData = issueRows.map((i) => ({
      number: i.number,
      title: i.title,
      body: i.body,
      labels: parseLabels(i.labels),
    }))

    const { systemPrompt, userPrompt } = buildPrdPrompt(
      issueData,
      {
        fullName: repo.fullName,
        language: repo.language,
        description: repo.description,
      },
      agentRow.systemPromptTemplate,
      feedbackTexts,
      workspacePath,
    )

    // Create runner and execute
    const runner = createAgentRunner({
      providerType: agentRow.providerType,
      apiKeyEncrypted: agentRow.apiKeyEncrypted,
      baseUrl: agentRow.baseUrl,
      modelOpus: agentRow.modelOpus,
      modelSonnet: agentRow.modelSonnet,
      modelHaiku: agentRow.modelHaiku,
      extraEnvVars: agentRow.extraEnvVars,
    })

    const tier: ModelTier = 'sonnet'
    const sessionId = `prd-${prdId}-v${prd.version}`
    const logger = new SessionLogger(db, prdId, agentRow.id, sessionId)

    logger.status(`PRD generation started (${issueRows.length} issues, model: ${agentRow.modelSonnet}, workspace: ${workspacePath ?? 'none'})`)

    console.log(
      `[prd-generator] Running agent for PRD ${prdId} ` +
      `(${issueRows.length} issues, model: ${agentRow.modelSonnet}, workspace: ${workspacePath ?? 'none'})`,
    )

    const result = await runner.run(userPrompt, {
      modelTier: tier,
      systemPrompt,
      cwd: workspacePath,
      onLog: (eventType, content, metadata) => {
        switch (eventType) {
          case 'thinking':
            logger.thinking(content)
            break
          case 'tool_call':
            logger.toolCall(
              (metadata as any)?.toolName ?? 'unknown',
              (metadata as any)?.toolInput,
            )
            break
          case 'tool_result':
            logger.toolResult((metadata as any)?.toolName ?? 'unknown', content)
            break
          case 'output':
            logger.output(content)
            break
          case 'error':
            logger.error(content)
            break
          case 'status':
            logger.status(content)
            break
        }
      },
    })

    console.log(
      `[prd-generator] Agent completed for PRD ${prdId}, ` +
      `output length: ${result.output.length}, tool calls: ${result.toolCalls ?? 'N/A'}`,
    )

    logger.status(`Generation complete. Output: ${result.output.length} chars, tool calls: ${result.toolCalls ?? 'N/A'}`)

    // Validate the response has the expected sections
    const hasSections = validatePrdSections(result.output)

    // Update PRD
    db.update(prds)
      .set({
        content: result.output,
        status: hasSections ? 'draft' : 'draft',
        agentModel: result.model,
        agentPrompt: systemPrompt,
        agentId: agentRow.id,
        updatedAt: now,
      })
      .where(eq(prds.id, prdId))
      .run()

    if (!hasSections) {
      console.warn('[prd-generator] Response may be missing some PRD sections')
    }
  } catch (error: any) {
    console.error(`[prd-generator] Failed for PRD ${prdId}:`, error.message)

    // Try to log the error if we have a logger (it may not have been created yet)
    try {
      const prd = db.select().from(prds).where(eq(prds.id, prdId)).get()
      if (prd) {
        const sessionId = `prd-${prdId}-v${prd.version}`
        const logger = new SessionLogger(db, prdId, prd.agentId ?? '', sessionId)
        logger.error(`Generation failed: ${error.message}`)
      }
    } catch {
      // Can't log — just continue to fail
    }

    // Mark PRD as failed
    db.update(prds)
      .set({
        status: 'failed',
        updatedAt: now,
      })
      .where(eq(prds.id, prdId))
      .run()
  }
}

const EXPECTED_SECTIONS = ['Summary', 'Problem', 'Changes', 'Technical Changes', 'Risks', 'Tests']

function validatePrdSections(content: string): boolean {
  // Check that at least 4 of 6 expected sections are present (allow some variance)
  const found = EXPECTED_SECTIONS.filter((section) =>
    content.toLowerCase().includes(`## ${section.toLowerCase()}`),
  )
  return found.length >= 4
}

function parseLabels(labels: string | null): string[] {
  if (!labels) return []
  try {
    return JSON.parse(labels)
  } catch {
    return []
  }
}
