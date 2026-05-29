'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Brain, Wrench, FileOutput, AlertCircle, Info, Clock } from 'lucide-react'

interface LogEvent {
  id: string
  eventType: string
  content: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface RunnerLogViewerProps {
  sessionId: string
  isActive: boolean
  initialEvents: LogEvent[]
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  thinking: Brain,
  tool_call: Wrench,
  tool_result: FileOutput,
  output: FileOutput,
  error: AlertCircle,
  status: Info,
}

const EVENT_COLORS: Record<string, string> = {
  thinking: 'border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20',
  tool_call: 'border-l-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20',
  tool_result: 'border-l-green-400 bg-green-50/50 dark:bg-green-950/20',
  output: 'border-l-gray-400 bg-gray-50/50 dark:bg-gray-950/20',
  error: 'border-l-red-400 bg-red-50/50 dark:bg-red-950/20',
  status: 'border-l-purple-400 bg-purple-50/50 dark:bg-purple-950/20',
}

export function RunnerLogViewer({ sessionId, isActive, initialEvents }: RunnerLogViewerProps) {
  const [events, setEvents] = useState<LogEvent[]>(initialEvents)
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set())
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Poll for new events if session is active
  useEffect(() => {
    if (!isActive) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/runners/${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.events && data.events.length > events.length) {
            setEvents(data.events)
          }
          // Check if session completed
          if (!data.session?.isActive) {
            clearInterval(interval)
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [sessionId, isActive, events.length])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events.length, autoScroll])

  const toggleThinking = (id: string) => {
    const next = new Set(expandedThinking)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedThinking(next)
  }

  const toggleTool = (id: string) => {
    const next = new Set(expandedTools)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedTools(next)
  }

  if (events.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">No events in this session.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Auto-scroll toggle */}
      {isActive && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-input"
            />
            Auto-scroll
          </label>
        </div>
      )}

      {/* Event timeline */}
      <div className="rounded-lg border divide-y">
        {events.map((event) => {
          const Icon = EVENT_ICONS[event.eventType] ?? Info
          const colorClass = EVENT_COLORS[event.eventType] ?? ''
          const isThinking = event.eventType === 'thinking'
          const isTool = event.eventType === 'tool_call' || event.eventType === 'tool_result'
          const isError = event.eventType === 'error'

          return (
            <div
              key={event.id}
              className={`border-l-4 px-4 py-3 ${colorClass} ${isThinking ? 'cursor-pointer' : ''}`}
              onClick={isThinking ? () => toggleThinking(event.id) : undefined}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isError ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {event.eventType.replace('_', ' ')}
                    </span>
                    {event.metadata?.toolName != null && (
                      <code className="text-xs bg-muted px-1 rounded">
                        {String(event.metadata.toolName)}
                      </code>
                    )}
                    {isThinking && (
                      <span className="text-xs text-muted-foreground">
                        {expandedThinking.has(event.id) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </span>
                    )}
                    {isTool && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTool(event.id) }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {expandedTools.has(event.id) ? 'Hide details' : 'Show details'}
                      </button>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(event.createdAt)}
                    </span>
                  </div>

                  {/* Thinking: collapsed by default */}
                  {isThinking && expandedThinking.has(event.id) && (
                    <pre className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground font-mono max-h-48 overflow-y-auto">
                      {event.content}
                    </pre>
                  )}
                  {isThinking && !expandedThinking.has(event.id) && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      {(event.content || '').slice(0, 100)}
                      {(event.content || '').length > 100 ? '...' : ''}
                    </p>
                  )}

                  {/* Tool calls: show name + input summary */}
                  {event.eventType === 'tool_call' && (
                    <div className="mt-1">
                      <p className="text-xs">{event.content}</p>
                      {expandedTools.has(event.id) && event.metadata?.toolInput != null && (
                        <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-x-auto max-h-32">
                          {JSON.stringify(event.metadata.toolInput, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Tool results: collapsed by default */}
                  {event.eventType === 'tool_result' && expandedTools.has(event.id) && (
                    <pre className="mt-1 text-xs text-muted-foreground font-mono max-h-64 overflow-y-auto bg-muted/50 rounded p-2">
                      {event.content}
                    </pre>
                  )}
                  {event.eventType === 'tool_result' && !expandedTools.has(event.id) && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      {(event.content || '').slice(0, 120)}
                      {(event.content || '').length > 120 ? '...' : ''}
                    </p>
                  )}

                  {/* Output: shown inline */}
                  {event.eventType === 'output' && (
                    <div className="mt-1 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {event.content}
                    </div>
                  )}

                  {/* Error: highlighted */}
                  {isError && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
                      {event.content}
                    </div>
                  )}

                  {/* Status: simple text */}
                  {event.eventType === 'status' && (
                    <p className="mt-1 text-xs">{event.content}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
          <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          Session is still running — new events will appear automatically
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString()
}
