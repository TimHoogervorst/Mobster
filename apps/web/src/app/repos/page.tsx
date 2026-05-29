import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { githubRepos, issues } from '@mobster/db'
import { eq, sql } from 'drizzle-orm'
import { createGitHubClient } from '@/lib/github'
import { RepoSelector } from '@/components/repo-selector'
import { RepoSyncButton } from '@/components/repo-sync-button'
import { EmptyState } from '@/components/empty-state'
import { Star } from 'lucide-react'

export default async function ReposPage() {
  const session = await auth()
  const db = getDb()

  // Get connected repos
  const connectedRepos = db.select().from(githubRepos).all()

  // Get issue counts per repo
  const repoIssueCounts = new Map<string, number>()
  for (const repo of connectedRepos) {
    const count = db
      .select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(eq(issues.repoId, repo.id))
      .get()
    repoIssueCounts.set(repo.id, count?.count ?? 0)
  }

  // Fetch GitHub repos if user is connected
  let githubReposList: any[] = []
  if (session?.accessToken) {
    try {
      const gh = createGitHubClient(session.accessToken)
      const repos = await gh.listRepos()
      githubReposList = repos.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        owner: r.owner,
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stars,
        connected: connectedRepos.some((cr) => cr.fullName === r.fullName),
      }))
    } catch (error) {
      console.error('Failed to fetch GitHub repos:', error)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Repositories</h1>
        <p className="text-muted-foreground mt-1">
          Manage your connected GitHub repositories.
        </p>
      </div>

      {/* Repository Management */}
      {session?.accessToken && (
        <div className="space-y-6">
          {/* Connected Repos */}
          <div className="rounded-lg border p-6">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Connected Repositories ({connectedRepos.length})
            </h3>

            {connectedRepos.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No repositories connected"
                description="Connect repositories from the list below to start syncing issues."
              />
            ) : (
              <div className="mt-4 divide-y">
                {connectedRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{repo.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {repo.language ?? 'Unknown'} ·{' '}
                        <Star className="inline h-3 w-3" /> {repo.stars} ·{' '}
                        {repoIssueCounts.get(repo.id) ?? 0} issues synced
                      </p>
                    </div>
                    <RepoSyncButton
                      repoId={repo.id}
                      repoName={repo.fullName}
                      lastSyncedAt={repo.syncedAt}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Repo Selector */}
          {githubReposList.length > 0 && (
            <div className="rounded-lg border p-6">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
                Add Repositories
              </h3>
              <RepoSelector repos={githubReposList} />
            </div>
          )}
        </div>
      )}

      {!session?.accessToken && (
        <EmptyState
          icon="🔗"
          title="Connect GitHub to manage repos"
          description="Enter your Personal Access Token to browse and sync repositories."
          action={{ label: 'Connect GitHub', href: '/login' }}
        />
      )}
    </div>
  )
}
