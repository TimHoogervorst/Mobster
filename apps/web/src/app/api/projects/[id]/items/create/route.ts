import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { projects, projectPhases, projectItems, items } from '@mobster/db'
import { eq } from 'drizzle-orm'
import { ProjectCreateItemInput } from '@mobster/shared'
import { EventLogger } from '@/lib/event-logger'

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
  const parsed = ProjectCreateItemInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()

  // Validate project
  const project = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Validate phase belongs to this project
  const phase = db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.id, parsed.data.phaseId))
    .get()
  if (!phase || phase.projectId !== id) {
    return NextResponse.json(
      { error: 'Phase not found in this project' },
      { status: 404 },
    )
  }

  const now = new Date().toISOString()
  const itemId = uuid()

  // Create the item in the unified items table
  db.insert(items)
    .values({
      id: itemId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      itemType: parsed.data.itemType,
      status: 'open',
      source: 'manual',
      sourceData: JSON.stringify({
        createdVia: 'project',
        projectId: id,
        ...(parsed.data.sourceProjectId
          ? { sourceProjectId: parsed.data.sourceProjectId }
          : {}),
      }),
      size: null,
      requiresReview: 1,
      repoId: project.repoId,
      origin: 'project',
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // Get sort order
  const maxOrder = db
    .select({ max: sql<number>`coalesce(max(${projectItems.sortOrder}), 0)` })
    .from(projectItems)
    .where(eq(projectItems.phaseId, parsed.data.phaseId))
    .get()

  const sortOrder = parsed.data.sortOrder ?? ((maxOrder?.max as number) ?? 0) + 1

  // Create project item junction
  const piId = uuid()
  db.insert(projectItems)
    .values({
      id: piId,
      projectId: id,
      phaseId: parsed.data.phaseId,
      itemId,
      sortOrder,
      status: 'pending',
      sourceProjectId: parsed.data.sourceProjectId ?? null,
      addedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  const logger = new EventLogger({ db, entityType: 'project', entityId: id })
  logger.log('item.created_in_project', {
    summary: `"${parsed.data.title}" created in project`,
    metadata: { itemId, phaseId: parsed.data.phaseId, itemType: parsed.data.itemType },
  })

  const created = db.select().from(projectItems).where(eq(projectItems.id, piId)).get()
  const item = db.select().from(items).where(eq(items.id, itemId)).get()

  return NextResponse.json({ ...created, item }, { status: 201 })
}

import { sql } from 'drizzle-orm'
