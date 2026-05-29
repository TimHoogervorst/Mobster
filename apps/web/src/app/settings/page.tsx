import { auth } from '@/lib/auth'
import { GithubConnectionStatus } from '@/components/github-connection-status'
import { EmptyState } from '@/components/empty-state'
import { ThemeToggle } from '@/components/theme-toggle'

export default async function SettingsPage() {
  const session = await auth()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your GitHub connection and app preferences.
        </p>
      </div>

      {/* GitHub Connection Status */}
      <GithubConnectionStatus />

      {!session?.accessToken && (
        <EmptyState
          icon="🔗"
          title="Connect GitHub to get started"
          description="Enter your Personal Access Token to browse and sync repositories."
          action={{ label: 'Connect GitHub', href: '/login' }}
        />
      )}

      {/* Theme */}
      <div className="rounded-lg border p-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Appearance
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose your preferred theme for the app.
        </p>
        <div className="mt-3">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
