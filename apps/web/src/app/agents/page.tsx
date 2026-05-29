import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { agents } from '@mobster/db'
import { AgentList } from '@/components/agent-list'
import { EmptyState } from '@/components/empty-state'

export default async function AgentsPage() {
  const session = await auth()
  const db = getDb()

  const allAgents = db.select().from(agents).all()

  const safeAgents = allAgents.map((a) => ({
    id: a.id,
    name: a.name,
    providerType: a.providerType,
    apiKeyMasked: '••••',
    baseUrl: a.baseUrl,
    modelOpus: a.modelOpus,
    modelSonnet: a.modelSonnet,
    modelHaiku: a.modelHaiku,
    extraEnvVars: a.extraEnvVars ? JSON.parse(a.extraEnvVars) : null,
    systemPromptTemplate: a.systemPromptTemplate,
    isActive: !!a.isActive,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground mt-1">
            Configure AI agents for PRD generation and code execution.
          </p>
        </div>
      </div>

      {!session?.accessToken && (
        <EmptyState
          icon="🔗"
          title="Connect GitHub first"
          description="Sign in to configure agents."
          action={{ label: 'Go to Settings', href: '/settings' }}
        />
      )}

      {session?.accessToken && <AgentList initialAgents={safeAgents} />}
    </div>
  )
}
