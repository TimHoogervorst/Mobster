import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { items, githubRepos } from '@mobster/db'
import { and, eq, like, sql, inArray } from 'drizzle-orm'
import { ItemTable } from '@/components/item-table'
import { IssueFilters } from '@/components/issue-filters'
import { EmptyState } from '@/components/empty-state'
import { IntakeTabs } from '@/components/intake-tabs'
import Link from 'next/link'

interface IntakePageProps {
  searchParams: Promise<{
    tab?: string
    repo?: string
    type?: string
    state?: string
    label?: string
    size?: string
    q?: string
    page?: string
    pageSize?: string
    sort?: string
    order?: string
  }>
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const session = await auth()

  if (!session?.accessToken) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intake</h1>
          <p className="text-muted-foreground mt-1">
            Triage issues and pull requests across all connected repositories.
          </p>
        </div>
        <EmptyState
          icon="🔗"
          title="Connect GitHub to see your intake"
          description="Enter your Personal Access Token to start syncing issues and pull requests."
          action={{ label: 'Connect GitHub', href: '/login' }}
        />
      </div>
    )
  }

  const db = getDb()
  const params = await searchParams

  const activeTab = params.tab || 'issues'
  const repoId = params.repo
  const itemTypeParam = params.type
  const state = params.state ?? (activeTab === 'prs' ? undefined : 'open')
  const label = params.label
  const size = params.size
  const query = params.q
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? '25', 10)))
  const sort = params.sort ?? 'githubUpdatedAt'
  const order = params.order ?? 'desc'

  // Determine item type filter based on active tab
  const effectiveItemTypes =
    itemTypeParam
      ? itemTypeParam.split(',')
      : activeTab === 'prs'
        ? ['pull_request']
        : ['bug', 'feature', 'question', 'other']

  const conditions = []
  conditions.push(eq(items.source, 'github'))

  if (effectiveItemTypes.length === 1) {
    conditions.push(eq(items.itemType, effectiveItemTypes[0]! as any))
  } else {
    conditions.push(inArray(items.itemType, effectiveItemTypes as any))
  }
  if (repoId) conditions.push(eq(items.repoId, repoId))
  if (state) conditions.push(eq(items.status, state as any))
  if (size) conditions.push(eq(items.size, size as any))
  if (label) conditions.push(like(items.labels, `%${label}%`))
  if (query) conditions.push(like(items.title, `%${query}%`))

  const where = and(...conditions)

  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(where)
    .get()

  const total = countResult?.count ?? 0
  const repos = db.select().from(githubRepos).all()

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

  const repoMap = new Map(repos.map((r) => [r.id, r.fullName]))

  const enrichedItems = rows.map((item) => ({
    ...item,
    repoFullName: repoMap.get(item.repoId) ?? 'unknown',
    labels: parseJsonArray(item.labels),
    userTags: parseJsonArray(item.userTags),
    number: item.number ?? 0,
    githubUpdatedAt: item.githubUpdatedAt ?? item.githubCreatedAt ?? new Date().toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Intake</h1>
        <p className="text-muted-foreground mt-1">
          {total} item{total !== 1 ? 's' : ''} across {repos.length} repo{repos.length !== 1 ? 's' : ''}
        </p>
      </div>

      <IntakeTabs activeTab={activeTab} />

      {repos.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No repositories synced"
          description="Go to Repos to connect a repository and sync its issues and pull requests."
          action={{ label: 'Go to Repos', href: '/repos' }}
        />
      ) : (
        <>
          <IssueFilters
            repos={repos.map((r) => ({ id: r.id, fullName: r.fullName }))}
          />
          <ItemTable items={enrichedItems} />
          {total > pageSize && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of{' '}
                {total}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/intake?${new URLSearchParams({ ...params, tab: activeTab, page: String(page - 1) })}`}
                    className="rounded-md border px-3 py-1.5 hover:bg-accent transition-colors"
                  >
                    Previous
                  </Link>
                )}
                {page * pageSize < total && (
                  <Link
                    href={`/intake?${new URLSearchParams({ ...params, tab: activeTab, page: String(page + 1) })}`}
                    className="rounded-md border px-3 py-1.5 hover:bg-accent transition-colors"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function parseJsonArray(str: string | null): string[] {
  if (!str) return []
  try {
    return JSON.parse(str)
  } catch {
    return []
  }
}
