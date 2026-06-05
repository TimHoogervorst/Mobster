import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { items, githubRepos } from '@mobster/db'
import { eq, and, like, sql, inArray } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const { searchParams } = request.nextUrl

  const source = searchParams.get('source')
  const itemType = searchParams.get('itemType')
  const status = searchParams.get('status')
  const repoId = searchParams.get('repo')
  const size = searchParams.get('size')
  const origin = searchParams.get('origin')
  const label = searchParams.get('label')
  const query = searchParams.get('q')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)))
  const sort = searchParams.get('sort') ?? 'githubUpdatedAt'
  const order = searchParams.get('order') ?? 'desc'

  // Build conditions
  const conditions = []

  if (source) {
    const sources = source.split(',')
    if (sources.length === 1) {
      conditions.push(eq(items.source, sources[0]! as any))
    } else {
      conditions.push(inArray(items.source, sources as any))
    }
  }
  if (itemType) {
    const types = itemType.split(',')
    if (types.length === 1) {
      conditions.push(eq(items.itemType, types[0]! as any))
    } else {
      conditions.push(inArray(items.itemType, types as any))
    }
  }
  if (status) {
    const statuses = status.split(',')
    if (statuses.length === 1) {
      conditions.push(eq(items.status, statuses[0]! as any))
    } else {
      conditions.push(inArray(items.status, statuses as any))
    }
  }
  if (repoId) conditions.push(eq(items.repoId, repoId))
  if (size) conditions.push(eq(items.size, size as any))
  if (origin) conditions.push(eq(items.origin, origin as any))
  if (label) conditions.push(like(items.labels, `%${label}%`))
  if (query) conditions.push(like(items.title, `%${query}%`))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  // Get total count
  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(where)
    .get()

  const total = countResult?.count ?? 0

  // Determine sort column
  const sortCol =
    sort === 'title'
      ? items.title
      : sort === 'number'
        ? items.number
        : sort === 'createdAt'
          ? items.createdAt
          : items.githubUpdatedAt

  const rows = db
    .select()
    .from(items)
    .where(where)
    .orderBy(order === 'asc' ? sortCol : sql`${sortCol} DESC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  // Enrich with repo full name
  const repos = db.select().from(githubRepos).all()
  const repoMap = new Map(repos.map((r) => [r.id, r.fullName]))

  const enriched = rows.map((item) => ({
    ...item,
    repoFullName: repoMap.get(item.repoId) ?? 'unknown',
    labels: parseJsonArray(item.labels),
    userTags: parseJsonArray(item.userTags),
  }))

  return NextResponse.json({
    items: enriched,
    total,
    page,
    pageSize,
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
