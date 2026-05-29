'use client'

import Link from 'next/link'
import { Loader2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'

interface RunnerSession {
  sessionId: string
  prdId: string
  prdTitle: string
  prdStatus: string
  agentName: string | null
  version: number
  eventCount: number
  startedAt: string
  lastEventAt: string
  isActive: boolean
}

interface RunnerListProps {
  sessions: RunnerSession[]
}

export function RunnerList({ sessions }: RunnerListProps) {
  const active = sessions.filter((s) => s.isActive)
  const history = sessions.filter((s) => !s.isActive)

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center">
        <p className="text-muted-foreground">No runner sessions yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Sessions will appear here when you generate PRDs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Active sessions */}
      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Active Sessions ({active.length})
          </h2>
          <SessionTable sessions={active} isActive />
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            History ({history.length})
          </h2>
          <SessionTable sessions={history} />
        </section>
      )}
    </div>
  )
}

function SessionTable({ sessions, isActive }: { sessions: RunnerSession[]; isActive?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              PRD
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Agent
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Events
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Started
            </th>
            <th className="px-4 py-3 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.sessionId}
              className="border-b hover:bg-accent/50 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <Loader2 className="h-4 w-4 text-purple-500 animate-spin shrink-0" />
                  ) : s.prdStatus === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  <div>
                    <Link
                      href={`/runners/${s.sessionId}`}
                      className="text-sm font-medium hover:text-primary transition-colors"
                    >
                      {s.prdTitle}
                    </Link>
                    {s.version > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">v{s.version}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {isActive ? 'Generating...' : s.prdStatus}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {s.agentName ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {s.eventCount}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                {formatDate(s.startedAt)}
              </td>
              <td className="px-2 py-3">
                <Link
                  href={`/runners/${s.sessionId}`}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}
