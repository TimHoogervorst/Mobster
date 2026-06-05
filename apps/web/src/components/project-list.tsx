'use client'

import Link from 'next/link'
import { Activity, Eye, CheckCircle2, PauseCircle } from 'lucide-react'
import { PrdStatusBadge } from './prd-status-badge'

interface ProjectStats {
  running: number
  needsReview: number
  done: number
  onHold: number
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  status: string
  repoFullName: string
  phaseCount: number
  completedPhaseCount: number
  itemCount: number
  stats: ProjectStats | null
  updatedAt: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-400',
  active: 'bg-blue-500',
  testing: 'bg-yellow-500',
  complete: 'bg-green-500',
  archived: 'bg-gray-500',
}

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="block rounded-lg border bg-card p-5 hover:border-primary/50 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                  STATUS_COLORS[project.status] ?? 'bg-gray-400'
                }`}
                title={project.status}
              />
              <h3 className="font-semibold truncate">{project.name}</h3>
            </div>
            <PrdStatusBadge status={project.status} />
          </div>

          {project.description && (
            <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
              {project.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span>{project.repoFullName}</span>
            <span>·</span>
            <span>
              {project.completedPhaseCount}/{project.phaseCount} phases
            </span>
            {project.itemCount > 0 && (
              <>
                <span>·</span>
                <span>{project.itemCount} items</span>
              </>
            )}
          </div>

          {/* Stats bar */}
          {project.stats ? (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs">
              {project.stats.running > 0 && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Activity className="h-3 w-3" />
                  {project.stats.running} running
                </span>
              )}
              {project.stats.needsReview > 0 && (
                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                  <Eye className="h-3 w-3" />
                  {project.stats.needsReview} need review
                </span>
              )}
              {project.stats.done > 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {project.stats.done} done
                </span>
              )}
              {project.stats.onHold > 0 && (
                <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <PauseCircle className="h-3 w-3" />
                  {project.stats.onHold} on hold
                </span>
              )}
              {project.stats.running === 0 &&
                project.stats.needsReview === 0 &&
                project.stats.done === 0 &&
                project.stats.onHold === 0 && (
                  <span className="text-muted-foreground">No activity yet</span>
                )}
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              All items finished!
            </div>
          )}

          <div className="mt-2 text-xs text-muted-foreground">
            Updated {formatRelative(project.updatedAt)}
          </div>
        </Link>
      ))}
    </div>
  )
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHrs < 1) return 'just now'
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}
