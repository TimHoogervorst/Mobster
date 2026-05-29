import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { prds, prdComments } from '@mobster/db'
import { PrdCommentInput } from '@mobster/shared'
import { eq } from 'drizzle-orm'

// ─── GET: List comments for a PRD ──────────────────────

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

  const comments = db.select().from(prdComments).where(eq(prdComments.prdId, id)).all()

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
    })),
  })
}

// ─── POST: Add a comment to a PRD ──────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = PrdCommentInput.safeParse(body)

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
  const commentId = uuid()

  db.insert(prdComments)
    .values({
      id: commentId,
      prdId: id,
      content: parsed.data.content,
      createdAt: now,
    })
    .run()

  return NextResponse.json(
    {
      comment: {
        id: commentId,
        content: parsed.data.content,
        createdAt: now,
      },
    },
    { status: 201 },
  )
}
