import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { projects, projectPhases, projectItems, items } from '@mobster/db'
import { eq, and } from 'drizzle-orm'
import { ProjectAddItemsInput } from '@mobster/shared'
import { EventLogger } from '@/lib/event-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const db = getDb()
  const { searchParams } = request.nextUrl

  const phaseId = searchParams.get('phaseId')
  const status = searchParams.get('status')
  const itemType = searchParams.get('itemType')

  const conditions = [eq(projectItems.projectId, id)]
  if (phaseId) conditions.push(eq(projectItems.phaseId, phaseId))
  if (status) conditions.push(eq(projectItems.status, status as any))

  const piRows = db
    .select()
    .from(projectItems)
    .where(and(...conditions))
    .orderBy(projectItems.sortOrder)
    .all()

  // Batch-join to items
  const itemIds = piRows.map((pi) => pi.itemId)
  const itemRecords =
    itemIds.length > 0
      ? db
          .select()
          .from(items)
          .where(
            itemIds.length === 1
              ? eq(items.id, itemIds[0]!)
              : undefined, // fallback handled by filter below
          )
          .all()
      : []

  const itemMap = new Map(itemRecords.map((it) => [it.id, it]))

  // Filter by itemType if requested
  let enriched = piRows.map((pi) => {
    const item = itemMap.get(pi.itemId)
    return { ...pi, item: item ?? null }
  })

  if (itemType) {
    enriched = enriched.filter((e) => e.item?.itemType === itemType)
  }

  return NextResponse.json({ projectItems: enriched })
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
  const parsed = ProjectAddItemsInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()

  // Validate project exists
  const project = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const logger = new EventLogger({ db, entityType: 'project', entityId: id })
  const added: string[] = []

  for (const input of parsed.data.items) {
    // Validate phase belongs to this project
    const phase = db
      .select()
      .from(projectPhases)
      .where(
        and(eq(projectPhases.id, input.phaseId), eq(projectPhases.projectId, id)),
      )
      .get()
    if (!phase) continue

    // Validate item exists
    const item = db.select().from(items).where(eq(items.id, input.itemId)).get()
    if (!item) continue

    // Check item isn't already in this project
    const existing = db
      .select()
      .from(projectItems)
      .where(
        and(
          eq(projectItems.projectId, id),
          eq(projectItems.itemId, input.itemId),
        ),
      )
      .get()
    if (existing) continue

    const maxOrder = db
      .select({ max: sql<number>`coalesce(max(${projectItems.sortOrder}), 0)` })
      .from(projectItems)
      .where(eq(projectItems.phaseId, input.phaseId))
      .get()

    const sortOrder = input.sortOrder ?? ((maxOrder?.max as number) ?? 0) + 1

    db.insert(projectItems)
      .values({
        id: uuid(),
        projectId: id,
        phaseId: input.phaseId,
        itemId: input.itemId,
        sortOrder,
        status: 'pending',
        addedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    logger.log('item.added', {
      summary: `"${item.title}" added to phase`,
      metadata: { itemId: input.itemId, phaseId: input.phaseId },
    })

    added.push(input.itemId)
  }

  return NextResponse.json({ added, count: added.length }, { status: 201 })
}

// Drizzle sql
import { sql } from 'drizzle-orm'
