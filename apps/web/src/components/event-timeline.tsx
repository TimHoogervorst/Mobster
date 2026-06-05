'use client'

import { useState } from 'react'
import {
  FolderKanban,
  Bot,
  Hammer,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react'

interface EventEntry {
  id: string
  entityType: string
  entityId: string
  eventType: string
  sessionId: string | null
  summary: string | null
  content: string | null
  metadata: string | null
  createdAt: string
}

interface EventTimelineProps {
  events: EventEntry[]
  entityType: string
  groupByDate?: boolean
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  project: <FolderKanban className="h-4 w-4" />,
  agent_session: <Bot className="h-4 w-4" />,
  build: <Hammer className="h-4 w-4" />,
}

export function EventTimeline({
  events,
  entityType: _entityType,
  groupByDate = true,
}: EventTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No events yet.
      </div>
    )
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExpandedIds(next)
  }

  // Group by date
  const groups = groupByDate ? groupEventsByDate(events) : { 'All events': events }

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        History
      </h3>

      <div className="space-y-4">
        {Object.entries(groups).map(([dateLabel, groupEvents]) => (
          <div key={dateLabel}>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              {dateLabel}
            </h4>
            <div className="space-y-1">
              {groupEvents.map((event) => {
                const isExpanded = expandedIds.has(event.id)
                const hasDetail = !!(event.content || event.metadata)

                // Parse event type prefix for icon
                const prefix = event.eventType.split('.')[0]
                const icon = ENTITY_ICONS[prefix ?? ''] ?? (
                  <Clock className="h-4 w-4" />
                )

                return (
                  <div
                    key={event.id}
                    className="rounded-md border bg-card hover:bg-accent/30 transition-colors"
                  >
                    <button
                      onClick={() => hasDetail && toggleExpand(event.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                        hasDetail ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <span className="text-muted-foreground flex-shrink-0">
                        {icon}
                      </span>
                      <span className="flex-1 min-w-0 truncate">
                        {event.summary || event.eventType}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTime(event.createdAt)}
                      </span>
                      {hasDetail &&
                        (isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        ))}
                    </button>

                    {isExpanded && hasDetail && (
                      <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
                        {event.content && (
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {event.content}
                          </div>
                        )}
                        {event.metadata && (
                          <details>
                            <summary className="text-xs text-muted-foreground cursor-pointer">
                              Metadata
                            </summary>
                            <pre className="mt-1 text-xs text-muted-foreground overflow-auto max-h-32 p-2 bg-muted rounded">
                              {formatJson(event.metadata)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function groupEventsByDate(
  events: EventEntry[],
): Record<string, EventEntry[]> {
  const groups: Record<string, EventEntry[]> = {}
  const now = new Date()

  for (const event of events) {
    const date = new Date(event.createdAt)
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    )

    let label: string
    if (diffDays === 0) label = 'Today'
    else if (diffDays === 1) label = 'Yesterday'
    else label = date.toLocaleDateString()

    if (!groups[label]) groups[label] = []
    groups[label]!.push(event)
  }

  return groups
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
