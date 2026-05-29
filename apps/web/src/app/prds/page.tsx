import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { prds, prdIssues, agents } from '@mobster/db'
import { eq, sql } from 'drizzle-orm'
import { PrdList } from '@/components/prd-list'
import { EmptyState } from '@/components/empty-state'

export default async function PrdsPage() {
  const session = await auth()
  if (!session?.accessToken) {
    return (
      <EmptyState
        icon="🔗"
        title="Connect GitHub first"
        description="Sign in to access PRDs."
        action={{ label: 'Go to Settings', href: '/settings' }}
      />
    )
  }

  const db = getDb()

  const allPrds = db.select().from(prds).all()

  // Sort by updatedAt desc
  allPrds.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const enriched = allPrds.map((prd) => {
    const linkedCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(prdIssues)
        .where(eq(prdIssues.prdId, prd.id))
        .get()?.count ?? 0

    const agentName = prd.agentId
      ? db.select().from(agents).where(eq(agents.id, prd.agentId)).get()?.name ?? null
      : null

    return {
      id: prd.id,
      title: prd.title,
      status: prd.status,
      version: prd.version,
      issueCount: linkedCount,
      agentName,
      agentModel: prd.agentModel,
      createdAt: prd.createdAt,
      updatedAt: prd.updatedAt,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PRDs</h1>
          <p className="text-muted-foreground mt-1">
            Review, approve, and combine Product Requirement Documents.
          </p>
        </div>
      </div>

      <PrdList initialPrds={enriched} />
    </div>
  )
}
