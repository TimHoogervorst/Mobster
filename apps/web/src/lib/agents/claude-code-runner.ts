import { execFile } from 'child_process'
import { promisify } from 'util'
import type { AgentRunner, AgentRunOptions, AgentRunResult } from './types'

const execFileAsync = promisify(execFile)

/**
 * Runs agents via Claude Code CLI (child process).
 * Supports DeepSeek and other Anthropic-compatible backends via env vars.
 * When provided a cwd, runs from within the workspace directory so
 * Claude Code can auto-discover CLAUDE.md and explore the codebase.
 */
export class ClaudeCodeRunner implements AgentRunner {
  private apiKey: string
  private baseURL: string | undefined
  private modelOpus: string
  private modelSonnet: string
  private modelHaiku: string
  private extraEnvVars: Record<string, string>

  constructor(config: {
    apiKey: string
    baseUrl?: string | null
    modelOpus: string
    modelSonnet: string
    modelHaiku: string
    extraEnvVars?: Record<string, string> | null
  }) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseUrl || undefined
    this.modelOpus = config.modelOpus
    this.modelSonnet = config.modelSonnet
    this.modelHaiku = config.modelHaiku
    this.extraEnvVars = config.extraEnvVars ?? {}
  }

  async run(prompt: string, opts: AgentRunOptions): Promise<AgentRunResult> {
    const model = this.getModel(opts.modelTier)
    const timeout = opts.timeout ?? 300_000 // 5 min default for workspace exploration

    // Build environment variables for the child process
    const env: Record<string, string | undefined> = {
      ...(process.env as Record<string, string | undefined>),
      ANTHROPIC_AUTH_TOKEN: this.apiKey,
      ANTHROPIC_MODEL: model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: this.modelOpus,
      ANTHROPIC_DEFAULT_SONNET_MODEL: this.modelSonnet,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: this.modelHaiku,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    }

    if (this.baseURL) {
      env.ANTHROPIC_BASE_URL = this.baseURL
    }

    // Apply extra user-configured env vars
    for (const [key, value] of Object.entries(this.extraEnvVars)) {
      env[key] = value
    }

    // Build command arguments
    // No --max-turns limit so Claude Code can explore the workspace freely
    const args: string[] = [
      '--print',
      '--output-format', 'json',
    ]

    if (opts.maxTokens) {
      args.push('--max-tokens', String(opts.maxTokens))
    }

    // If a system prompt is provided, prepend it to the user prompt
    // Claude Code --print doesn't have a separate system prompt flag
    const fullPrompt = opts.systemPrompt
      ? `${opts.systemPrompt}\n\n---\n\n${prompt}`
      : prompt

    opts.onLog?.('status', `Starting Claude Code agent (model: ${model}, workspace: ${opts.cwd ?? 'none'})`)
    console.log(`[ClaudeCodeRunner] Running in ${opts.cwd ?? process.cwd()} (timeout: ${timeout / 1000}s)`)

    try {
      const { stdout, stderr } = await execFileAsync('claude', [...args, fullPrompt], {
        env: env as NodeJS.ProcessEnv,
        cwd: opts.cwd, // Run from workspace directory if provided
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })

      if (stderr) {
        console.warn('[ClaudeCodeRunner] stderr:', stderr)
        if (stderr.length > 0) {
          opts.onLog?.('error', stderr.slice(0, 2000))
        }
      }

      // Parse JSON output from Claude Code
      const result = JSON.parse(stdout)

      // Emit tool calls from the session data if available
      if (result.messages) {
        for (const msg of result.messages) {
          if (msg.type === 'assistant' && msg.content) {
            for (const block of msg.content) {
              if (block.type === 'tool_use') {
                opts.onLog?.('tool_call', `Calling ${block.name}`, {
                  toolName: block.name,
                  toolInput: block.input,
                })
              } else if (block.type === 'thinking') {
                opts.onLog?.('thinking', block.thinking ?? block.text ?? '')
              }
            }
          } else if (msg.type === 'user' && msg.content) {
            for (const block of msg.content) {
              if (block.type === 'tool_result') {
                const resultContent = typeof block.content === 'string'
                  ? block.content
                  : JSON.stringify(block.content)
                opts.onLog?.('tool_result', resultContent, {})
              }
            }
          }
        }
      }

      const output = result.result ?? result.content ?? stdout
      opts.onLog?.('output', typeof output === 'string' ? output : JSON.stringify(output))

      const toolCalls = result.toolUseCount ?? result.tool_calls?.length

      opts.onLog?.('status', `Agent completed. Output: ${output.length} chars, tool calls: ${toolCalls ?? 'N/A'}`)

      return {
        output,
        model,
        toolCalls,
      }
    } catch (error: any) {
      opts.onLog?.('error', error.message || 'Unknown error')
      if (error?.code === 'ENOENT') {
        throw new Error(
          'Claude Code CLI is not installed. Run: npm install -g @anthropic-ai/claude-code',
        )
      }
      if (error?.killed) {
        throw new Error(`Agent timed out after ${timeout / 1000}s`)
      }
      throw new Error(
        `Claude Code execution failed: ${error.message || 'Unknown error'}`,
      )
    }
  }

  private getModel(tier: string): string {
    switch (tier) {
      case 'opus':
        return this.modelOpus
      case 'sonnet':
        return this.modelSonnet
      case 'haiku':
        return this.modelHaiku
      default:
        return this.modelSonnet
    }
  }
}
