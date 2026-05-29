import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { prds, prdIssues, issues, githubRepos, agents } from '@mobster/db'
import { PrdGenerateInput } from '@mobster/shared'
import { eq, sql, inArray } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

// ─── GET: List PRDs ────────────────────────────────────

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const { searchParams } = new URL(request.url)

  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)))

  // Build conditions
  let allPrds = db.select().from(prds).all()

  if (status) {
    allPrds = allPrds.filter((p) => p.status === status)
  }

  // Sort by updatedAt desc
  allPrds.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const total = allPrds.length
  const paged = allPrds.slice((page - 1) * pageSize, page * pageSize)

  // Enrich with issue count and agent name
  const enriched = paged.map((prd) => {
    const linkedCount = db
      .select({ count: sql<number>`count(*)` })
      .from(prdIssues)
      .where(eq(prdIssues.prdId, prd.id))
      .get()?.count ?? 0

    const agentName = prd.agentId
      ? db.select().from(agents).where(eq(agents.id, prd.agentId)).get()?.name ?? null
      : null

    return {
      id: prd.id,
      title: prd.title,
      status: prd.status,
      version: prd.version,
      issueCount: linkedCount,
      agentName,
      agentModel: prd.agentModel,
      createdAt: prd.createdAt,
      updatedAt: prd.updatedAt,
    }
  })

  return NextResponse.json({ prds: enriched, total, page, pageSize })
}

// ─── POST: Create PRD + trigger async generation ───────

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Rate limit
  const rateCheck = checkRateLimit(`prd:${session.user.githubId}`, 10, 60_000)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } },
    )
  }

  const body = await request.json()
  const parsed = PrdGenerateInput.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const { issueIds } = parsed.data

  // Load all issues
  const issueRows = db.select().from(issues).where(inArray(issues.id, issueIds)).all()

  if (issueRows.length !== issueIds.length) {
    return NextResponse.json(
      { error: 'Some issues were not found' },
      { status: 400 },
    )
  }

  // Validate all issues belong to the same repo
  const repoIds = new Set(issueRows.map((i) => i.repoId))
  if (repoIds.size > 1) {
    return NextResponse.json(
      { error: 'All issues must be from the same repository' },
      { status: 400 },
    )
  }

  // Validate no issues are already in a PRD
  const existingLinks = db
    .select()
    .from(prdIssues)
    .where(inArray(prdIssues.issueId, issueIds))
    .all()

  if (existingLinks.length > 0) {
    const conflictIds = existingLinks.map((l) => l.issueId)
    return NextResponse.json(
      {
        error: 'Some issues are already in a PRD',
        conflictingIssueIds: conflictIds,
      },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const prdId = uuid()

  // TODO: Generate a more descriptive title from the issue list
  const title =
    issueRows.length === 1
      ? issueRows[0]!.title
      : `Combined PRD: ${issueRows.map((i) => `#${i.number}`).join(', ')}`

  // Find active agent
  const activeAgent = db.select().from(agents).where(eq(agents.isActive, 1)).get()

  // Create PRD record
  db.insert(prds)
    .values({
      id: prdId,
      title,
      content: '', // Will be populated by generator
      status: 'generating' as any,
      version: 1,
      agentId: activeAgent?.id ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // Create prd_issues links
  for (const issueId of issueIds) {
    db.insert(prdIssues)
      .values({
        id: uuid(),
        prdId,
        issueId,
        createdAt: now,
      })
      .run()
  }

  // Trigger async generation
  const { generatePrd } = await import('@/lib/agents/prd-generator')
  setTimeout(() => {
    generatePrd(db, prdId, session.accessToken).catch((err: Error) => {
      console.error('[prds/route] Background generation failed:', err.message)
    })
  }, 0)

  return NextResponse.json(
    {
      prd: {
        id: prdId,
        title,
        status: 'generating',
        issueCount: issueIds.length,
        createdAt: now,
      },
    },
    { status: 201 },
  )
}
