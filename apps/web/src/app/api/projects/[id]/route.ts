import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  projects,
  projectPhases,
  projectItems,
  githubRepos,
  items,
  eventLog,
} from '@mobster/db'
import { eq, or, and } from 'drizzle-orm'
import { ProjectUpdateInput } from '@mobster/shared'
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

  const repo = db.select().from(githubRepos).where(eq(githubRepos.id, project.repoId)).get()

  // Fetch phases ordered by sortOrder
  const phases = db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, id))
    .orderBy(projectPhases.sortOrder)
    .all()

  // For each phase, fetch project items with item display data
  const phasesWithItems = await Promise.all(
    phases.map(async (phase) => {
      const pItems = db
        .select()
        .from(projectItems)
        .where(eq(projectItems.phaseId, phase.id))
        .orderBy(projectItems.sortOrder)
        .all()

      // Batch-join to items table for display data
      const itemIds = pItems.map((pi) => pi.itemId)
      const itemRecords =
        itemIds.length > 0
          ? db
              .select({
                id: items.id,
                title: items.title,
                number: items.number,
                itemType: items.itemType,
                source: items.source,
                size: items.size,
                requiresReview: items.requiresReview,
                status: items.status,
                sourceUrl: items.sourceUrl,
                headBranch: items.headBranch,
                baseBranch: items.baseBranch,
              })
              .from(items)
              .where(
                itemIds.length === 1
                  ? eq(items.id, itemIds[0]!)
                  : or(...itemIds.map((iid) => eq(items.id, iid))),
              )
              .all()
          : []

      const itemMap = new Map(itemRecords.map((it) => [it.id, it]))

      const enrichedItems = pItems.map((pi) => {
        const item = itemMap.get(pi.itemId)
        return {
          ...pi,
          displayTitle: item?.title ?? 'Unknown item',
          displayNumber: item?.number ?? null,
          itemType: item?.itemType ?? null,
          itemSource: item?.source ?? null,
          itemSize: item?.size ?? null,
          itemStatus: item?.status ?? null,
          requiresReview: item?.requiresReview ?? null,
          sourceUrl: item?.sourceUrl ?? null,
          headBranch: item?.headBranch ?? null,
          baseBranch: item?.baseBranch ?? null,
        }
      })

      return { ...phase, items: enrichedItems }
    }),
  )

  // Fetch recent history for this project
  const history = db
    .select()
    .from(eventLog)
    .where(
      or(
        and(eq(eventLog.entityType, 'project'), eq(eventLog.entityId, id)),
        and(eq(eventLog.parentEntityType, 'project'), eq(eventLog.parentEntityId, id)),
      ),
    )
    .orderBy(sql`${eventLog.createdAt} DESC`)
    .limit(50)
    .all()

  return NextResponse.json({
    ...project,
    repoFullName: repo?.fullName ?? 'unknown',
    repoOwner: repo?.owner ?? '',
    repoName: repo?.name ?? '',
    phases: phasesWithItems,
    history,
  })
}

// Need sql for orderBy
import { sql } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = ProjectUpdateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()
  const existing = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!existing) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { updatedAt: now }

  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status
    // Auto-set testing timestamp
    if (parsed.data.status === 'testing' && existing.status !== 'testing') {
      // Project transitioning to testing
    }
  }

  db.update(projects).set(updates).where(eq(projects.id, id)).run()

  const logger = new EventLogger({ db, entityType: 'project', entityId: id })
  if (parsed.data.status && parsed.data.status !== existing.status) {
    logger.log(`project.${parsed.data.status}`, {
      summary: `Project status changed to ${parsed.data.status}`,
      metadata: { previousStatus: existing.status, newStatus: parsed.data.status },
    })
  } else {
    logger.log('project.updated', { summary: 'Project updated' })
  }

  const updated = db.select().from(projects).where(eq(projects.id, id)).get()
  return NextResponse.json(updated)
}

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

  const existing = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!existing) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  db.delete(projects).where(eq(projects.id, id)).run()
  return NextResponse.json({ success: true })
}
