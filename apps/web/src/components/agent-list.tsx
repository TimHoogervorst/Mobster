'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit3, Star, Bot, Terminal } from 'lucide-react'
import { AgentForm } from './agent-form'

interface AgentData {
  id: string
  name: string
  providerType: 'claude-code' | 'anthropic-sdk'
  apiKeyMasked: string
  baseUrl: string | null
  modelOpus: string
  modelSonnet: string
  modelHaiku: string
  extraEnvVars: Record<string, string> | null
  systemPromptTemplate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface AgentListProps {
  initialAgents: AgentData[]
}

export function AgentList({ initialAgents }: AgentListProps) {
  const [agents, setAgents] = useState<AgentData[]>(initialAgents)
  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshAgents = async () => {
    try {
      const res = await fetch('/api/agents')
      if (res.ok) {
        const data = await res.json()
        setAgents(data.agents)
      }
    } catch {
      // ignore refresh errors
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent? PRDs generated with this agent will be unaffected.')) return
    setError(null)
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      await refreshAgents()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingAgent(null)
  }

  const handleFormSuccess = () => {
    handleFormClose()
    refreshAgents()
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Agent cards */}
      {agents.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Bot className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">No agents configured yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Your First Agent
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-lg border p-5 flex items-start justify-between gap-4"
          >
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{agent.name}</h3>
                {agent.isActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                    <Star className="h-3 w-3 fill-current" /> Active
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {agent.providerType === 'claude-code' ? (
                    <Terminal className="h-3 w-3" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                  {agent.providerType === 'claude-code' ? 'Claude Code CLI' : 'Anthropic SDK'}
                </span>
                {agent.baseUrl && (
                  <span className="truncate max-w-[200px]" title={agent.baseUrl}>
                    {agent.baseUrl}
                  </span>
                )}
                <span>Key: {agent.apiKeyMasked}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Opus:</span> {agent.modelOpus}
                {' · '}
                <span className="font-medium">Sonnet:</span> {agent.modelSonnet}
                {' · '}
                <span className="font-medium">Haiku:</span> {agent.modelHaiku}
              </div>
              {agent.extraEnvVars && Object.keys(agent.extraEnvVars).length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Env: {Object.entries(agent.extraEnvVars).map(([k, v]) => `${k}=${v}`).join(', ')}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setEditingAgent(agent)
                  setShowForm(true)
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Edit agent"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(agent.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Delete agent"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add button (when agents exist) */}
      {agents.length > 0 && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Add Agent
        </button>
      )}

      {/* Form modal */}
      {showForm && (
        <AgentForm
          agent={editingAgent}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}
