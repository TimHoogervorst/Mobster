'use client'

import { useState } from 'react'
import { Search, Check, Loader2 } from 'lucide-react'

interface Repo {
  id: number
  fullName: string
  owner: string
  name: string
  description: string | null
  language: string | null
  stars: number
  connected: boolean
}

interface RepoSelectorProps {
  repos: Repo[]
}

export function RepoSelector({ repos }: RepoSelectorProps) {
  const [search, setSearch] = useState('')
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(
    new Set(repos.filter((r) => r.connected).map((r) => r.fullName)),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase()),
  )

  const toggleRepo = (fullName: string) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) {
        next.delete(fullName)
      } else {
        next.add(fullName)
      }
      return next
    })
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const toSave = repos
      .filter((r) => selectedRepos.has(r.fullName) && !r.connected)
      .map((r) => ({ owner: r.owner, name: r.name, fullName: r.fullName }))

    const toRemove = repos
      .filter((r) => !selectedRepos.has(r.fullName) && r.connected)
      .map((r) => r.fullName)

    try {
      // Save new repos
      if (toSave.length > 0) {
        const res = await fetch('/api/repos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repos: toSave }),
        })
        if (!res.ok) throw new Error('Failed to save repos')
      }

      // TODO: Handle repo removal (DELETE endpoint exists but needs connectedRepoId)

      setSaved(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const connectedCount = repos.filter((r) => r.connected).length
  const selectedCount = selectedRepos.size

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || selectedCount === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving...' : `Save Selection (${selectedCount})`}
        </button>
      </div>

      {saved && (
        <p className="text-sm text-green-600">Selection saved successfully.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="max-h-96 overflow-y-auto rounded-lg border">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">
            No repositories found.
          </p>
        ) : (
          filtered.map((repo) => (
            <label
              key={repo.fullName}
              className={`flex items-center gap-3 border-b p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                selectedRepos.has(repo.fullName) ? 'bg-accent/30' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedRepos.has(repo.fullName)}
                onChange={() => toggleRepo(repo.fullName)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{repo.fullName}</span>
                  {repo.connected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
                      <Check className="h-3 w-3" />
                      Connected
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {repo.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {repo.language && <span>{repo.language}</span>}
                  <span>⭐ {repo.stars}</span>
                </div>
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  )
}
