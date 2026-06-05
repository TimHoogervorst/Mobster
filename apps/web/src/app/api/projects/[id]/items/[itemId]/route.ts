import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { projects, projectItems } from '@mobster/db'
import { eq, and } from 'drizzle-orm'
import { ProjectItemUpdateInput } from '@mobster/shared'
import { EventLogger } from '@/lib/event-logger'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id, itemId } = await params
  const body = await request.json()
  const parsed = ProjectItemUpdateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const pi = db
    .select()
    .from(projectItems)
    .where(and(eq(projectItems.id, itemId), eq(projectItems.projectId, id)))
    .get()
  if (!pi) {
    return NextResponse.json({ error: 'Project item not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { updatedAt: now }

  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder

  db.update(projectItems)
    .set(updates)
    .where(eq(projectItems.id, itemId))
    .run()

  if (parsed.data.status && parsed.data.status !== pi.status) {
    const logger = new EventLogger({ db, entityType: 'project', entityId: id })
    logger.log(`item.${parsed.data.status}`, {
      summary: `Item status: ${parsed.data.status}`,
      metadata: { itemId, phaseId: pi.phaseId, previousStatus: pi.status },
    })
  }

  const updated = db
    .select()
    .from(projectItems)
    .where(eq(projectItems.id, itemId))
    .get()
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id, itemId } = await params
  const db = getDb()

  const pi = db
    .select()
    .from(projectItems)
    .where(and(eq(projectItems.id, itemId), eq(projectItems.projectId, id)))
    .get()
  if (!pi) {
    return NextResponse.json({ error: 'Project item not found' }, { status: 404 })
  }

  db.delete(projectItems).where(eq(projectItems.id, itemId)).run()

  const logger = new EventLogger({ db, entityType: 'project', entityId: id })
  logger.log('item.removed', {
    summary: 'Item removed from project',
    metadata: { itemId, phaseId: pi.phaseId },
  })

  return NextResponse.json({ success: true })
}
