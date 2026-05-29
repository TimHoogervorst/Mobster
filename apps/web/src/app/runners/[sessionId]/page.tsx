import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { agentLogs, prds, agents } from '@mobster/db'
import { eq } from 'drizzle-orm'
import { RunnerLogViewer } from '@/components/runner-log-viewer'
import { EmptyState } from '@/components/empty-state'
import { ArrowLeft, ExternalLink } from 'lucide-react'

interface SessionDetailPageProps {
  params: Promise<{ sessionId: string }>
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const session = await auth()
  if (!session?.accessToken) {
    return (
      <EmptyState
        icon="🔗"
        title="Connect GitHub first"
        description="Sign in to view runner sessions."
        action={{ label: 'Go to Settings', href: '/settings' }}
      />
    )
  }

  const { sessionId } = await params
  const db = getDb()

  const firstLog = db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.sessionId, sessionId))
    .orderBy(agentLogs.createdAt)
    .limit(1)
    .get()

  if (!firstLog) {
    notFound()
  }

  const prd = db.select().from(prds).where(eq(prds.id, firstLog.prdId)).get()
  const agentName = firstLog.agentId
    ? db.select().from(agents).where(eq(agents.id, firstLog.agentId)).get()?.name ?? null
    : null

  const events = db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.sessionId, sessionId))
    .orderBy(agentLogs.createdAt)
    .all()

  const isActive = prd?.status === 'generating'

  return (
    <div className="space-y-6">
      <Link
        href="/runners"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Runners
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            {prd?.title ?? 'Session'} {isActive && <span className="text-purple-500">●</span>}
          </h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {agentName && <span>{agentName}</span>}
          {agentName && prd && <span>·</span>}
          {prd && (
            <Link
              href={`/prds/${prd.id}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              View PRD <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          <span>·</span>
          <span>{events.length} events</span>
          <span>·</span>
          <span>
            {isActive ? 'Running...' : 'Completed'}
          </span>
        </div>
      </div>

      <RunnerLogViewer
        sessionId={sessionId}
        isActive={isActive}
        initialEvents={events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          content: e.content,
          metadata: e.metadata ? JSON.parse(e.metadata) : null,
          createdAt: e.createdAt,
        }))}
      />
    </div>
  )
}
