import type { AgentRunner, AgentRunOptions, AgentRunResult } from './types'
import { WORKSPACE_TOOLS, executeWorkspaceTool, type WorkspaceToolName } from './tool-use'

const MAX_TOOL_ITERATIONS = 20

/**
 * Runs agents via the Anthropic SDK (@anthropic-ai/sdk).
 * Supports full tool-use: the agent can read files, list directories,
 * and search code within the workspace.
 */
export class AnthropicSDKRunner implements AgentRunner {
  private apiKey: string
  private baseURL: string | undefined
  private modelOpus: string
  private modelSonnet: string
  private modelHaiku: string

  constructor(config: {
    apiKey: string
    baseUrl?: string | null
    modelOpus: string
    modelSonnet: string
    modelHaiku: string
  }) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseUrl || undefined
    this.modelOpus = config.modelOpus
    this.modelSonnet = config.modelSonnet
    this.modelHaiku = config.modelHaiku
  }

  async run(prompt: string, opts: AgentRunOptions): Promise<AgentRunResult> {
    // Dynamic import — the package may not be installed if user only uses Claude Code CLI
    const Anthropic = await import('@anthropic-ai/sdk')
    const client = new Anthropic.default({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    })

    const model = this.getModel(opts.modelTier)
    const workspaceRoot = opts.cwd

    // Build initial messages
    const messages: Array<{
      role: 'user' | 'assistant'
      content: string | AnthropicMessageParam[]
    }> = [
      { role: 'user', content: prompt },
    ]

    let outputText = ''
    let totalToolCalls = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    opts.onLog?.('status', `Starting Anthropic SDK agent (model: ${model}, workspace: ${workspaceRoot ?? 'none'})`)

    // Tool-use loop
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 8000,
        system: opts.systemPrompt,
        messages: messages as any,
        tools: workspaceRoot ? WORKSPACE_TOOLS : undefined,
      })

      // Track token usage
      totalInputTokens += response.usage?.input_tokens ?? 0
      totalOutputTokens += response.usage?.output_tokens ?? 0

      // Check for tool use blocks
      const toolBlocks = response.content.filter((block) => block.type === 'tool_use')
      const textBlocks = response.content.filter((block) => block.type === 'text')

      // Build the assistant message content
      const assistantContent: AnthropicMessageParam[] = response.content.map((block) => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text }
        }
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          }
        }
        return { type: 'text', text: '' }
      })

      messages.push({ role: 'assistant', content: assistantContent })

      // Check for thinking blocks
      for (const block of response.content) {
        if (block.type === 'thinking') {
          opts.onLog?.('thinking', (block as any).thinking ?? '')
        }
      }

      // If no tool calls and we have text, we're done
      if (toolBlocks.length === 0) {
        outputText = textBlocks.map((b) => b.type === 'text' ? b.text : '').join('\n')
        opts.onLog?.('output', outputText)
        break
      }

      // Execute tool calls and prepare results
      if (!workspaceRoot) {
        // No workspace — can't execute tools, return text we have
        outputText = textBlocks.map((b) => b.type === 'text' ? b.text : '').join('\n')
        break
      }

      const toolResults: AnthropicMessageParam[] = []

      for (const toolBlock of toolBlocks) {
        totalToolCalls++
        const toolName = toolBlock.name as WorkspaceToolName
        opts.onLog?.('tool_call', `Calling ${toolName}`, {
          toolName,
          toolInput: toolBlock.input as Record<string, unknown>,
        })

        const result = executeWorkspaceTool(
          toolName,
          toolBlock.input as Record<string, unknown>,
          workspaceRoot,
        )

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result,
        })

        opts.onLog?.('tool_result', result, { toolName })
      }

      // Send tool results back
      messages.push({
        role: 'user',
        content: toolResults,
      })
    }

    // If we hit max iterations without a final text response, we still have the last response
    if (!outputText) {
      outputText = 'Agent reached maximum tool-use iterations without producing a final response.'
    }

    return {
      output: outputText,
      model: model,
      tokensUsed: totalOutputTokens,
      toolCalls: totalToolCalls,
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

// Type helpers for the Anthropic API message format
type AnthropicMessageParam =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }
