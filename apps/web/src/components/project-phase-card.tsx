'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  GripVertical,
  Bug,
  Lightbulb,
  GitPullRequest,
  FileText,
  ExternalLink,
  X,
} from 'lucide-react'

interface PhaseItem {
  id: string
  itemId: string
  sortOrder: number
  status: string
  prdId: string | null
  sourceProjectId: string | null
  displayTitle: string
  displayNumber: number | null
  itemType: string | null
  itemSource: string | null
  itemSize: string | null
  itemStatus: string | null
  requiresReview: number | null
  sourceUrl: string | null
  headBranch: string | null
  baseBranch: string | null
  isDraft: number | null
}

interface PhaseCardProps {
  phase: {
    id: string
    name: string
    description: string | null
    phaseType: string
    status: string
    gateCriteria: string | null
  }
  items: PhaseItem[]
  projectId: string
}

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
  bug: <Bug className="h-3.5 w-3.5 text-red-500" />,
  feature: <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />,
  pull_request: <GitPullRequest className="h-3.5 w-3.5 text-blue-500" />,
  task: <FileText className="h-3.5 w-3.5 text-muted-foreground" />,
}

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  integrated: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  tested: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  passed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  on_hold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
}

const PHASE_TYPE_LABELS: Record<string, string> = {
  integration: 'Integration',
  testing: 'Testing',
  review: 'Review',
}

export function ProjectPhaseCard({
  phase,
  items,
  projectId,
}: PhaseCardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()

  async function updateItemStatus(itemId: string, newStatus: string) {
    try {
      await fetch(`/api/projects/${projectId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      router.refresh()
    } catch (err) {
      console.error('Failed to update item status:', err)
    }
  }

  async function removeItem(itemId: string) {
    if (!confirm('Remove this item from the phase?')) return
    try {
      await fetch(`/api/projects/${projectId}/items/${itemId}`, {
        method: 'DELETE',
      })
      router.refresh()
    } catch (err) {
      console.error('Failed to remove item:', err)
    }
  }

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{phase.name}</h3>
            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {PHASE_TYPE_LABELS[phase.phaseType] ?? phase.phaseType}
            </span>
          </div>
          {phase.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {phase.description}
            </p>
          )}
        </div>

        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          phase.status === 'active'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : phase.status === 'passed'
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : phase.status === 'failed'
                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        }`}>
          {phase.status}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t">
          {/* Gate criteria */}
          {phase.gateCriteria && (
            <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-950/30 border-b text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Gate:</strong> {phase.gateCriteria}
            </div>
          )}

          {/* Items */}
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No items in this phase yet.
            </div>
          ) : (
            <div>
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-accent/30 transition-colors ${
                    index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'
                  }`}
                >
                  <span className="text-xs text-muted-foreground w-6 text-center flex-shrink-0">
                    {index + 1}
                  </span>

                  <span className="flex-shrink-0">
                    {ITEM_TYPE_ICONS[item.itemType ?? 'task'] ?? (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:text-primary transition-colors truncate flex items-center gap-1"
                        >
                          {item.displayNumber != null && (
                            <span className="text-muted-foreground">
                              #{item.displayNumber}
                            </span>
                          )}
                          {item.displayTitle}
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-sm font-medium truncate">
                          {item.displayTitle}
                        </span>
                      )}

                      {item.itemSize && (
                        <span className="text-xs text-muted-foreground uppercase bg-muted px-1 rounded flex-shrink-0">
                          {item.itemSize}
                        </span>
                      )}

                      {item.sourceProjectId && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                          ← cross-project
                        </span>
                      )}
                    </div>

                    {item.headBranch && item.baseBranch && (
                      <span className="text-xs text-muted-foreground">
                        {item.baseBranch} ← {item.headBranch}
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <select
                    value={item.status}
                    onChange={(e) => updateItemStatus(item.id, e.target.value)}
                    className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer ${STATUS_BADGES[item.status] ?? ''}`}
                  >
                    {Object.keys(STATUS_BADGES).map((s) => (
                      <option key={s} value={s}>
                        {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>

                  {/* Action buttons */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    title="Remove from phase"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add item footer */}
          <div className="px-4 py-2 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">
              + Add item (use API: POST /api/projects/{projectId}/items)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
