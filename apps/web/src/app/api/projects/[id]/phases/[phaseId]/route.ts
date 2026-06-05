import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { projects, projectPhases, projectItems } from '@mobster/db'
import { eq } from 'drizzle-orm'
import { ProjectPhaseUpdateInput } from '@mobster/shared'
import { EventLogger } from '@/lib/event-logger'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id, phaseId } = await params
  const body = await request.json()
  const parsed = ProjectPhaseUpdateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const phase = db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.id, phaseId))
    .get()
  if (!phase || phase.projectId !== id) {
    return NextResponse.json({ error: 'Phase not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { updatedAt: now }

  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status
    if (parsed.data.status === 'active' && !phase.startedAt) {
      updates.startedAt = now
    }
    if (parsed.data.status === 'passed' || parsed.data.status === 'failed') {
      updates.completedAt = now
    }
  }
  if (parsed.data.gateCriteria !== undefined) updates.gateCriteria = parsed.data.gateCriteria

  db.update(projectPhases)
    .set(updates)
    .where(eq(projectPhases.id, phaseId))
    .run()

  if (parsed.data.status && parsed.data.status !== phase.status) {
    const logger = new EventLogger({ db, entityType: 'project', entityId: id })
    logger.log(`phase.${parsed.data.status}`, {
      summary: `Phase "${phase.name}" status: ${parsed.data.status}`,
      metadata: { phaseId, previousStatus: phase.status },
    })
  }

  const updated = db.select().from(projectPhases).where(eq(projectPhases.id, phaseId)).get()
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id, phaseId } = await params
  const db = getDb()

  const phase = db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.id, phaseId))
    .get()
  if (!phase || phase.projectId !== id) {
    return NextResponse.json({ error: 'Phase not found' }, { status: 404 })
  }

  // Don't allow deleting a phase with in-progress items
  const inProgress = db
    .select()
    .from(projectItems)
    .where(eq(projectItems.phaseId, phaseId))
    .all()
  if (inProgress.some((pi) => pi.status === 'in_progress')) {
    return NextResponse.json(
      { error: 'Cannot delete a phase with in-progress items' },
      { status: 409 },
    )
  }

  db.delete(projectPhases).where(eq(projectPhases.id, phaseId)).run()
  return NextResponse.json({ success: true })
}
