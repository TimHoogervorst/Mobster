'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { PrdStatusBadge } from './prd-status-badge'

interface PrdRow {
  id: string
  title: string
  status: string
  version: number
  issueCount: number
  agentName: string | null
  agentModel: string | null
  createdAt: string
  updatedAt: string
}

interface PrdListProps {
  initialPrds: PrdRow[]
  showCombine?: boolean
}

export function PrdList({ initialPrds, showCombine = true }: PrdListProps) {
  const [prds, setPrds] = useState<PrdRow[]>(initialPrds)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this PRD? Comments and issue links will be removed.')) return

    setDeleting((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/prds/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPrds((prev) => prev.filter((p) => p.id !== id))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    } catch {
      // ignore
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const toggleAll = () => {
    if (selectedIds.size === prds.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(prds.map((p) => p.id)))
    }
  }

  if (prds.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">No PRDs yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a PRD from the Inbox to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            {showCombine && (
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={selectedIds.size === prds.length && prds.length > 0}
                  onChange={toggleAll}
                  className="rounded border-input"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              PRD
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Issues
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Agent
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Updated
            </th>
            <th className="px-4 py-3 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {prds.map((prd) => (
            <tr
              key={prd.id}
              className="border-b hover:bg-accent/50 transition-colors"
            >
              {showCombine && (
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(prd.id)}
                    onChange={() => toggleSelect(prd.id)}
                    className="rounded border-input"
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <Link
                  href={`/prds/${prd.id}`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  {prd.title}
                </Link>
                {prd.version > 1 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    v{prd.version}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <PrdStatusBadge status={prd.status} />
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {prd.issueCount} issue{prd.issueCount !== 1 ? 's' : ''}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {prd.agentName ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground text-right whitespace-nowrap">
                {formatDate(prd.updatedAt)}
              </td>
              <td className="px-2 py-3">
                <button
                  onClick={() => handleDelete(prd.id)}
                  disabled={deleting.has(prd.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  title="Delete PRD"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Selected count for combine */}
      {showCombine && selectedIds.size >= 2 && (
        <div className="border-t bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
          {selectedIds.size} PRD{selectedIds.size !== 1 ? 's' : ''} selected — combine coming in next update
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
