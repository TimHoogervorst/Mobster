'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, GitMerge } from 'lucide-react'

interface PrdCombineDialogProps {
  selectedPrds: Array<{ id: string; title: string }>
  onClose: () => void
}

export function PrdCombineDialog({ selectedPrds, onClose }: PrdCombineDialogProps) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCombine = async () => {
    if (!title.trim() || selectedPrds.length < 2) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/prds/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prdIds: selectedPrds.map((p) => p.id),
          title: title.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to combine PRDs')
      }

      router.push(`/prds/${data.prd.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <GitMerge className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Combine PRDs</h2>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Selected PRDs */}
        <div className="mb-4">
          <label className="text-sm font-medium">
            Selected PRDs ({selectedPrds.length})
          </label>
          <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto">
            {selectedPrds.map((prd) => (
              <li key={prd.id} className="text-sm text-muted-foreground truncate">
                • {prd.title}
              </li>
            ))}
          </ul>
        </div>

        {/* Title input */}
        <div className="mb-4">
          <label className="text-sm font-medium">Combined PRD Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for the combined PRD..."
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleCombine}
            disabled={!title.trim() || loading || selectedPrds.length < 2}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <GitMerge className="h-4 w-4" />
            Combine
          </button>
        </div>
      </div>
    </div>
  )
}
