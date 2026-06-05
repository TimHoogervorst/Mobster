import { notFound } from 'next/navigation'
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
import { eq, or, and, sql } from 'drizzle-orm'
import { ProjectHeader } from '@/components/project-header'
import { ProjectBoard } from '@/components/project-board'
import { EventTimeline } from '@/components/event-timeline'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.accessToken) {
    return <div className="text-muted-foreground">Not authenticated</div>
  }

  const { id } = await params
  const db = getDb()

  const project = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) {
    notFound()
  }

  const repo = db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.id, project.repoId))
    .get()

  // Fetch phases ordered by sortOrder
  const phases = db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, id))
    .orderBy(projectPhases.sortOrder)
    .all()

  // Fetch all project items in one pass
  const allPItems = db
    .select()
    .from(projectItems)
    .where(eq(projectItems.projectId, id))
    .orderBy(projectItems.sortOrder)
    .all()

  // Batch fetch all referenced items
  const allItemIds = [...new Set(allPItems.map((pi) => pi.itemId))]
  const itemRecords =
    allItemIds.length > 0
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
            isDraft: items.isDraft,
          })
          .from(items)
          .where(
            allItemIds.length === 1
              ? eq(items.id, allItemIds[0]!)
              : or(...allItemIds.map((iid) => eq(items.id, iid))),
          )
          .all()
      : []

  const itemMap = new Map(itemRecords.map((it) => [it.id, it]))

  // Group project items by phase, mark the Overview phase
  const phasesWithItems = phases.map((phase, idx) => {
    const isOverview = idx === 0 && phase.name === 'Overview'
    const pItems = allPItems
      .filter((pi) => pi.phaseId === phase.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((pi) => {
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
          isDraft: item?.isDraft ?? null,
        }
      })

    return { ...phase, items: pItems, isOverview }
  })

  // Fetch recent history
  const history = db
    .select()
    .from(eventLog)
    .where(
      or(
        and(eq(eventLog.entityType, 'project'), eq(eventLog.entityId, id)),
        and(
          eq(eventLog.parentEntityType, 'project'),
          eq(eventLog.parentEntityId, id),
        ),
      ),
    )
    .orderBy(sql`${eventLog.createdAt} DESC`)
    .limit(50)
    .all()

  return (
    <div className="space-y-6">
      <ProjectHeader
        project={project}
        repoFullName={repo?.fullName ?? 'unknown'}
      />

      <ProjectBoard
        projectId={id}
        repoId={project.repoId}
        repoFullName={repo?.fullName ?? 'unknown'}
        phases={phasesWithItems}
      />

      <EventTimeline events={history} entityType="project" />
    </div>
  )
}
