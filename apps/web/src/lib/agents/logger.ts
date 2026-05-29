import { v4 as uuid } from 'uuid'
import type { DbClient } from '@mobster/db'
import { agentLogs } from '@mobster/db'

type EventType = 'thinking' | 'tool_call' | 'tool_result' | 'output' | 'error' | 'status'

/**
 * Persists structured agent session logs to the database.
 * Called during PRD generation by both Claude Code and Anthropic SDK runners.
 */
export class SessionLogger {
  private db: DbClient
  private prdId: string
  private agentId: string
  private sessionId: string
  private _eventCount = 0

  constructor(
    db: DbClient,
    prdId: string,
    agentId: string,
    sessionId: string,
  ) {
    this.db = db
    this.prdId = prdId
    this.agentId = agentId
    this.sessionId = sessionId
  }

  get eventCount(): number {
    return this._eventCount
  }

  thinking(content: string): void {
    this.log('thinking', content, null)
  }

  toolCall(name: string, input: unknown): void {
    this.log('tool_call', `Calling ${name}`, { toolName: name, toolInput: input })
  }

  toolResult(name: string, result: string): void {
    // Truncate very long tool results
    const truncated = result.length > 5000 ? result.slice(0, 5000) + '\n... [truncated]' : result
    this.log('tool_result', truncated, { toolName: name })
  }

  output(content: string): void {
    // Split large outputs into manageable chunks
    if (content.length > 2000) {
      // Log in chunks for large outputs
      let offset = 0
      while (offset < content.length) {
        const chunk = content.slice(offset, offset + 2000)
        this.log('output', chunk, null)
        offset += 2000
      }
    } else {
      this.log('output', content, null)
    }
  }

  error(content: string): void {
    this.log('error', content, null)
  }

  status(content: string): void {
    this.log('status', content, null)
  }

  private log(eventType: EventType, content: string, metadata: unknown): void {
    this._eventCount++
    const now = new Date().toISOString()

    try {
      this.db.insert(agentLogs).values({
        id: uuid(),
        prdId: this.prdId,
        agentId: this.agentId,
        sessionId: this.sessionId,
        eventType,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: now,
      }).run()
    } catch (error: any) {
      // Don't let log failures break the generation
      console.error(`[SessionLogger] Failed to write log:`, error.message)
    }
  }
}
