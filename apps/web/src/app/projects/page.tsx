import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { projects, projectPhases, projectItems, githubRepos, buildJobs } from '@mobster/db'
import { eq, sql, and, inArray } from 'drizzle-orm'
import { ProjectList } from '@/components/project-list'
import { ProjectCreateDialog } from '@/components/project-create-dialog'
import { EmptyState } from '@/components/empty-state'

export default async function ProjectsPage() {
  const session = await auth()

  if (!session?.accessToken) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Organize your work into release plans with phases and gates.
          </p>
        </div>
        <EmptyState
          icon="🔗"
          title="Connect GitHub to manage projects"
          description="Enter your Personal Access Token to start managing projects."
          action={{ label: 'Connect GitHub', href: '/login' }}
        />
      </div>
    )
  }

  const db = getDb()

  const allProjects = db
    .select()
    .from(projects)
    .orderBy(sql`${projects.updatedAt} DESC`)
    .all()

  const repos = db.select().from(githubRepos).all()
  const repoMap = new Map(repos.map((r) => [r.id, r]))

  const enriched = allProjects.map((p) => {
    const repo = repoMap.get(p.repoId)

    const phaseCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(projectPhases)
        .where(eq(projectPhases.projectId, p.id))
        .get()?.count ?? 0

    const completedPhaseCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(projectPhases)
        .where(
          and(
            eq(projectPhases.projectId, p.id),
            eq(projectPhases.status, 'passed'),
          ),
        )
        .get()?.count ?? 0

    const itemCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(projectItems)
        .where(eq(projectItems.projectId, p.id))
        .get()?.count ?? 0

    const stats =
      p.status === 'complete' || p.status === 'archived'
        ? null
        : {
            running:
              db
                .select({ count: sql<number>`count(*)` })
                .from(buildJobs)
                .innerJoin(
                  projectItems,
                  eq(buildJobs.projectItemId, projectItems.id),
                )
                .where(
                  and(
                    eq(projectItems.projectId, p.id),
                    eq(buildJobs.status, 'running'),
                  ),
                )
                .get()?.count ?? 0,
            needsReview:
              db
                .select({ count: sql<number>`count(*)` })
                .from(projectItems)
                .where(
                  and(
                    eq(projectItems.projectId, p.id),
                    eq(projectItems.status, 'in_progress'),
                  ),
                )
                .get()?.count ?? 0,
            done:
              db
                .select({ count: sql<number>`count(*)` })
                .from(projectItems)
                .where(
                  and(
                    eq(projectItems.projectId, p.id),
                    inArray(projectItems.status, ['integrated', 'tested', 'passed']),
                  ),
                )
                .get()?.count ?? 0,
            onHold:
              db
                .select({ count: sql<number>`count(*)` })
                .from(projectItems)
                .where(
                  and(
                    eq(projectItems.projectId, p.id),
                    eq(projectItems.status, 'on_hold'),
                  ),
                )
                .get()?.count ?? 0,
          }

    return {
      ...p,
      repoFullName: repo?.fullName ?? 'unknown',
      phaseCount,
      completedPhaseCount,
      itemCount,
      stats,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            {allProjects.length} project{allProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ProjectCreateDialog />
      </div>

      {allProjects.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No projects yet"
          description="Create a project to organize issues and PRs into a release plan with phases."
        />
      ) : (
        <ProjectList projects={enriched} />
      )}
    </div>
  )
}
