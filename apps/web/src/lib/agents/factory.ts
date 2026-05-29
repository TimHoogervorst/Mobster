import { decrypt } from '@mobster/shared'
import type { AgentRunner } from './types'
import { ClaudeCodeRunner } from './claude-code-runner'
import { AnthropicSDKRunner } from './anthropic-sdk-runner'

interface AgentConfig {
  providerType: 'claude-code' | 'anthropic-sdk'
  apiKeyEncrypted: string
  baseUrl: string | null
  modelOpus: string
  modelSonnet: string
  modelHaiku: string
  extraEnvVars: string | null // JSON string
}

/**
 * Create the appropriate AgentRunner based on the agent's provider type.
 * Decrypts the API key from the database record.
 */
export function createAgentRunner(config: AgentConfig): AgentRunner {
  const apiKey = decrypt(config.apiKeyEncrypted)

  let extraEnvVars: Record<string, string> | undefined
  if (config.extraEnvVars) {
    try {
      extraEnvVars = JSON.parse(config.extraEnvVars)
    } catch {
      extraEnvVars = undefined
    }
  }

  const runnerConfig = {
    apiKey,
    baseUrl: config.baseUrl,
    modelOpus: config.modelOpus,
    modelSonnet: config.modelSonnet,
    modelHaiku: config.modelHaiku,
    extraEnvVars,
  }

  switch (config.providerType) {
    case 'claude-code':
      return new ClaudeCodeRunner(runnerConfig)
    case 'anthropic-sdk':
      return new AnthropicSDKRunner(runnerConfig)
    default:
      throw new Error(`Unknown provider type: ${config.providerType}`)
  }
}
