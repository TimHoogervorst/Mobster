import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { agentLogs, prds, agents } from '@mobster/db'
import { eq, sql } from 'drizzle-orm'
import { RunnerList } from '@/components/runner-list'
import { RefreshRunnersButton } from '@/components/refresh-runners-button'
import { EmptyState } from '@/components/empty-state'

export default async function RunnersPage() {
  const session = await auth()
  if (!session?.accessToken) {
    return (
      <EmptyState
        icon="🔗"
        title="Connect GitHub first"
        description="Sign in to view runner sessions."
        action={{ label: 'Go to Settings', href: '/settings' }}
      />
    )
  }

  const db = getDb()

  const rows = db
    .select({
      sessionId: agentLogs.sessionId,
      prdId: agentLogs.prdId,
      agentId: agentLogs.agentId,
      eventCount: sql<number>`count(*)`,
      startedAt: sql<string>`min(${agentLogs.createdAt})`,
      lastEventAt: sql<string>`max(${agentLogs.createdAt})`,
    })
    .from(agentLogs)
    .groupBy(agentLogs.sessionId)
    .orderBy(sql`max(${agentLogs.createdAt}) DESC`)
    .all()

  const enriched = rows.map((row) => {
    const prd = db.select().from(prds).where(eq(prds.id, row.prdId)).get()
    const agentName = row.agentId
      ? db.select().from(agents).where(eq(agents.id, row.agentId)).get()?.name ?? null
      : null

    return {
      sessionId: row.sessionId,
      prdId: row.prdId,
      prdTitle: prd?.title ?? 'Unknown PRD',
      prdStatus: prd?.status ?? 'unknown',
      agentName,
      version: prd?.version ?? 1,
      eventCount: row.eventCount,
      startedAt: row.startedAt,
      lastEventAt: row.lastEventAt,
      isActive: prd?.status === 'generating' || prd?.status === 'building',
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Runners</h1>
          <p className="text-muted-foreground mt-1">
            Monitor active agent sessions and browse generation history.
          </p>
        </div>
        <RefreshRunnersButton />
      </div>

      <RunnerList sessions={enriched} />
    </div>
  )
}
