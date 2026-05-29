import { auth } from '@/lib/auth'
import { CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export async function GithubConnectionStatus() {
  const session = await auth()
  const isConnected = !!session?.accessToken

  return (
    <div className="rounded-lg border p-6">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        GitHub Connection
      </h3>

      {isConnected ? (
        <div className="mt-4 flex items-center gap-4">
          {session?.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.name ?? 'User'}
              className="h-12 w-12 rounded-full border"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium">
                Connected as @{session?.user?.name ?? 'unknown'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Repos and issues can be synced. Token is encrypted at rest.
            </p>
          </div>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Reconnect
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">No GitHub account connected</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Enter your Personal Access Token to sync repos and manage issues.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect GitHub Account
          </Link>
        </div>
      )}
    </div>
  )
}
