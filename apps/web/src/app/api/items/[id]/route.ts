import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { items, githubRepos } from '@mobster/db'
import { eq } from 'drizzle-orm'
import { ItemUpdateInput } from '@mobster/shared'

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

  const item = db.select().from(items).where(eq(items.id, id)).get()
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, item.repoId)).get()

  return NextResponse.json({
    ...item,
    repoFullName: repo?.fullName ?? 'unknown',
    labels: parseJsonArray(item.labels),
    userTags: parseJsonArray(item.userTags),
  })
}

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
  const parsed = ItemUpdateInput.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const existing = db.select().from(items).where(eq(items.id, id)).get()
  if (!existing) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (parsed.data.userNotes !== undefined) updates.userNotes = parsed.data.userNotes
  if (parsed.data.userTags !== undefined) updates.userTags = JSON.stringify(parsed.data.userTags)
  if (parsed.data.itemType !== undefined) updates.itemType = parsed.data.itemType
  if (parsed.data.size !== undefined) updates.size = parsed.data.size
  if (parsed.data.requiresReview !== undefined) updates.requiresReview = parsed.data.requiresReview ? 1 : 0
  if (parsed.data.reviewReason !== undefined) updates.reviewReason = parsed.data.reviewReason

  db.update(items).set(updates).where(eq(items.id, id)).run()

  const updated = db.select().from(items).where(eq(items.id, id)).get()
  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, updated!.repoId)).get()

  return NextResponse.json({
    ...updated,
    repoFullName: repo?.fullName ?? 'unknown',
    labels: parseJsonArray(updated!.labels),
    userTags: parseJsonArray(updated!.userTags),
  })
}

function parseJsonArray(str: string | null): string[] {
  if (!str) return []
  try {
    return JSON.parse(str)
  } catch {
    return []
  }
}
