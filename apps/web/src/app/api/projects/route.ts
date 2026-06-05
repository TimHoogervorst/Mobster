import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { projects, projectPhases, projectItems, githubRepos, items, buildJobs } from '@mobster/db'
import { eq, sql, and, inArray } from 'drizzle-orm'
import { ProjectCreateInput } from '@mobster/shared'
import { EventLogger } from '@/lib/event-logger'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const { searchParams } = request.nextUrl
  const statusFilter = searchParams.get('status')
  const repoFilter = searchParams.get('repo')

  const conditions = []
  if (statusFilter) conditions.push(eq(projects.status, statusFilter as any))
  if (repoFilter) conditions.push(eq(projects.repoId, repoFilter))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const allProjects = db
    .select()
    .from(projects)
    .where(where)
    .orderBy(sql`${projects.updatedAt} DESC`)
    .all()

  // Enrich with counts
  const repos = db.select().from(githubRepos).all()
  const repoMap = new Map(repos.map((r) => [r.id, r]))

  const enriched = allProjects.map((p) => {
    const repo = repoMap.get(p.repoId)

    // Skip stat queries for finished projects
    const stats =
      p.status === 'complete' || p.status === 'archived'
        ? null
        : getProjectStats(db, p.id)

    return {
      ...p,
      repoFullName: repo?.fullName ?? 'unknown',
      repoOwner: repo?.owner ?? '',
      repoName: repo?.name ?? '',
      phaseCount:
        db
          .select({ count: sql<number>`count(*)` })
          .from(projectPhases)
          .where(eq(projectPhases.projectId, p.id))
          .get()?.count ?? 0,
      completedPhaseCount:
        db
          .select({ count: sql<number>`count(*)` })
          .from(projectPhases)
          .where(
            and(eq(projectPhases.projectId, p.id), eq(projectPhases.status, 'passed')),
          )
          .get()?.count ?? 0,
      itemCount:
        db
          .select({ count: sql<number>`count(*)` })
          .from(projectItems)
          .where(eq(projectItems.projectId, p.id))
          .get()?.count ?? 0,
      stats,
    }
  })

  return NextResponse.json({ projects: enriched })
}

function getProjectStats(
  db: ReturnType<typeof getDb>,
  projectId: string,
): { running: number; needsReview: number; done: number; onHold: number } | null {
  try {
    const running =
      db
        .select({ count: sql<number>`count(*)` })
        .from(buildJobs)
        .innerJoin(projectItems, eq(buildJobs.projectItemId, projectItems.id))
        .where(
          and(eq(projectItems.projectId, projectId), eq(buildJobs.status, 'running')),
        )
        .get()?.count ?? 0

    const needsReview =
      db
        .select({ count: sql<number>`count(*)` })
        .from(projectItems)
        .where(
          and(
            eq(projectItems.projectId, projectId),
            eq(projectItems.status, 'in_progress'),
          ),
        )
        .get()?.count ?? 0

    const done =
      db
        .select({ count: sql<number>`count(*)` })
        .from(projectItems)
        .where(
          and(
            eq(projectItems.projectId, projectId),
            inArray(projectItems.status, ['integrated', 'tested', 'passed']),
          ),
        )
        .get()?.count ?? 0

    const onHold =
      db
        .select({ count: sql<number>`count(*)` })
        .from(projectItems)
        .where(
          and(
            eq(projectItems.projectId, projectId),
            eq(projectItems.status, 'on_hold'),
          ),
        )
        .get()?.count ?? 0

    return { running, needsReview, done, onHold }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = ProjectCreateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const db = getDb()

  // Validate repo exists
  const repo = db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.id, parsed.data.repoId))
    .get()
  if (!repo) {
    return NextResponse.json({ error: 'Repo not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const projectId = uuid()

  db.insert(projects)
    .values({
      id: projectId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: 'draft',
      repoId: parsed.data.repoId,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // Auto-create default "Overview" phase for unassigned items
  const overviewPhaseId = uuid()
  db.insert(projectPhases)
    .values({
      id: overviewPhaseId,
      projectId,
      name: 'Overview',
      description: 'Unsorted tasks — drag into phases below',
      phaseType: 'integration',
      sortOrder: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .run()

  const logger = new EventLogger({ db, entityType: 'project', entityId: projectId })
  logger.log('project.created', {
    summary: `Project "${parsed.data.name}" created`,
    metadata: { repoId: parsed.data.repoId },
  })

  const created = db.select().from(projects).where(eq(projects.id, projectId)).get()
  return NextResponse.json({
    ...created,
    phases: [db.select().from(projectPhases).where(eq(projectPhases.id, overviewPhaseId)).get()],
  }, { status: 201 })
}
