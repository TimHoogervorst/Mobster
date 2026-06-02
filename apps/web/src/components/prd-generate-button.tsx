'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'

interface PrdGenerateButtonProps {
  issueIds: string[]
  label?: string
  disabled?: boolean
}

export function PrdGenerateButton({
  issueIds,
  label = 'Generate PRD',
  disabled = false,
}: PrdGenerateButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleGenerate = async () => {
    if (!issueIds || issueIds.length === 0) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/prds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(
            `Some issues are already in a PRD: ${data.conflictingIssueIds?.join(', ') ?? 'unknown'}`,
          )
        }
        if (res.status === 400) {
          throw new Error(data.error ?? 'Invalid request')
        }
        throw new Error(data.error ?? 'Failed to generate PRD')
      }

      // Navigate to the new PRD
      router.push(`/prds/${data.prd.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = disabled || loading || !issueIds || issueIds.length === 0

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        onClick={handleGenerate}
        disabled={isDisabled}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {loading
          ? 'Generating...'
          : issueIds && issueIds.length > 1
            ? `${label} (${issueIds.length} issues)`
            : label}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
