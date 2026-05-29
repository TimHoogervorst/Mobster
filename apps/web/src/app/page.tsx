import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { githubRepos, issues } from '@mobster/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()
  const db = getDb()
  const isConfigured = !!session?.accessToken

  let repoCount = 0
  let issueCount = 0
  let lastSynced: string | null = null

  if (isConfigured) {
    const repos = db.select().from(githubRepos).all()
    repoCount = repos.length

    if (repoCount > 0) {
      const countResult = db
        .select({ count: sql<number>`count(*)` })
        .from(issues)
        .get()
      issueCount = countResult?.count ?? 0

      const sorted = repos
        .filter((r) => r.syncedAt)
        .sort((a, b) => new Date(b.syncedAt!).getTime() - new Date(a.syncedAt!).getTime())
      lastSynced = sorted[0]?.syncedAt ?? null
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Welcome to Mobster</h1>
      <p className="mt-4 max-w-lg text-muted-foreground">
        Connect your GitHub repositories, triage issues, generate PRDs with AI, and
        schedule overnight code generation — all from one dashboard.
      </p>

      {/* Not configured — setup prompt */}
      {!isConfigured && (
        <div className="mt-8 rounded-lg border border-primary/50 bg-primary/5 p-6 max-w-md">
          <p className="font-medium">Enter your GitHub Personal Access Token to get started</p>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a token at github.com/settings/tokens with <strong>repo</strong> and{' '}
            <strong>read:user</strong> scopes. Your token is encrypted at rest.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Set Up Now
          </Link>
        </div>
      )}

      {/* Connected but no repos */}
      {isConfigured && repoCount === 0 && (
        <div className="mt-8 rounded-lg border p-6 max-w-md">
          <p className="font-medium">No repositories connected yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to Settings to select which repositories to sync.
          </p>
          <Link
            href="/settings"
            className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      )}

      {/* Connected stats */}
      {isConfigured && repoCount > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-lg">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold">{repoCount}</p>
            <p className="text-xs text-muted-foreground">Repos Connected</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold">{issueCount}</p>
            <p className="text-xs text-muted-foreground">Issues Synced</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold">{lastSynced ? formatSince(lastSynced) : '—'}</p>
            <p className="text-xs text-muted-foreground">Last Sync</p>
          </div>
        </div>
      )}

      {/* Feature cards */}
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard title="Connect Repos" description="Select repositories to sync and manage." href="/settings" icon="🔗" />
        <DashboardCard title="Triage Issues" description="Browse, filter, and annotate issues across all connected repos." href="/inbox" icon="📋" />
        <DashboardCard title="Generate PRDs" description="Let AI draft product requirement documents from issues." href="/prds" icon="🤖" />
        <DashboardCard title="Schedule Builds" description="Queue PRDs for overnight code generation and wake up to open PRs." href="/jobs" icon="🌙" />
        <DashboardCard title="Review Code" description="Review AI-generated pull requests with full control before merging." href="/jobs" icon="✅" />
        <DashboardCard title="Track Progress" description="Monitor issues resolved, PRDs generated, and PRs merged over time." href="/" icon="📊" />
      </div>
    </div>
  )
}

function DashboardCard({
  title, description, href, icon,
}: { title: string; description: string; href: string; icon: string }) {
  return (
    <Link href={href} className="group rounded-lg border p-6 text-left transition-colors hover:border-primary/50 hover:bg-accent/50">
      <span className="text-2xl">{icon}</span>
      <h3 className="mt-3 font-semibold group-hover:text-primary">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  )
}

function formatSince(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin}m`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h`
  return `${Math.floor(diffHours / 24)}d`
}
