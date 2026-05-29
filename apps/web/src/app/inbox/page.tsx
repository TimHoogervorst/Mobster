import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { issues, githubRepos, prdIssues } from '@mobster/db'
import { and, eq, like, sql, inArray } from 'drizzle-orm'
import { IssueTable } from '@/components/issue-table'
import { IssueFilters } from '@/components/issue-filters'
import { EmptyState } from '@/components/empty-state'
import Link from 'next/link'

interface InboxPageProps {
  searchParams: Promise<{
    repo?: string; type?: string; state?: string; label?: string
    q?: string; page?: string; pageSize?: string; sort?: string; order?: string
  }>
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const session = await auth()

  if (!session?.accessToken) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Triage and manage issues across all connected repositories.
          </p>
        </div>
        <EmptyState
          icon="🔗"
          title="Connect GitHub to see issues"
          description="Enter your Personal Access Token to start syncing issues."
          action={{ label: 'Connect GitHub', href: '/login' }}
        />
      </div>
    )
  }

  const db = getDb()
  const params = await searchParams

  const repoId = params.repo
  const issueType = params.type
  const state = params.state ?? 'open'
  const label = params.label
  const query = params.q
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? '20', 10)))
  const sort = params.sort ?? 'githubUpdatedAt'
  const order = params.order ?? 'desc'

  const conditions = []
  if (repoId) conditions.push(eq(issues.repoId, repoId))
  if (issueType) conditions.push(eq(issues.issueType, issueType as any))
  if (state) conditions.push(eq(issues.state, state as any))
  if (label) conditions.push(like(issues.labels, `%${label}%`))
  if (query) conditions.push(like(issues.title, `%${query}%`))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const countResult = db.select({ count: sql<number>`count(*)` }).from(issues).where(where).get()
  const total = countResult?.count ?? 0
  const repos = db.select().from(githubRepos).all()

  const sortColumn = sort === 'title' ? issues.title : issues.githubUpdatedAt
  const rows = db
    .select().from(issues).where(where)
    .orderBy(sort === 'asc' ? sortColumn : sql`${sortColumn} DESC`)
    .limit(pageSize).offset((page - 1) * pageSize)
    .all()

  const repoMap = new Map(repos.map((r) => [r.id, r.fullName]))

  // Check which issues are already in a PRD
  const prdLinks =
    rows.length > 0
      ? db.select().from(prdIssues).where(inArray(prdIssues.issueId, rows.map((r) => r.id))).all()
      : []
  const prdLinkMap = new Map(prdLinks.map((pl) => [pl.issueId, pl.prdId]))

  const enrichedIssues = rows.map((issue) => ({
    ...issue,
    repoFullName: repoMap.get(issue.repoId) ?? 'unknown',
    labels: parseLabels(issue.labels),
    userTags: parseLabels(issue.userTags),
    githubUpdatedAt: issue.githubUpdatedAt ?? issue.githubCreatedAt ?? new Date().toISOString(),
    prdId: prdLinkMap.get(issue.id) ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <p className="text-muted-foreground mt-1">
          {total} issue{total !== 1 ? 's' : ''} across {repos.length} repo{repos.length !== 1 ? 's' : ''}
        </p>
      </div>
      {repos.length === 0 ? (
        <EmptyState icon="📦" title="No repositories synced"
          description="Go to Repos to connect a repository and sync its issues."
          action={{ label: 'Go to Repos', href: '/repos' }} />
      ) : (
        <>
          <IssueFilters repos={repos.map((r) => ({ id: r.id, fullName: r.fullName }))} />
          <IssueTable issues={enrichedIssues} />
          {total > pageSize && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/inbox?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
                    className="rounded-md border px-3 py-1.5 hover:bg-accent transition-colors">Previous</Link>
                )}
                {page * pageSize < total && (
                  <Link href={`/inbox?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
                    className="rounded-md border px-3 py-1.5 hover:bg-accent transition-colors">Next</Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function parseLabels(labels: string | null): string[] {
  if (!labels) return []
  try { return JSON.parse(labels) } catch { return [] }
}
