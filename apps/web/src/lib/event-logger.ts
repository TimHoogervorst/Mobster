import { v4 as uuid } from 'uuid'
import type { DbClient } from '@mobster/db'
import { eventLog } from '@mobster/db'

export type EntityType = 'project' | 'prd' | 'build' | 'agent_session'

export class EventLogger {
  private db: DbClient
  private entityType: EntityType
  private entityId: string
  private parentEntityType?: EntityType
  private parentEntityId?: string
  private sessionId?: string

  constructor(opts: {
    db: DbClient
    entityType: EntityType
    entityId: string
    parentEntityType?: EntityType
    parentEntityId?: string
    sessionId?: string
  }) {
    this.db = opts.db
    this.entityType = opts.entityType
    this.entityId = opts.entityId
    this.parentEntityType = opts.parentEntityType
    this.parentEntityId = opts.parentEntityId
    this.sessionId = opts.sessionId
  }

  /** Core log method — everything flows through here */
  log(
    eventType: string,
    opts?: {
      summary?: string
      content?: string
      metadata?: Record<string, unknown>
    },
  ): void {
    try {
      this.db.insert(eventLog)
        .values({
          id: uuid(),
          entityType: this.entityType,
          entityId: this.entityId,
          parentEntityType: this.parentEntityType ?? null,
          parentEntityId: this.parentEntityId ?? null,
          eventType,
          sessionId: this.sessionId ?? null,
          summary: opts?.summary ?? null,
          content: opts?.content ?? null,
          metadata: opts?.metadata ? JSON.stringify(opts.metadata) : null,
          createdAt: new Date().toISOString(),
        })
        .run()
    } catch (err) {
      console.error('EventLogger: failed to write event', err)
    }
  }
}
