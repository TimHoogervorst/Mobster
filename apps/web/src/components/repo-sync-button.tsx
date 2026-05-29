'use client'

import { useState } from 'react'
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface SyncResult {
  created: number
  updated: number
  skipped: number
  syncedAt: string
}

interface RepoSyncButtonProps {
  repoId: string
  repoName: string
  lastSyncedAt: string | null
}

export function RepoSyncButton({ repoId, repoName, lastSyncedAt }: RepoSyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/repos/${repoId}/sync`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Sync failed')
      }
      const data: SyncResult = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return 'Never'
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
      >
        {syncing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>

      {error ? (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </span>
      ) : result ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="h-3 w-3" />
          {result.created} new, {result.updated} updated
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {lastSyncedAt ? `Last synced ${formatTime(lastSyncedAt)}` : 'Never synced'}
        </span>
      )}
    </div>
  )
}
