import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { agentLogs, prds, agents } from '@mobster/db'
import { eq, sql } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = getDb()

  // Get distinct sessions with summary info
  const rows = db
    .select({
      sessionId: agentLogs.sessionId,
      prdId: agentLogs.prdId,
      agentId: agentLogs.agentId,
      eventCount: sql<number>`count(*)`,
      startedAt: sql<string>`min(${agentLogs.createdAt})`,
      lastEventAt: sql<string>`max(${agentLogs.createdAt})`,
    })
    .from(agentLogs)
    .groupBy(agentLogs.sessionId)
    .orderBy(sql`max(${agentLogs.createdAt}) DESC`)
    .all()

  // Enrich with PRD and agent info
  const enriched = rows.map((row) => {
    const prd = db.select().from(prds).where(eq(prds.id, row.prdId)).get()
    const agentName = row.agentId
      ? db.select().from(agents).where(eq(agents.id, row.agentId)).get()?.name ?? null
      : null

    const isActive = prd?.status === 'generating'

    return {
      sessionId: row.sessionId,
      prdId: row.prdId,
      prdTitle: prd?.title ?? 'Unknown PRD',
      prdStatus: prd?.status ?? 'unknown',
      agentName,
      version: prd?.version ?? 1,
      eventCount: row.eventCount,
      startedAt: row.startedAt,
      lastEventAt: row.lastEventAt,
      isActive,
    }
  })

  const active = enriched.filter((s) => s.isActive)
  const history = enriched.filter((s) => !s.isActive)

  return NextResponse.json({ sessions: enriched, active, history })
}
