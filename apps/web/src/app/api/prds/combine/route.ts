import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { prds, prdIssues, prdComments, issues, agents } from '@mobster/db'
import { PrdCombineInput } from '@mobster/shared'
import { eq, inArray } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'

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
  const parsed = PrdCombineInput.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const { prdIds, title } = parsed.data

  // Load source PRDs
  const sourcePrds = db.select().from(prds).where(inArray(prds.id, prdIds)).all()

  if (sourcePrds.length !== prdIds.length) {
    return NextResponse.json(
      { error: 'Some PRDs were not found' },
      { status: 400 },
    )
  }

  // Validate all PRDs are in a state that can be combined (not generating/failed)
  const invalidStates = sourcePrds.filter((p) => p.status === 'generating' || p.status === 'failed')
  if (invalidStates.length > 0) {
    return NextResponse.json(
      { error: 'Cannot combine PRDs that are currently generating or failed' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const combinedId = uuid()

  // Find active agent
  const activeAgent = db.select().from(agents).where(eq(agents.isActive, 1)).get()

  // Create the combined PRD
  db.insert(prds)
    .values({
      id: combinedId,
      title,
      content: '', // Will be populated by generator
      status: 'generating' as any,
      version: 1,
      parentPrdId: prdIds[0]!, // Reference the first source PRD
      agentId: activeAgent?.id ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // Link all issues from source PRDs to the new combined PRD
  for (const sourcePrd of sourcePrds) {
    const links = db.select().from(prdIssues).where(eq(prdIssues.prdId, sourcePrd.id)).all()
    for (const link of links) {
      // Check issue isn't already linked (unlikely but defensive)
      const existing = db
        .select()
        .from(prdIssues)
        .where(eq(prdIssues.issueId, link.issueId))
        .get()
      if (!existing) {
        db.insert(prdIssues)
          .values({
            id: uuid(),
            prdId: combinedId,
            issueId: link.issueId,
            createdAt: now,
          })
          .run()
      }
    }
  }

  // Trigger async combine generation
  const { generatePrd } = await import('@/lib/agents/prd-generator')
  setTimeout(() => {
    generatePrd(db, combinedId, session.accessToken).catch((err: Error) => {
      console.error('[prds/combine] Background combine failed:', err.message)
    })
  }, 0)

  return NextResponse.json(
    {
      prd: {
        id: combinedId,
        title,
        status: 'generating',
        sourcePrdIds: prdIds,
        createdAt: now,
      },
    },
    { status: 201 },
  )
}
