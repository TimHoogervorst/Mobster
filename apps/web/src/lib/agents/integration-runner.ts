import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import { eq, inArray, desc } from 'drizzle-orm'
import type { DbClient } from '@mobster/db'
import { prds, prdIssues, issues, githubRepos, agents, buildJobs, projectItems } from '@mobster/db'
import { createAgentRunner } from './factory'
import { buildIntegrationPrompt } from './integration-template'
import { prepareWorkspace } from './workspace'
import { SessionLogger } from './logger'
import { createGitHubClient } from '@/lib/github'
import type { ModelTier } from './types'

const execFileAsync = promisify(execFile)

function getWorkspaceRoot(): string {
  return process.env.WORKSPACE_PATH ?? join(process.cwd(), 'workspaces')
}

/**
 * Orchestrates the full PRD integration lifecycle.
 *
 * 1. Loads PRD + repo context from DB
 * 2. Ensures a workspace clone exists (re-clone from cache if needed)
 * 3. Finds the active agent configuration
 * 4. Builds the integration prompt from the PRD content
 * 5. Runs the agent to implement code changes
 * 6. Runs the test suite and captures results
 * 7. Commits, branches, pushes, and optionally creates a PR
 * 8. Updates build_job and PRD records
 *
 * Called asynchronously (fire-and-forget Promise) from the integrate API route.
 */
export async function integratePrd(
  db: DbClient,
  prdId: string,
  accessToken: string,
  targetType: 'new-branch' | 'existing-branch' | 'pull-request',
  branchName: string,
  useFork = false,
  forkOwner?: string,
  cleanWorkspace = false,
): Promise<void> {
  const now = new Date().toISOString()
  let buildJobId = uuid() // Created immediately so catch block can always update it

  try {
    // 1. Load PRD record
    const prd = db.select().from(prds).where(eq(prds.id, prdId)).get()
    if (!prd) {
      console.error('[integration-runner] PRD not found:', prdId)
      return
    }

    if (!prd.content) {
      throw new Error('PRD has no content to implement')
    }

    // 2. Create build_job record IMMEDIATELY (before any work starts)
    //    This guarantees the catch block can always record errors to it.
    const existingJob = db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.prdId, prdId))
      .orderBy(desc(buildJobs.createdAt))
      .limit(1)
      .all()

    const latestExisting = existingJob.length > 0 ? existingJob[0] : null

    if (latestExisting) {
      buildJobId = latestExisting.id
      db.update(buildJobs)
        .set({
          status: 'queued',
          branchName,
          error: null,
          retryCount: latestExisting.retryCount + 1,
          startedAt: null,
          completedAt: null,
          prUrl: null,
          testResults: null,
          updatedAt: now,
        })
        .where(eq(buildJobs.id, latestExisting.id))
        .run()
    } else {
      db.insert(buildJobs)
        .values({
          id: buildJobId,
          prdId,
          status: 'queued',
          branchName,
          retryCount: 0,
          maxRetries: 3,
          createdAt: now,
          updatedAt: now,
        })
        .run()
    }

    // 3. Load repo from first linked issue
    const piRows = db.select().from(prdIssues).where(eq(prdIssues.prdId, prdId)).all()
    if (piRows.length === 0) {
      throw new Error('No issues linked to this PRD')
    }

    const issueIds = piRows.map((pi) => pi.issueId)
    const issueRows = db.select().from(issues).where(inArray(issues.id, issueIds)).all()
    if (issueRows.length === 0) {
      throw new Error('Linked issues not found')
    }

    const firstIssue = issueRows[0]!
    const repo = db.select().from(githubRepos).where(eq(githubRepos.id, firstIssue.repoId)).get()
    if (!repo) {
      throw new Error('Repo not found for issue')
    }

    // 4. Find active agent
    let agentRow = prd.agentId
      ? db.select().from(agents).where(eq(agents.id, prd.agentId)).get()
      : null

    if (!agentRow) {
      agentRow = db.select().from(agents).where(eq(agents.isActive, 1)).get()
    }

    if (!agentRow) {
      throw new Error('No active agent configured. Go to /agents to set one up.')
    }

    // 5. Transition build_job from 'queued' to 'running'
    db.update(buildJobs)
      .set({ status: 'running', startedAt: now, updatedAt: now })
      .where(eq(buildJobs.id, buildJobId))
      .run()

    // 6. Ensure workspace exists
    const WORKSPACE_ROOT = getWorkspaceRoot()
    const workspacePath = join(WORKSPACE_ROOT, `prd-${prdId}`)

    // If cleanWorkspace is requested, delete the existing workspace first
    if (cleanWorkspace && existsSync(workspacePath)) {
      console.log(`[integration-runner] Cleaning workspace for ${prdId}...`)
      rmSync(workspacePath, { recursive: true, force: true })
      console.log(`[integration-runner] Workspace cleaned`)
    }

    if (!existsSync(workspacePath)) {
      console.log(`[integration-runner] Workspace missing for ${prdId}, re-cloning from cache...`)
      try {
        await prepareWorkspace(
          { owner: repo.owner, name: repo.name, fullName: repo.fullName },
          accessToken,
          prdId,
        )
        console.log(`[integration-runner] Workspace re-created at ${workspacePath}`)
      } catch (error: any) {
        throw new Error(
          'Workspace unavailable and could not be re-created. Re-generate the PRD to create a fresh workspace.',
        )
      }
    }

    // 7. Build integration prompt
    const { systemPrompt, userPrompt } = buildIntegrationPrompt(
      prd.content,
      {
        fullName: repo.fullName,
        language: repo.language,
        description: repo.description,
      },
      branchName,
      workspacePath,
    )

    // 8. Create runner and logger
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
    const sessionId = `build-${prdId}-v${prd.version}`
    const logger = new SessionLogger(db, prdId, agentRow.id, sessionId)

    logger.status(
      `Integration started (branch: ${branchName}, fork: ${useFork}, model: ${agentRow.modelSonnet})`,
    )

    console.log(
      `[integration-runner] Running agent for PRD ${prdId} ` +
        `(branch: ${branchName}, fork: ${useFork}, model: ${agentRow.modelSonnet})`,
    )

    // 9. Run the agent
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
      `[integration-runner] Agent completed for PRD ${prdId}, ` +
        `output length: ${result.output.length}, tool calls: ${result.toolCalls ?? 'N/A'}`,
    )

    logger.status(
      `Code generation complete. Output: ${result.output.length} chars, tool calls: ${result.toolCalls ?? 'N/A'}`,
    )

    // 10. Parse test results from agent output
    const testResults = extractTestResults(result.output)

    // 11. Verify changes exist
    let statusOutput = ''
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
        cwd: workspacePath,
        timeout: 10_000,
      })
      statusOutput = stdout.trim()
    } catch (error: any) {
      throw new Error(`Failed to check git status: ${error.message}`)
    }

    let hasUnpushedCommits = false

    if (!statusOutput) {
      // No uncommitted changes — but there may be committed-but-unpushed changes
      // from a previous failed attempt. Check if the branch has commits ahead of remote.
      const pushRemote = useFork && forkOwner ? 'fork' : 'origin'
      try {
        const { stdout: logOut } = await execFileAsync(
          'git',
          ['log', `${pushRemote}/${branchName}..${branchName}`, '--oneline'],
          { cwd: workspacePath, timeout: 10_000 },
        )
        hasUnpushedCommits = logOut.trim().length > 0
      } catch {
        // Remote branch may not exist yet (first push) — check if we have any commits
        try {
          const { stdout: logOut } = await execFileAsync(
            'git',
            ['log', '--oneline', '-1'],
            { cwd: workspacePath, timeout: 10_000 },
          )
          hasUnpushedCommits = logOut.trim().length > 0
        } catch {
          // No commits at all
        }
      }

      if (hasUnpushedCommits) {
        console.log(`[integration-runner] No new uncommitted changes, but unpushed commits exist — pushing...`)
        logger.status('No new changes — pushing existing commits...')
        // Fall through to the push step below (skip commit since already committed)
      } else {
        // Truly no changes — mark as success with explanation
        console.log(`[integration-runner] No changes to push — PRD may already be implemented`)
        logger.status('No changes detected — the PRD may already be implemented.')

        db.update(buildJobs)
          .set({
            status: 'success',
            error: 'Agent completed but no changes were detected. The PRD may already be implemented.',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(buildJobs.id, buildJobId))
          .run()

        db.update(prds)
          .set({ status: 'done', updatedAt: new Date().toISOString() })
          .where(eq(prds.id, prdId))
          .run()

        return
      }
    }

    console.log(`[integration-runner] Changes detected:\n${statusOutput}`)
    logger.status(`File changes detected:\n${statusOutput}`)

    // 12. Configure git remote
    const remote = useFork && forkOwner ? 'fork' : 'origin'
    const pushOwner = useFork && forkOwner ? forkOwner : repo.owner
    const remoteUrl = `https://x-access-token:${accessToken}@github.com/${pushOwner}/${repo.name}.git`

    if (useFork && forkOwner) {
      // Add fork as a separate remote
      try {
        await execFileAsync('git', ['remote', 'add', 'fork', remoteUrl], {
          cwd: workspacePath,
          timeout: 10_000,
        })
      } catch {
        // Remote may already exist — update it
        await execFileAsync('git', ['remote', 'set-url', 'fork', remoteUrl], {
          cwd: workspacePath,
          timeout: 10_000,
        })
      }
    } else {
      await execFileAsync('git', ['remote', 'set-url', 'origin', remoteUrl], {
        cwd: workspacePath,
        timeout: 10_000,
      })
    }

    // 13. Branch management
    try {
      // Create and switch to new branch
      await execFileAsync('git', ['checkout', '-b', branchName], {
        cwd: workspacePath,
        timeout: 10_000,
      })
    } catch {
      // Branch already exists locally — switch to it and pull latest
      console.log(`[integration-runner] Branch ${branchName} exists, checking out...`)
      await execFileAsync('git', ['checkout', branchName], {
        cwd: workspacePath,
        timeout: 10_000,
      })
      try {
        await execFileAsync('git', ['-c', 'credential.helper=', 'pull', remote, branchName], {
          cwd: workspacePath,
          timeout: 30_000,
        })
      } catch (pullError: any) {
        console.warn(`[integration-runner] Pull failed (continuing):`, pullError.message)
      }
    }

    // 14. Commit (skip if changes were already committed in a previous attempt)
    if (!hasUnpushedCommits) {
      await execFileAsync(
        'git',
        ['add', '-A'],
        { cwd: workspacePath, timeout: 10_000 },
      )

      const commitMessage = `feat: implement ${prd.title}\n\nPRD: ${prdId}\nCo-Authored-By: AI Agent <noreply@anthropic.com>`
      await execFileAsync(
        'git',
        ['commit', '-m', commitMessage],
        { cwd: workspacePath, timeout: 10_000 },
      )
    }

    // 15. Push
    try {
      await execFileAsync('git', ['-c', 'credential.helper=', 'push', remote, branchName], {
        cwd: workspacePath,
        timeout: 60_000,
      })
      console.log(`[integration-runner] Pushed ${branchName} to ${remote}`)
      logger.status(`Pushed ${branchName} to ${remote}`)
    } catch (pushError: any) {
      // Try rebase on push failure
      if (pushError.message.includes('rejected') || pushError.message.includes('non-fast-forward')) {
        console.log(`[integration-runner] Push rejected, attempting rebase...`)
        try {
          await execFileAsync('git', ['-c', 'credential.helper=', 'pull', '--rebase', remote, branchName], {
            cwd: workspacePath,
            timeout: 30_000,
          })
          await execFileAsync('git', ['-c', 'credential.helper=', 'push', remote, branchName], {
            cwd: workspacePath,
            timeout: 60_000,
          })
        } catch (rebaseError: any) {
          throw new Error(`Push failed and rebase also failed: ${rebaseError.message}${rebaseError.stderr ? '\n' + rebaseError.stderr : ''}`)
        }
      } else {
        const isPermissionError =
          pushError.message.includes('403') ||
          pushError.message.includes('Permission denied') ||
          (pushError.stderr && (pushError.stderr.includes('403') || pushError.stderr.includes('Permission denied')))

        if (isPermissionError) {
          throw new Error(
            `Failed to push to ${remote}/${branchName}: Permission denied.\n\n` +
            `Your GitHub personal access token may not have the 'repo' scope required for pushing code.\n` +
            `Go to GitHub → Settings → Developer settings → Personal access tokens → edit your token ` +
            `and ensure the 'repo' checkbox is checked.\n\n` +
            `Original error: ${pushError.message}${pushError.stderr ? '\n' + pushError.stderr : ''}`,
          )
        }

        throw new Error(`Failed to push to ${remote}/${branchName}: ${pushError.message}${pushError.stderr ? '\n' + pushError.stderr : ''}`)
      }
    }

    // 16. Create PR if applicable
    let prUrl: string | null = null
    if (targetType === 'pull-request' || useFork) {
      try {
        const github = createGitHubClient(accessToken)
        const defaultBranch = (await github.getDefaultBranchRef(repo.owner, repo.name)).name
        const headRef = useFork && forkOwner
          ? `${forkOwner}:${branchName}`
          : branchName

        const prBody = `## PRD Integration\n\nThis PR implements the changes described in PRD: **${prd.title}**.\n\n${prd.content.slice(0, 1000)}${prd.content.length > 1000 ? '\n\n...' : ''}`

        const pr = await github.createPullRequest(
          repo.owner,
          repo.name,
          `feat: ${prd.title}`,
          headRef,
          defaultBranch,
          prBody,
        )

        prUrl = pr.url
        console.log(`[integration-runner] PR created: ${pr.url}`)
        logger.status(`Pull request created: ${pr.url}`)
      } catch (prError: any) {
        // Non-fatal: push succeeded, PR creation can be done manually
        console.error(`[integration-runner] PR creation failed (push succeeded):`, prError.message)
        logger.error(`PR creation failed: ${prError.message}`)
      }
    }

    // 17. Update records on success
    db.update(buildJobs)
      .set({
        status: 'success',
        prUrl,
        testResults,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(buildJobs.id, buildJobId))
      .run()

    db.update(prds)
      .set({
        status: 'done',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(prds.id, prdId))
      .run()

    logger.status(
      `Integration complete${prUrl ? ` — PR: ${prUrl}` : ''}${testResults ? ` — Tests captured` : ''}`,
    )

    // Phase 3.5: Update project item if this build is part of a project
    await handleProjectItemUpdate(db, buildJobId, 'success')
  } catch (error: any) {
    console.error(`[integration-runner] Failed for PRD ${prdId}:`, error.message)

    // Try to log the error
    try {
      const prd = db.select().from(prds).where(eq(prds.id, prdId)).get()
      if (prd) {
        const sessionId = `build-${prdId}-v${prd.version}`
        const logger = new SessionLogger(
          db,
          prdId,
          prd.agentId ?? '',
          sessionId,
        )
        logger.error(`Integration failed: ${error.message}`)
      }
    } catch {
      // Can't log — continue to fail
    }

    // Update build_job (buildJobId is always set — created before any work)
    db.update(buildJobs)
      .set({
        status: 'failed',
        error: error.message || 'Unknown error',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(buildJobs.id, buildJobId))
      .run()

    // Revert PRD status to 'approved' so it can be retried
    db.update(prds)
      .set({
        status: 'approved',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(prds.id, prdId))
      .run()

    // Phase 3.5: Update project item status on failure
    await handleProjectItemUpdate(db, buildJobId, 'failed')
  }
}

/**
 * Extracts the "## Test Results" section from the agent's output.
 */
function extractTestResults(output: string): string | null {
  const match = output.match(/## Test Results\s*\n([\s\S]*?)(?=\n## |\n---|\n\*\*|$)/i)
  if (!match) return null

  // Also try to find test output after the heading until the end or next major heading
  const idx = output.search(/## Test Results/i)
  if (idx === -1) return null

  const after = output.slice(idx + '## Test Results'.length)
  const endMatch = after.match(/\n## [A-Z]/)
  const content = endMatch ? after.slice(0, endMatch.index!) : after

  return content.trim() || null
}

function parseLabels(labels: string | null): string[] {
  if (!labels) return []
  try {
    return JSON.parse(labels)
  } catch {
    return []
  }
}

/**
 * Phase 3.5: After a build job completes (success or failure), update the
 * linked project item and check if the phase can advance.
 */
async function handleProjectItemUpdate(
  db: DbClient,
  buildJobId: string,
  outcome: 'success' | 'failed',
): Promise<void> {
  try {
    const buildJob = db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.id, buildJobId))
      .get()

    if (!buildJob?.projectItemId) return

    const pi = db
      .select()
      .from(projectItems)
      .where(eq(projectItems.id, buildJob.projectItemId))
      .get()

    if (!pi) return

    const newStatus = outcome === 'success' ? 'integrated' : 'failed'
    const now = new Date().toISOString()

    db.update(projectItems)
      .set({ status: newStatus, updatedAt: now })
      .where(eq(projectItems.id, pi.id))
      .run()

    // Log the event
    const { EventLogger } = await import('@/lib/event-logger')
    const logger = new EventLogger({
      db,
      entityType: 'project' as any,
      entityId: pi.projectId,
    })
    logger.log(outcome === 'success' ? 'item.integrated' : 'item.failed', {
      summary: `Integration ${outcome === 'success' ? 'succeeded' : 'failed'} for project item`,
      metadata: {
        itemId: pi.id,
        buildJobId,
        prUrl: buildJob.prUrl,
        phaseId: pi.phaseId,
      },
    })

    // Check if phase can advance
    if (outcome === 'success') {
      const { canAdvancePhase, advancePhase, activateNextPhase } =
        await import('@/lib/project-gates')

      if (canAdvancePhase(db, pi.phaseId)) {
        advancePhase(db, pi.phaseId)
        activateNextPhase(db, pi.projectId)
      }
    }
  } catch (err) {
    console.error('[integration-runner] Failed to update project item:', err)
  }
}
