import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { projects, projectPhases } from '@mobster/db'
import { eq, sql } from 'drizzle-orm'
import { ProjectPhaseCreateInput } from '@mobster/shared'
import { EventLogger } from '@/lib/event-logger'

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

  const project = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const phases = db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, id))
    .orderBy(projectPhases.sortOrder)
    .all()

  return NextResponse.json({ phases })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = ProjectPhaseCreateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const project = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Auto-assign sort order as max+1
  const maxOrder = db
    .select({ max: sql<number>`coalesce(max(${projectPhases.sortOrder}), 0)` })
    .from(projectPhases)
    .where(eq(projectPhases.projectId, id))
    .get()

  const now = new Date().toISOString()
  const phaseId = uuid()

  db.insert(projectPhases)
    .values({
      id: phaseId,
      projectId: id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      phaseType: parsed.data.phaseType,
      sortOrder: (maxOrder?.max ?? 0) + 1,
      status: 'pending',
      gateCriteria: parsed.data.gateCriteria ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  const logger = new EventLogger({ db, entityType: 'project', entityId: id })
  logger.log('phase.created', {
    summary: `Phase "${parsed.data.name}" created`,
    metadata: { phaseId, phaseType: parsed.data.phaseType },
  })

  const created = db.select().from(projectPhases).where(eq(projectPhases.id, phaseId)).get()
  return NextResponse.json(created, { status: 201 })
}
