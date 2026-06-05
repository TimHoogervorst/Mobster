'use client'

import { useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'

interface Props {
  projectId: string
  onCreated?: () => void
}

export function ProjectPhaseCreateDialog({ projectId, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phaseType, setPhaseType] = useState<string>('integration')
  const [gateCriteria, setGateCriteria] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleClose() {
    setOpen(false)
    setName('')
    setPhaseType('integration')
    setGateCriteria('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/projects/${projectId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phaseType,
          gateCriteria: gateCriteria.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create phase')
        return
      }

      handleClose()
      onCreated?.()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Phase
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />

          <div className="relative z-50 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Phase</h2>
              <button onClick={handleClose}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="phase-name" className="block text-sm font-medium mb-1">Name</label>
                <input
                  id="phase-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bug Fixes, New Features, Final Review"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <div className="flex gap-2">
                  {[
                    { value: 'integration', label: 'Integration' },
                    { value: 'testing', label: 'Testing' },
                    { value: 'review', label: 'Review' },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setPhaseType(t.value)}
                      className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${
                        phaseType === t.value
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
                <label htmlFor="gate-criteria" className="block text-sm font-medium mb-1">
                  Gate criteria (optional)
                </label>
                <textarea
                  id="gate-criteria"
                  value={gateCriteria}
                  onChange={(e) => setGateCriteria(e.target.value)}
                  placeholder="e.g. All 3 fixes verified, no regression in auth flow"
                  rows={2}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={handleClose}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                  Cancel
                </button>
                <button type="submit" disabled={loading || !name.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Phase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
