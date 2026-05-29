'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'

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

interface AgentFormProps {
  agent: AgentData | null // null = create, non-null = edit
  onClose: () => void
  onSuccess: () => void
}

export function AgentForm({ agent, onClose, onSuccess }: AgentFormProps) {
  const isEdit = !!agent

  const [name, setName] = useState(agent?.name ?? '')
  const [providerType, setProviderType] = useState<'claude-code' | 'anthropic-sdk'>(
    agent?.providerType ?? 'anthropic-sdk',
  )
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(agent?.baseUrl ?? '')
  const [modelOpus, setModelOpus] = useState(agent?.modelOpus ?? 'claude-opus-4')
  const [modelSonnet, setModelSonnet] = useState(agent?.modelSonnet ?? 'claude-sonnet-4')
  const [modelHaiku, setModelHaiku] = useState(agent?.modelHaiku ?? 'claude-haiku-4')
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>(
    agent?.extraEnvVars
      ? Object.entries(agent.extraEnvVars).map(([k, v]) => ({ key: k, value: v }))
      : [],
  )
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPromptTemplate ?? '')
  const [isActive, setIsActive] = useState(agent?.isActive ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!isEdit && !apiKey.trim()) {
      setError('API key is required')
      return
    }

    const extraEnvVars: Record<string, string> = {}
    for (const ev of envVars) {
      if (ev.key.trim()) {
        extraEnvVars[ev.key.trim()] = ev.value
      }
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      providerType,
      modelOpus,
      modelSonnet,
      modelHaiku,
      extraEnvVars,
      systemPromptTemplate: systemPrompt.trim() || undefined,
      isActive,
    }

    if (!isEdit) {
      body.apiKey = apiKey.trim()
      body.baseUrl = baseUrl.trim() || undefined
    } else {
      // Only send apiKey and baseUrl if explicitly provided when editing
      if (apiKey.trim()) {
        body.apiKey = apiKey.trim()
      }
      body.baseUrl = baseUrl.trim() || undefined
    }

    setSaving(true)
    try {
      const url = isEdit ? `/api/agents/${agent!.id}` : '/api/agents'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? data.details?.fieldErrors?.name?.[0] ?? 'Failed to save')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }])
  const removeEnvVar = (i: number) => setEnvVars(envVars.filter((_, idx) => idx !== i))
  const updateEnvVar = (i: number, field: 'key' | 'value', val: string) => {
    const next = [...envVars]
    next[i] = { ...next[i]!, [field]: val }
    setEnvVars(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-semibold mb-6">
          {isEdit ? `Edit ${agent!.name}` : 'Add Agent'}
        </h2>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Claude Agent"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {/* Provider type */}
          <div>
            <label className="text-sm font-medium">Provider</label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as any)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="anthropic-sdk">Anthropic SDK</option>
              <option value="claude-code">Claude Code CLI</option>
            </select>
          </div>

          {/* API Key */}
          <div>
            <label className="text-sm font-medium">
              API Key {isEdit && '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEdit ? '•••• (unchanged)' : 'sk-ant-...'}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required={!isEdit}
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="text-sm font-medium">
              Base URL{' '}
              <span className="text-muted-foreground font-normal">(optional — override API endpoint)</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/anthropic"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              For DeepSeek via Claude Code, set to:{' '}
              <code className="text-xs bg-muted px-1 rounded">https://api.deepseek.com/anthropic</code>
            </p>
          </div>

          {/* Model mappings */}
          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="text-sm font-medium px-1">Model Mappings</legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">Opus-tier</label>
                <input
                  type="text"
                  value={modelOpus}
                  onChange={(e) => setModelOpus(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Sonnet-tier</label>
                <input
                  type="text"
                  value={modelSonnet}
                  onChange={(e) => setModelSonnet(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Haiku-tier</label>
                <input
                  type="text"
                  value={modelHaiku}
                  onChange={(e) => setModelHaiku(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
            </div>
          </fieldset>

          {/* Extra environment variables */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Extra Environment Variables{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <button
                type="button"
                onClick={addEnvVar}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {envVars.length > 0 && (
              <div className="mt-2 space-y-2">
                {envVars.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ev.key}
                      onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
                      placeholder="ANTHROPIC_BASE_URL"
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      type="text"
                      value={ev.value}
                      onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                      placeholder="https://api.deepseek.com/anthropic"
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => removeEnvVar(i)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System prompt template */}
          <div>
            <label className="text-sm font-medium">
              System Prompt Template{' '}
              <span className="text-muted-foreground font-normal">(optional — defaults to PRD template)</span>
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a technical product manager..."
              rows={4}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Set as active agent
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
