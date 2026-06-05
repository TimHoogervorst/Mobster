'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GitPullRequestDraft, GitPullRequest, GitMerge, ExternalLink } from 'lucide-react'
import { PrdGenerateButton } from './prd-generate-button'

interface ItemRow {
  id: string
  number: number | null
  title: string
  status: string
  itemType: string
  source: string
  size?: string | null
  labels: string[]
  repoFullName: string
  assignee: string | null
  author?: string | null
  headBranch?: string | null
  baseBranch?: string | null
  isDraft?: number | null
  sourceUrl?: string | null
  githubUpdatedAt: string
  prdId?: string | null
}

interface ItemTableProps {
  items: ItemRow[]
}

const TYPE_ICONS: Record<string, string> = {
  bug: '🐛',
  feature: '✨',
  question: '❓',
  task: '📋',
  other: '📋',
}

export function ItemTable({ items }: ItemTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedIds(new Set())
  }, [items])

  const eligibleItems = items.filter(
    (i) => !i.prdId && i.itemType !== 'pull_request',
  )

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
    if (
      selectedIds.size === eligibleItems.length &&
      eligibleItems.length > 0
    ) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(eligibleItems.map((i) => i.id)))
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">No items found.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try adjusting your filters or sync a repository from Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-3 w-8">
              <input
                type="checkbox"
                checked={
                  eligibleItems.length > 0 &&
                  selectedIds.size === eligibleItems.length
                }
                disabled={eligibleItems.length === 0}
                onChange={toggleAll}
                className="rounded border-input"
                title={
                  eligibleItems.length === 0
                    ? 'No eligible items to select'
                    : 'Select all'
                }
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-8">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Title
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Repo
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Labels
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {items.some((i) => i.itemType === 'pull_request') ? 'Author' : 'Assignee'}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Updated
            </th>
            <th className="px-4 py-3 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id)
            const isLinked = !!item.prdId
            const isPR = item.itemType === 'pull_request'

            return (
              <tr
                key={item.id}
                className={`border-b hover:bg-accent/50 transition-colors ${
                  isSelected ? 'bg-accent/30' : ''
                }`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isLinked || isPR}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-input disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      isPR
                        ? 'Pull requests cannot be selected for PRD generation'
                        : isLinked
                          ? 'Already in a PRD'
                          : isSelected
                            ? 'Deselect'
                            : 'Select'
                    }
                  />
                </td>
                <td className="px-4 py-3 text-sm">
                  {isPR ? (
                    <PRStatusIcon
                      status={item.status}
                      isDraft={!!item.isDraft}
                    />
                  ) : (
                    <span title={item.itemType ?? 'other'}>
                      {TYPE_ICONS[item.itemType ?? 'other'] ?? '📋'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isPR ? (
                      <a
                        href={item.sourceUrl ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <span className="text-muted-foreground">
                          #{item.number}
                        </span>{' '}
                        {item.title}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    ) : (
                      <Link
                        href={`/issues/${item.id}`}
                        className="text-sm font-medium hover:text-primary transition-colors"
                      >
                        <span className="text-muted-foreground">
                          #{item.number}
                        </span>{' '}
                        {item.title}
                      </Link>
                    )}
                    {item.prdId && (
                      <Link
                        href={`/prds/${item.prdId}`}
                        className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 hover:underline"
                      >
                        In PRD →
                      </Link>
                    )}
                    {item.status === 'closed' && !isPR && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                        Closed
                      </span>
                    )}
                    {isPR && item.headBranch && item.baseBranch && (
                      <span className="text-xs text-muted-foreground">
                        {item.baseBranch} ← {item.headBranch}
                      </span>
                    )}
                    {item.size && (
                      <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground uppercase">
                        {item.size}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {item.repoFullName}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {item.labels.slice(0, 3).map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                      >
                        {label}
                      </span>
                    ))}
                    {item.labels.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{item.labels.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {item.assignee ?? item.author ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground text-right whitespace-nowrap">
                  {formatDate(item.githubUpdatedAt)}
                </td>
                <td className="px-2 py-3">
                  {!isPR && !item.prdId && (
                    <PrdGenerateButton
                      issueIds={[item.id]}
                      label="PRD"
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Bulk action bar */}
      {selectedIds.size >= 1 && (
        <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <PrdGenerateButton
            issueIds={[...selectedIds]}
            label="Generate PRD"
          />
        </div>
      )}
    </div>
  )
}

function PRStatusIcon({
  status,
  isDraft,
}: {
  status: string
  isDraft: boolean
}) {
  if (isDraft) {
    return <GitPullRequestDraft className="h-4 w-4 text-muted-foreground" aria-label="Draft PR" />
  }
  if (status === 'merged') {
    return <GitMerge className="h-4 w-4 text-purple-500" aria-label="Merged" />
  }
  if (status === 'closed') {
    return <GitPullRequest className="h-4 w-4 text-red-500" aria-label="Closed PR" />
  }
  if (status === 'open') {
    return <GitPullRequest className="h-4 w-4 text-green-500" aria-label="Open PR" />
  }
  return <GitPullRequest className="h-4 w-4 text-muted-foreground" />
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString()
}
