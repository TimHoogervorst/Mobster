export type ModelTier = 'opus' | 'sonnet' | 'haiku'

export interface AgentRunOptions {
  modelTier: ModelTier
  systemPrompt?: string
  maxTokens?: number
  timeout?: number
  /** Workspace directory — the agent runs with this as its working directory */
  cwd?: string
  /** Callback for structured session logging */
  onLog?: (eventType: string, content: string, metadata?: Record<string, unknown>) => void
}

export interface AgentRunResult {
  output: string
  model: string
  tokensUsed?: number
  /** Number of tool invocations made during this run (for observability) */
  toolCalls?: number
}

/**
 * Common interface for all agent backends.
 * Claude Code CLI and Anthropic SDK both implement this.
 */
export interface AgentRunner {
  run(prompt: string, opts: AgentRunOptions): Promise<AgentRunResult>
}
