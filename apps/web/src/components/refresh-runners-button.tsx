'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'

export function RefreshRunnersButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  const handleRefresh = async () => {
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/runners/refresh', { method: 'POST' })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to refresh')
      }

      const data = await res.json()
      if (data.repaired > 0) {
        setResult(`Repaired ${data.repaired} stuck session(s)`)
      } else {
        setResult('All sessions are healthy')
      }

      router.refresh()
    } catch (err: any) {
      setResult(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Refresh status
      </button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  )
}
