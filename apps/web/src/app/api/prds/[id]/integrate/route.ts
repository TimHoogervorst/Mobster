import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { prds, prdIssues, issues, githubRepos, buildJobs } from '@mobster/db'
import { IntegrateInput } from '@mobster/shared'
import { eq, inArray, desc } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'
import { createGitHubClient } from '@/lib/github'

// ─── Helpers ──────────────────────────────────────────

function slugify(text: string, maxLen = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen)
}

// ─── GET: Latest build job status for a PRD ──────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()

  const buildJob = db
    .select()
    .from(buildJobs)
    .where(eq(buildJobs.prdId, id))
    .orderBy(desc(buildJobs.createdAt))
    .limit(1)
    .get()

  if (!buildJob) {
    return NextResponse.json({ buildJob: null })
  }

  return NextResponse.json({
    buildJob: {
      id: buildJob.id,
      prdId: buildJob.prdId,
      status: buildJob.status,
      prUrl: buildJob.prUrl,
      branchName: buildJob.branchName,
      error: buildJob.error,
      testResults: buildJob.testResults,
      retryCount: buildJob.retryCount,
      startedAt: buildJob.startedAt,
      completedAt: buildJob.completedAt,
      createdAt: buildJob.createdAt,
    },
  })
}

// ─── POST: Start PRD integration ─────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Rate limit
  const rateCheck = checkRateLimit(`integrate:${session.user.githubId}`, 5, 60_000)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } },
    )
  }

  const { id } = await params
  const body = await request.json()
  const parsed = IntegrateInput.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const now = new Date().toISOString()
  const { targetType, branchName: userBranchName, cleanWorkspace, force } = parsed.data

  // Load PRD
  const prd = db.select().from(prds).where(eq(prds.id, id)).get()
  if (!prd) {
    return NextResponse.json({ error: 'PRD not found' }, { status: 404 })
  }

  if (prd.status !== 'reviewed' && prd.status !== 'approved' && prd.status !== 'building') {
    return NextResponse.json(
      { error: `PRD must be in 'reviewed', 'approved', or 'building' status. Current status: '${prd.status}'` },
      { status: 400 },
    )
  }

  // Check for existing in-progress build
  const existingJob = db
    .select()
    .from(buildJobs)
    .where(eq(buildJobs.prdId, id))
    .orderBy(desc(buildJobs.createdAt))
    .limit(1)
    .get()

  if (existingJob && (existingJob.status === 'queued' || existingJob.status === 'running')) {
    if (!force) {
      return NextResponse.json(
        { error: 'An integration is already in progress for this PRD' },
        { status: 409 },
      )
    }

    // Force: cancel the stuck job and proceed
    db.update(buildJobs)
      .set({
        status: 'failed',
        error: 'Cancelled by user — new integration started',
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(buildJobs.id, existingJob.id))
      .run()

    console.log(`[integrate] Force-cancelled stuck job ${existingJob.id}`)
  }

  // Load repo from first linked issue
  const piRows = db
    .select()
    .from(prdIssues)
    .where(eq(prdIssues.prdId, id))
    .all()

  if (piRows.length === 0) {
    return NextResponse.json({ error: 'No issues linked to this PRD' }, { status: 400 })
  }

  const issueIds = piRows.map((pi) => pi.issueId)
  const issueRows = db
    .select()
    .from(issues)
    .where(inArray(issues.id, issueIds))
    .all()

  if (issueRows.length === 0) {
    return NextResponse.json({ error: 'Linked issues not found' }, { status: 400 })
  }

  const firstIssue = issueRows[0]!
  const repo = db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.id, firstIssue.repoId))
    .get()

  if (!repo) {
    return NextResponse.json({ error: 'Repo not found for issue' }, { status: 400 })
  }

  // Create GitHub client
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
    console.error('[integrate] Failed to check repo access:', error.message)
    return NextResponse.json(
      { error: `Failed to check repository access: ${error.message}` },
      { status: 502 },
    )
  }

  // Get default branch
  let defaultBranch: string
  try {
    const ref = await github.getDefaultBranchRef(repo.owner, repo.name)
    defaultBranch = ref.name
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to get default branch: ${error.message}` },
      { status: 502 },
    )
  }

  // Determine final branch name
  let finalBranchName: string

  if (targetType === 'new-branch') {
    finalBranchName = userBranchName || `prd/${slugify(prd.title)}`

    // Check for collisions
    const existingBranch = await github.getBranch(repo.owner, repo.name, finalBranchName)
    if (existingBranch) {
      // Append suffix
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
  } else if (targetType === 'existing-branch') {
    if (!userBranchName) {
      return NextResponse.json(
        { error: 'branchName is required for existing-branch target type' },
        { status: 400 },
      )
    }

    const branch = await github.getBranch(repo.owner, repo.name, userBranchName)
    if (!branch) {
      return NextResponse.json(
        { error: `Branch '${userBranchName}' not found in ${repo.fullName}` },
        { status: 400 },
      )
    }
    finalBranchName = userBranchName
  } else {
    // pull-request
    finalBranchName = userBranchName || `prd/${slugify(prd.title)}`

    // Same collision check as new-branch
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
  }

  // Enforce business rules
  if (finalBranchName === defaultBranch && targetType !== 'pull-request') {
    return NextResponse.json(
      {
        error: `Direct pushes to the default branch ('${defaultBranch}') are not allowed. Use 'Pull request' mode instead.`,
      },
      { status: 400 },
    )
  }

  if (targetType === 'pull-request' && finalBranchName === defaultBranch) {
    return NextResponse.json(
      { error: 'Cannot create a PR from the default branch itself. Create a new branch first.' },
      { status: 400 },
    )
  }

  // If forking, always use pull-request mode since we can't push directly to the source repo
  if (useFork) {
    // Target type becomes pull-request automatically
    console.log(`[integrate] Using fork: ${forkOwner}/${repo.name}, branch: ${finalBranchName}`)
  }

  // Create build_job record
  const buildJobId = uuid()
  db.insert(buildJobs)
    .values({
      id: buildJobId,
      prdId: id,
      status: 'queued',
      branchName: finalBranchName,
      retryCount: existingJob ? existingJob.retryCount : 0,
      maxRetries: 3,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // Set PRD to 'building' immediately (before async call)
  // This ensures the UI shows the building status right away,
  // matching the pattern used by PRD generation ('generating')
  db.update(prds)
    .set({ status: 'building', updatedAt: now })
    .where(eq(prds.id, id))
    .run()

  // Trigger async integration
  const { integratePrd } = await import('@/lib/agents/integration-runner')
  setTimeout(() => {
    integratePrd(
      db,
      id,
      session.accessToken,
      useFork ? 'pull-request' : targetType,
      finalBranchName,
      useFork,
      forkOwner,
      !!cleanWorkspace,
    ).catch((err: Error) => {
      console.error('[integrate] Background integration failed:', err.message)
    })
  }, 0)

  return NextResponse.json({
    buildJob: {
      id: buildJobId,
      prdId: id,
      status: 'queued',
      branchName: finalBranchName,
      useFork,
      createdAt: now,
    },
  })
}
