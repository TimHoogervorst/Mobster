import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { agentLogs, prds, agents } from '@mobster/db'
import { eq } from 'drizzle-orm'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { sessionId } = await params
  const db = getDb()

  // Get first log entry to determine PRD and agent
  const firstLog = db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.sessionId, sessionId))
    .orderBy(agentLogs.createdAt)
    .limit(1)
    .get()

  if (!firstLog) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const prd = db.select().from(prds).where(eq(prds.id, firstLog.prdId)).get()
  const agentName = firstLog.agentId
    ? db.select().from(agents).where(eq(agents.id, firstLog.agentId)).get()?.name ?? null
    : null

  // Get all events for this session
  const events = db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.sessionId, sessionId))
    .orderBy(agentLogs.createdAt)
    .all()

  const isActive = prd?.status === 'generating'

  return NextResponse.json({
    session: {
      sessionId: firstLog.sessionId,
      prdId: firstLog.prdId,
      prdTitle: prd?.title ?? 'Unknown PRD',
      prdStatus: prd?.status ?? 'unknown',
      agentName,
      version: prd?.version ?? 1,
      eventCount: events.length,
      startedAt: events[0]?.createdAt ?? null,
      lastEventAt: events[events.length - 1]?.createdAt ?? null,
      isActive,
    },
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      content: e.content,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
      createdAt: e.createdAt,
    })),
  })
}
