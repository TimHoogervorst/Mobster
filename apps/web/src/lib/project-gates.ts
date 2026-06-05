import type { DbClient } from '@mobster/db'
import { projectPhases, projectItems, projects } from '@mobster/db'
import { eq, and } from 'drizzle-orm'
import { EventLogger } from '@/lib/event-logger'

/**
 * Check if all active (non-held) items in a phase have reached
 * a "completed" status appropriate for the phase type.
 */
export function canAdvancePhase(db: DbClient, phaseId: string): boolean {
  const phase = db.select().from(projectPhases).where(eq(projectPhases.id, phaseId)).get()
  if (!phase) return false

  const allItems = db.select().from(projectItems).where(eq(projectItems.phaseId, phaseId)).all()
  // Exclude on_hold items from gate checks — they're intentionally paused
  const activeItems = allItems.filter((item) => item.status !== 'on_hold')
  if (activeItems.length === 0) return false

  const terminalStatuses: Record<string, string[]> = {
    integration: ['integrated', 'tested', 'passed'],
    testing: ['tested', 'passed'],
    review: ['passed'],
  }

  const valid = terminalStatuses[phase.phaseType] || ['passed']
  return activeItems.every((item) => valid.includes(item.status))
}

/**
 * Transition a phase to 'passed' and record the event in the event log.
 */
export function advancePhase(db: DbClient, phaseId: string): void {
  const phase = db.select().from(projectPhases).where(eq(projectPhases.id, phaseId)).get()
  if (!phase) return

  const now = new Date().toISOString()
  db.update(projectPhases)
    .set({ status: 'passed', completedAt: now, updatedAt: now })
    .where(eq(projectPhases.id, phaseId))
    .run()

  const logger = new EventLogger({
    db,
    entityType: 'project',
    entityId: phase.projectId,
    parentEntityType: 'project',
    parentEntityId: phase.projectId,
  })
  logger.log('phase.passed', {
    summary: `Phase "${phase.name}" completed — all items passed`,
    metadata: { phaseId: phase.id, phaseType: phase.phaseType },
  })
}

/**
 * Find the next pending phase (by sortOrder) and activate it.
 * Returns the activated phase or null if no pending phases remain.
 */
export function activateNextPhase(db: DbClient, projectId: string): typeof projectPhases.$inferSelect | null {
  const next = db
    .select()
    .from(projectPhases)
    .where(and(eq(projectPhases.projectId, projectId), eq(projectPhases.status, 'pending')))
    .orderBy(projectPhases.sortOrder)
    .limit(1)
    .get()

  if (!next) {
    // No more phases — mark project as complete
    const now = new Date().toISOString()
    db.update(projects)
      .set({ status: 'complete', updatedAt: now })
      .where(eq(projects.id, projectId))
      .run()

    const logger = new EventLogger({ db, entityType: 'project', entityId: projectId })
    logger.log('project.completed', {
      summary: 'All phases complete — project finished',
    })
    return null
  }

  const now = new Date().toISOString()
  db.update(projectPhases)
    .set({ status: 'active', startedAt: now, updatedAt: now })
    .where(eq(projectPhases.id, next.id))
    .run()

  const logger = new EventLogger({ db, entityType: 'project', entityId: projectId })
  logger.log('phase.started', {
    summary: `Phase "${next.name}" started`,
    metadata: { phaseId: next.id },
  })

  return next
}
