'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2 } from 'lucide-react'

interface RepoOption {
  id: string
  fullName: string
  connected: boolean
  connectedRepoId: string | null
}

export function ProjectCreateDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [repoId, setRepoId] = useState('')
  const [repos, setRepos] = useState<RepoOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch only connected repos when dialog opens
  useEffect(() => {
    if (open) {
      fetch('/api/repos')
        .then((r) => r.json())
        .then((data) => {
          const allRepos: RepoOption[] = data.repos ?? []
          // Only show repos that are connected (synced) — they have a DB UUID
          const connected = allRepos.filter((r) => r.connected && r.connectedRepoId)
          setRepos(connected)
          if (connected.length === 0) {
            setError('No synced repositories. Go to Repos to connect one first.')
          }
        })
        .catch(() => setRepos([]))
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !repoId) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, repoId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create project')
        return
      }

      const project = await res.json()
      setOpen(false)
      setName('')
      setDescription('')
      setRepoId('')
      router.push(`/projects/${project.id}`)
      router.refresh()
    } catch (err) {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setName('')
    setDescription('')
    setRepoId('')
    setError('')
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        New Project
      </button>

      {/* Modal backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div className="relative z-50 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Project</h2>
              <button
                onClick={handleClose}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="project-name" className="block text-sm font-medium mb-1">
                  Name
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Release v1.1"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="project-desc" className="block text-sm font-medium mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="project-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this release about?"
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label htmlFor="project-repo" className="block text-sm font-medium mb-1">
                  Repository
                </label>
                <select
                  id="project-repo"
                  value={repoId}
                  onChange={(e) => setRepoId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select a repo...</option>
                  {repos.map((r) => (
                    <option key={r.connectedRepoId} value={r.connectedRepoId!}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim() || !repoId}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
