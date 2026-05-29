'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface StatusButtonProps {
  prdId: string
  status: string
  label: string
}

export function StatusButton({ prdId, status, label }: StatusButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/prds/${prdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update status')
      }

      setDone(true)
      // Refresh the page to show updated status
      window.location.reload()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleClick}
        disabled={loading || done}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {done ? '✓ Done' : label}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
