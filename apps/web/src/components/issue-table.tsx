'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PrdGenerateButton } from './prd-generate-button'

interface IssueRow {
  id: string
  number: number
  title: string
  state: 'open' | 'closed'
  issueType: 'bug' | 'feature' | 'question' | 'other' | null
  labels: string[]
  repoFullName: string
  assignee: string | null
  githubUpdatedAt: string
  prdId?: string | null
}

interface IssueTableProps {
  issues: IssueRow[]
}

const TYPE_ICONS: Record<string, string> = {
  bug: '🐛',
  feature: '✨',
  question: '❓',
  other: '📋',
}

export function IssueTable({ issues }: IssueTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const eligibleIssues = issues.filter((i) => !i.prdId)

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
    if (selectedIds.size === eligibleIssues.length && eligibleIssues.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(eligibleIssues.map((i) => i.id)))
    }
  }

  if (issues.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">No issues found.</p>
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
                  eligibleIssues.length > 0 &&
                  selectedIds.size === eligibleIssues.length
                }
                disabled={eligibleIssues.length === 0}
                onChange={toggleAll}
                className="rounded border-input"
                title={
                  eligibleIssues.length === 0
                    ? 'No eligible issues to select'
                    : selectedIds.size === eligibleIssues.length
                      ? 'Deselect all'
                      : 'Select all'
                }
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-8">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Issue
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Repo
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Labels
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Assignee
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Updated
            </th>
            <th className="px-4 py-3 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => {
            const isSelected = selectedIds.has(issue.id)
            const isLinked = !!issue.prdId

            return (
              <tr
                key={issue.id}
                className={`border-b hover:bg-accent/50 transition-colors ${
                  isSelected ? 'bg-accent/30' : ''
                }`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isLinked}
                    onChange={() => toggleSelect(issue.id)}
                    className="rounded border-input disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      isLinked
                        ? 'Already in a PRD'
                        : isSelected
                          ? 'Deselect issue'
                          : 'Select issue'
                    }
                  />
                </td>
                <td className="px-4 py-3 text-sm">
                  <span title={issue.issueType ?? 'other'}>
                    {TYPE_ICONS[issue.issueType ?? 'other'] ?? '📋'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/issues/${issue.id}`}
                    className="text-sm font-medium hover:text-primary transition-colors"
                  >
                    <span className="text-muted-foreground">
                      #{issue.number}
                    </span>{' '}
                    {issue.title}
                  </Link>
                  {issue.prdId && (
                    <Link
                      href={`/prds/${issue.prdId}`}
                      className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 hover:underline"
                    >
                      In PRD →
                    </Link>
                  )}
                  {issue.state === 'closed' && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                      Closed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {issue.repoFullName}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {issue.labels.slice(0, 3).map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                      >
                        {label}
                      </span>
                    ))}
                    {issue.labels.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{issue.labels.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {issue.assignee ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground text-right whitespace-nowrap">
                  {formatDate(issue.githubUpdatedAt)}
                </td>
                <td className="px-2 py-3">
                  {!issue.prdId && (
                    <PrdGenerateButton
                      issueIds={[issue.id]}
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
            {selectedIds.size} issue{selectedIds.size !== 1 ? 's' : ''} selected
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
