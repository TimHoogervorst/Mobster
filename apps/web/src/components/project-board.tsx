'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, Lightbulb, GitPullRequest, FileText, ExternalLink, GripVertical, X, ChevronDown, ChevronRight } from 'lucide-react'
import { ProjectAddTaskDialog } from './project-add-task-dialog'
import { ProjectPhaseCreateDialog } from './project-phase-create-dialog'

interface ItemData {
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

interface PhaseData {
  id: string
  name: string
  description: string | null
  phaseType: string
  status: string
  gateCriteria: string | null
  items: ItemData[]
  isOverview?: boolean
}

interface Props {
  projectId: string
  repoId: string
  repoFullName: string
  phases: PhaseData[]
}

const ITEM_ICONS: Record<string, React.ReactNode> = {
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

export function ProjectBoard({ projectId, repoId, repoFullName, phases }: Props) {
  const router = useRouter()

  // Find the overview phase (first phase, sortOrder 0)
  const overviewPhase = phases.find((p) => p.isOverview) ?? phases[0]
  const nonOverviewPhases = phases.filter((p) => !p.isOverview && p.id !== overviewPhase?.id)

  function refresh() {
    router.refresh()
  }

  async function updateItemStatus(itemId: string, newStatus: string) {
    try {
      await fetch(`/api/projects/${projectId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      refresh()
    } catch (err) {
      console.error('Failed to update item status:', err)
    }
  }

  async function removeItem(itemId: string) {
    if (!confirm('Remove this item from the project?')) return
    try {
      await fetch(`/api/projects/${projectId}/items/${itemId}`, { method: 'DELETE' })
      refresh()
    } catch (err) {
      console.error('Failed to remove item:', err)
    }
  }

  return (
    <div className="space-y-8">
      {/* ─── Overview Section ─────────────────────────── */}
      {overviewPhase && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Overview
            </h2>
            <ProjectAddTaskDialog
              projectId={projectId}
              phaseId={overviewPhase.id}
              repoId={repoId}
              onAdded={refresh}
            />
          </div>

          {overviewPhase.items.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No tasks yet. Click &ldquo;Add Task&rdquo; to create one or import from Intake.
            </div>
          ) : (
            <div className="rounded-lg border">
              {overviewPhase.items.map((item, i) => (
                <TaskRow
                  key={item.id}
                  item={item}
                  isLast={i === overviewPhase.items.length - 1}
                  projectId={projectId}
                  onStatusChange={updateItemStatus}
                  onRemove={removeItem}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Phase Dividers ───────────────────────────── */}
      {nonOverviewPhases.map((phase) => (
        <PhaseSection
          key={phase.id}
          phase={phase}
          projectId={projectId}
          repoId={repoId}
          onStatusChange={updateItemStatus}
          onRemove={removeItem}
          onRefresh={refresh}
        />
      ))}

      {/* ─── Add Phase Button ─────────────────────────── */}
      <div className="flex justify-center">
        <ProjectPhaseCreateDialog projectId={projectId} onCreated={refresh} />
      </div>
    </div>
  )
}

// ─── Phase Section ──────────────────────────────────

function PhaseSection({
  phase,
  projectId,
  repoId,
  onStatusChange,
  onRemove,
  onRefresh,
}: {
  phase: PhaseData
  projectId: string
  repoId: string
  onStatusChange: (itemId: string, status: string) => void
  onRemove: (itemId: string) => void
  onRefresh: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      {/* Phase divider header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1 border-t" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <h3 className="text-sm font-semibold">{phase.name}</h3>
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {PHASE_TYPE_LABELS[phase.phaseType] ?? phase.phaseType}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            phase.status === 'active'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : phase.status === 'passed'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}>
            {phase.status}
          </span>
        </div>

        <div className="flex-1 border-t" />

        <ProjectAddTaskDialog
          projectId={projectId}
          phaseId={phase.id}
          repoId={repoId}
          onAdded={onRefresh}
        />
      </div>

      {/* Gate criteria */}
      {phase.gateCriteria && !collapsed && (
        <div className="mb-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-3 py-1.5 text-xs text-yellow-800 dark:text-yellow-200">
          <strong>Gate:</strong> {phase.gateCriteria}
        </div>
      )}

      {/* Items */}
      {!collapsed && (
        <>
          {phase.items.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground ml-8">
              No items in this phase. Click &ldquo;Add Task&rdquo; to add one.
            </div>
          ) : (
            <div className="rounded-lg border ml-8">
              {phase.items.map((item, i) => (
                <TaskRow
                  key={item.id}
                  item={item}
                  isLast={i === phase.items.length - 1}
                  projectId={projectId}
                  onStatusChange={onStatusChange}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Task Row ───────────────────────────────────────

function TaskRow({
  item,
  isLast,
  projectId,
  onStatusChange,
  onRemove,
}: {
  item: ItemData
  isLast: boolean
  projectId: string
  onStatusChange: (itemId: string, status: string) => void
  onRemove: (itemId: string) => void
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors ${
        !isLast ? 'border-b' : ''
      }`}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 cursor-grab" />

      <span className="flex-shrink-0">
        {ITEM_ICONS[item.itemType ?? 'task'] ?? <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
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
                <span className="text-muted-foreground">#{item.displayNumber}</span>
              )}
              {item.displayTitle}
              <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </a>
          ) : (
            <span className="text-sm font-medium truncate">{item.displayTitle}</span>
          )}

          {item.itemSize && (
            <span className="text-xs text-muted-foreground uppercase bg-muted px-1 rounded flex-shrink-0">
              {item.itemSize}
            </span>
          )}

          {item.prdId && (
            <a
              href={`/prds/${item.prdId}`}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex-shrink-0"
            >
              PRD →
            </a>
          )}
        </div>

        {item.headBranch && item.baseBranch && (
          <span className="text-xs text-muted-foreground">
            {item.baseBranch} ← {item.headBranch}
          </span>
        )}
      </div>

      {/* Status dropdown */}
      <select
        value={item.status}
        onChange={(e) => onStatusChange(item.id, e.target.value)}
        className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer flex-shrink-0 ${STATUS_BADGES[item.status] ?? ''}`}
      >
        {Object.keys(STATUS_BADGES).map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ')}
          </option>
        ))}
      </select>

      {/* Remove button */}
      <button
        onClick={() => onRemove(item.id)}
        className="p-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
