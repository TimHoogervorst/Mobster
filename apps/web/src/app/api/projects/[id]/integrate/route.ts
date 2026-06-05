import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  projects,
  projectPhases,
  projectItems,
  prds,
  prdIssues,
  items,
  githubRepos,
  buildJobs,
} from '@mobster/db'
import { eq, inArray } from 'drizzle-orm'
import { IntegrateInput } from '@mobster/shared'
import { checkRateLimit } from '@/lib/rate-limit'
import { createGitHubClient } from '@/lib/github'
import { EventLogger } from '@/lib/event-logger'

function slugify(text: string, maxLen = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rateCheck = checkRateLimit(`integrate:${session.user.githubId}`, 5, 60_000)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } },
    )
  }

  const { id: projectId } = await params
  const body = await request.json()
  const parsed = IntegrateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const projectItemId = (body as any).projectItemId
  if (!projectItemId) {
    return NextResponse.json({ error: 'projectItemId is required' }, { status: 400 })
  }

  const db = getDb()
  const now = new Date().toISOString()
  const { targetType, branchName: userBranchName, cleanWorkspace, force } = parsed.data

  // Validate project item
  const pi = db
    .select()
    .from(projectItems)
    .where(eq(projectItems.id, projectItemId))
    .get()
  if (!pi || pi.projectId !== projectId) {
    return NextResponse.json({ error: 'Invalid project item' }, { status: 400 })
  }

  // Validate it has a PRD
  if (!pi.prdId) {
    return NextResponse.json(
      { error: 'Item has no PRD — generate one first' },
      { status: 400 },
    )
  }

  // Validate phase is active
  const phase = db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.id, pi.phaseId))
    .get()
  if (!phase || phase.status !== 'active') {
    return NextResponse.json({ error: 'Phase is not active' }, { status: 400 })
  }

  // Load PRD
  const prd = db.select().from(prds).where(eq(prds.id, pi.prdId)).get()
  if (!prd) {
    return NextResponse.json({ error: 'PRD not found' }, { status: 404 })
  }

  if (prd.status !== 'reviewed' && prd.status !== 'approved' && prd.status !== 'building') {
    return NextResponse.json(
      { error: `PRD must be in 'reviewed', 'approved', or 'building' status. Current: '${prd.status}'` },
      { status: 400 },
    )
  }

  // Load repo from the first linked issue (or from the item directly)
  const item = db.select().from(items).where(eq(items.id, pi.itemId)).get()
  const repo = db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.id, item?.repoId ?? ''))
    .get()
  if (!repo) {
    return NextResponse.json({ error: 'Repo not found for project item' }, { status: 400 })
  }

  // Check repo access and fork if needed
  const github = createGitHubClient(session.accessToken)
  let useFork = false
  let forkOwner: string | undefined

  try {
    const access = await github.checkRepoPushAccess(repo.owner, repo.name)
    if (!access.isOwner && !access.hasPush) {
      useFork = true
      const fork = await github.forkRepo(repo.owner, repo.name)
      forkOwner = fork.owner
    }
  } catch (error: any) {
    console.error('[project-integrate] Failed to check repo access:', error.message)
    return NextResponse.json(
      { error: `Failed to check repository access: ${error.message}` },
      { status: 502 },
    )
  }

  // Determine branch name
  const defaultBranch = repo.defaultBranch
  let finalBranchName: string
  if (targetType === 'new-branch' || targetType === 'pull-request') {
    finalBranchName = userBranchName || `prd/${slugify(prd.title)}`
    const existingBranch = await github.getBranch(repo.owner, repo.name, finalBranchName)
    if (existingBranch) {
      let suffix = 2
      while (suffix < 100) {
        const candidate = `${finalBranchName}-${suffix}`
        const check = await github.getBranch(repo.owner, repo.name, candidate)
        if (!check) {
          finalBranchName = candidate
          break
        }
        suffix++
      }
    }
  } else {
    if (!userBranchName) {
      return NextResponse.json(
        { error: 'branchName is required for existing-branch target type' },
        { status: 400 },
      )
    }
    finalBranchName = userBranchName
  }

  // Mark project item as in_progress
  db.update(projectItems)
    .set({ status: 'in_progress', updatedAt: now })
    .where(eq(projectItems.id, pi.id))
    .run()

  const logger = new EventLogger({ db, entityType: 'project', entityId: projectId })
  logger.log('item.integration_started', {
    summary: `Integration started for "${item?.title ?? 'item'}"`,
    metadata: { itemId: pi.id, prdId: pi.prdId, phaseId: pi.phaseId },
  })

  // Create build job with project item link
  const buildJobId = uuid()
  db.insert(buildJobs)
    .values({
      id: buildJobId,
      prdId: pi.prdId,
      projectItemId: pi.id,
      status: 'queued',
      branchName: finalBranchName,
      retryCount: 0,
      maxRetries: 3,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // Set PRD to 'building'
  db.update(prds)
    .set({ status: 'building', updatedAt: now })
    .where(eq(prds.id, pi.prdId))
    .run()

  // Fire-and-forget integration
  const { integratePrd } = await import('@/lib/agents/integration-runner')
  setTimeout(() => {
    integratePrd(
      db,
      pi.prdId!,
      session.accessToken,
      useFork ? 'pull-request' : targetType,
      finalBranchName,
      useFork,
      forkOwner,
      !!cleanWorkspace,
    ).catch((err: Error) => {
      console.error('[project-integrate] Background integration failed:', err.message)
    })
  }, 0)

  return NextResponse.json({
    buildJobId,
    itemStatus: 'in_progress',
    projectItemId: pi.id,
  })
}
