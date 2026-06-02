import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { agentLogs, prds, buildJobs } from '@mobster/db'
import { eq, sql, and } from 'drizzle-orm'

const STUCK_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour

export async function POST() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()
  const now = new Date().toISOString()
  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString()

  // Find all "active" sessions (PRD generating or building)
  const activePrds = db
    .select({ id: prds.id, status: prds.status })
    .from(prds)
    .where(
      // SQLite doesn't support IN with OR easily; do two queries or use SQL
      sql`${prds.status} IN ('generating', 'building')`,
    )
    .all()

  let repaired = 0

  for (const prd of activePrds) {
    // Check the last agent_log event for this PRD
    const lastLog = db
      .select({ lastEventAt: sql<string>`max(${agentLogs.createdAt})` })
      .from(agentLogs)
      .where(eq(agentLogs.prdId, prd.id))
      .get()

    const lastEventTime = lastLog?.lastEventAt ?? null
    const isStuck = !lastEventTime || lastEventTime < threshold

    if (!isStuck) continue

    repaired++

    if (prd.status === 'generating') {
      // Stuck PRD generation — mark as failed
      db.update(prds)
        .set({ status: 'failed', updatedAt: now })
        .where(eq(prds.id, prd.id))
        .run()

      const sessionId = `prd-${prd.id}`
      try {
        // Log the timeout to agent_logs
        const { v4: uuid } = await import('uuid')
        db.insert(agentLogs)
          .values({
            id: uuid(),
            prdId: prd.id,
            agentId: '',
            sessionId,
            eventType: 'status',
            content: 'Session marked as failed: timed out (process may have crashed)',
            createdAt: now,
          })
          .run()
      } catch {
        // Non-fatal
      }
    }

    if (prd.status === 'building') {
      // Stuck integration — mark build_job as failed and revert PRD
      const job = db
        .select()
        .from(buildJobs)
        .where(eq(buildJobs.prdId, prd.id))
        .orderBy(sql`${buildJobs.createdAt} DESC`)
        .limit(1)
        .get()

      if (job && (job.status === 'queued' || job.status === 'running')) {
        db.update(buildJobs)
          .set({
            status: 'failed',
            error: 'Integration timed out (process may have crashed)',
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(buildJobs.id, job.id))
          .run()
      }

      db.update(prds)
        .set({ status: 'approved', updatedAt: now })
        .where(eq(prds.id, prd.id))
        .run()

      const sessionId = `build-${prd.id}`
      try {
        const { v4: uuid } = await import('uuid')
        db.insert(agentLogs)
          .values({
            id: uuid(),
            prdId: prd.id,
            agentId: job?.id ? job.id : '',
            sessionId,
            eventType: 'status',
            content: 'Session marked as failed: timed out (process may have crashed)',
            createdAt: now,
          })
          .run()
      } catch {
        // Non-fatal
      }
    }
  }

  return NextResponse.json({ repaired })
}
