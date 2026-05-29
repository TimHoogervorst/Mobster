import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { prds, prdIssues, prdComments, issues, githubRepos, agents } from '@mobster/db'
import { PrdStatusInput } from '@mobster/shared'
import { eq, inArray } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

// ─── GET: Single PRD detail ────────────────────────────

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

  const prd = db.select().from(prds).where(eq(prds.id, id)).get()
  if (!prd) {
    return NextResponse.json({ error: 'PRD not found' }, { status: 404 })
  }

  // Load linked issues
  const links = db.select().from(prdIssues).where(eq(prdIssues.prdId, id)).all()
  const linkedIssues = links.length > 0
    ? db.select().from(issues).where(inArray(issues.id, links.map((l) => l.issueId))).all()
    : []

  // Enrich issues with repo name
  const enrichedIssues = linkedIssues.map((issue) => {
    const repo = db.select().from(githubRepos).where(eq(githubRepos.id, issue.repoId)).get()
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      repoFullName: repo?.fullName ?? 'unknown',
      labels: parseLabels(issue.labels),
    }
  })

  // Load comments
  const comments = db.select().from(prdComments).where(eq(prdComments.prdId, id)).all()

  // Load agent info
  const agentName = prd.agentId
    ? db.select().from(agents).where(eq(agents.id, prd.agentId)).get()?.name ?? null
    : null

  return NextResponse.json({
    prd: {
      id: prd.id,
      title: prd.title,
      content: prd.content,
      status: prd.status,
      version: prd.version,
      agentId: prd.agentId,
      agentName,
      agentModel: prd.agentModel,
      parentPrdId: prd.parentPrdId,
      createdAt: prd.createdAt,
      updatedAt: prd.updatedAt,
    },
    issues: enrichedIssues,
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
    })),
  })
}

// ─── PATCH: Update PRD status / trigger feedback regeneration ─

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = PrdStatusInput.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const prd = db.select().from(prds).where(eq(prds.id, id)).get()

  if (!prd) {
    return NextResponse.json({ error: 'PRD not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const { status, comment } = parsed.data

  // If sending feedback (status='draft' and comments exist) → trigger regeneration
  if (status === 'draft' && comment) {
    // Rate limit feedback regeneration
    const rateCheck = checkRateLimit(`prd:${session.user.githubId}`, 10, 60_000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait.', retryAfter: rateCheck.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } },
      )
    }

    // Add the feedback as a comment
    const { v4: uuid } = await import('uuid')
    db.insert(prdComments)
      .values({
        id: uuid(),
        prdId: id,
        content: comment,
        createdAt: now,
      })
      .run()

    // Set status to generating and increment version
    db.update(prds)
      .set({
        status: 'generating',
        version: prd.version + 1,
        updatedAt: now,
      })
      .where(eq(prds.id, id))
      .run()

    // Trigger async regeneration
    const { generatePrd } = await import('@/lib/agents/prd-generator')
    setTimeout(() => {
      generatePrd(db, id, session.accessToken).catch((err: Error) => {
        console.error('[prds/patch] Background regeneration failed:', err.message)
      })
    }, 0)

    return NextResponse.json({
      prd: {
        id: prd.id,
        status: 'generating',
        version: prd.version + 1,
      },
    })
  }

  // Simple status change (draft→reviewed→approved)
  db.update(prds)
    .set({
      status: status as any,
      updatedAt: now,
    })
    .where(eq(prds.id, id))
    .run()

  return NextResponse.json({
    prd: {
      id: prd.id,
      status,
      updatedAt: now,
    },
  })
}

// ─── DELETE: Remove a PRD ──────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()

  const prd = db.select().from(prds).where(eq(prds.id, id)).get()
  if (!prd) {
    return NextResponse.json({ error: 'PRD not found' }, { status: 404 })
  }

  // Cascade: prd_issues and prd_comments are deleted via FK ON DELETE CASCADE
  db.delete(prds).where(eq(prds.id, id)).run()

  return NextResponse.json({ success: true })
}

// ─── Helpers ──────────────────────────────────────────

function parseLabels(labels: string | null): string[] {
  if (!labels) return []
  try {
    return JSON.parse(labels)
  } catch {
    return []
  }
}
