'use client'

import { useState } from 'react'
import { Plus, X, FilePlus, Download, Loader2 } from 'lucide-react'

interface Props {
  projectId: string
  phaseId: string
  repoId: string
  onAdded?: () => void
}

export function ProjectAddTaskDialog({ projectId, phaseId, repoId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'choose' | 'new' | 'import'>('choose')

  function handleClose() {
    setOpen(false)
    setMode('choose')
  }

  function handleAdded() {
    setOpen(false)
    setMode('choose')
    onAdded?.()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Task
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />

          <div className="relative z-50 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {mode === 'choose' ? 'Add Task' : mode === 'new' ? 'New Task' : 'Import from Intake'}
              </h2>
              <button
                onClick={handleClose}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {mode === 'choose' && (
              <div className="space-y-3">
                <button
                  onClick={() => setMode('new')}
                  className="w-full flex items-center gap-3 rounded-lg border p-4 text-left hover:border-primary hover:bg-accent/50 transition-colors"
                >
                  <FilePlus className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Create New Task</p>
                    <p className="text-xs text-muted-foreground">Write a title and description for a custom task</p>
                  </div>
                </button>
                <button
                  onClick={() => setMode('import')}
                  className="w-full flex items-center gap-3 rounded-lg border p-4 text-left hover:border-primary hover:bg-accent/50 transition-colors"
                >
                  <Download className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Import from Intake</p>
                    <p className="text-xs text-muted-foreground">Pull in open issues or PRs from the Intake Hub</p>
                  </div>
                </button>
              </div>
            )}

            {mode === 'new' && (
              <CreateTaskForm
                projectId={projectId}
                phaseId={phaseId}
                repoId={repoId}
                onAdded={handleAdded}
                onCancel={() => setMode('choose')}
              />
            )}

            {mode === 'import' && (
              <ImportFromIntakeForm
                projectId={projectId}
                phaseId={phaseId}
                repoId={repoId}
                onAdded={handleAdded}
                onCancel={() => setMode('choose')}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Create New Task Form ──────────────────────────

function CreateTaskForm({
  projectId,
  phaseId,
  repoId,
  onAdded,
  onCancel,
}: {
  projectId: string
  phaseId: string
  repoId: string
  onAdded: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [itemType, setItemType] = useState<string>('task')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/projects/${projectId}/items/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          itemType,
          phaseId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create task')
        return
      }

      onAdded()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <div className="flex gap-2">
          {[
            { value: 'bug', label: 'Bug' },
            { value: 'feature', label: 'Feature' },
            { value: 'task', label: 'Task' },
            { value: 'pull_request', label: 'PR' },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setItemType(t.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${
                itemType === t.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-input hover:border-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="task-title" className="block text-sm font-medium mb-1">Title</label>
        <input
          id="task-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          required
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="task-desc" className="block text-sm font-medium mb-1">Description (optional)</label>
        <textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any details..."
          rows={2}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          Back
        </button>
        <button type="submit" disabled={loading || !title.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create
        </button>
      </div>
    </form>
  )
}

// ─── Import from Intake Form ───────────────────────

function ImportFromIntakeForm({
  projectId,
  phaseId,
  repoId,
  onAdded,
  onCancel,
}: {
  projectId: string
  phaseId: string
  repoId: string
  onAdded: () => void
  onCancel: () => void
}) {
  const [items, setItems] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Fetch open intake items from same repo
  useState(() => {
    const params = new URLSearchParams({
      source: 'github',
      repo: repoId,
      status: 'open',
      pageSize: '50',
    })
    fetch(`/api/items?${params}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setError('Failed to load intake items'))
      .finally(() => setFetching(false))
  })

  const filtered = search
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items

  function toggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  async function handleImport() {
    if (selectedIds.size === 0) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/projects/${projectId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [...selectedIds].map((itemId) => ({ itemId, phaseId })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to import items')
        return
      }

      onAdded()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search intake..."
        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {fetching ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading intake items...</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {search ? 'No matching items' : 'No open items in this repo'}
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto border rounded-md">
          {filtered.map((item) => (
            <label
              key={item.id}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 border-b last:border-b-0 transition-colors ${
                selectedIds.has(item.id) ? 'bg-accent/30' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggle(item.id)}
                className="rounded border-input"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">
                  <span className="text-muted-foreground">#{item.number}</span>{' '}
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.itemType} · {item.source}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {selectedIds.size} selected
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            Back
          </button>
          <button onClick={handleImport} disabled={loading || selectedIds.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
