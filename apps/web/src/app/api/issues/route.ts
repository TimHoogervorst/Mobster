import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { issues, githubRepos } from '@mobster/db'
import { eq, and, like, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const { searchParams } = request.nextUrl

  const repoId = searchParams.get('repo')
  const issueType = searchParams.get('type')
  const state = searchParams.get('state') ?? 'open'
  const label = searchParams.get('label')
  const query = searchParams.get('q')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)))
  const sort = searchParams.get('sort') ?? 'githubUpdatedAt'
  const order = searchParams.get('order') ?? 'desc'

  // Build conditions
  const conditions = []

  if (repoId) conditions.push(eq(issues.repoId, repoId))
  if (issueType) conditions.push(eq(issues.issueType, issueType as any))
  if (state) conditions.push(eq(issues.state, state as any))
  if (label) {
    // Labels stored as JSON array string — search with LIKE
    conditions.push(like(issues.labels, `%${label}%`))
  }
  if (query) {
    conditions.push(
      like(issues.title, `%${query}%`),
    )
    // Note: SQLite LIKE is case-insensitive by default for ASCII
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  // Get total count
  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(issues)
    .where(where)
    .get()

  const total = countResult?.count ?? 0

  // Get paginated results
  const sortColumn = sort === 'title' ? issues.title : issues.githubUpdatedAt
  const sortDir = order === 'asc' ? sql`ASC` : sql`DESC`

  const rows = db
    .select()
    .from(issues)
    .where(where)
    .orderBy(sort === 'asc' ? sortColumn : sql`${sortColumn} DESC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  // Enrich with repo full name
  const repos = db.select().from(githubRepos).all()
  const repoMap = new Map(repos.map((r) => [r.id, r.fullName]))

  const enrichedIssues = rows.map((issue) => ({
    ...issue,
    repoFullName: repoMap.get(issue.repoId) ?? 'unknown',
    labels: parseLabels(issue.labels),
    userTags: parseLabels(issue.userTags),
  }))

  return NextResponse.json({
    issues: enrichedIssues,
    total,
    page,
    pageSize,
  })
}

function parseLabels(labels: string | null): string[] {
  if (!labels) return []
  try {
    return JSON.parse(labels)
  } catch {
    return []
  }
}
