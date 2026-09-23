import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ChatMessage, ProviderConfig, ModelConfig, TokenUsage, ResponseFormat } from '@custom-harness/core-types'

export type { ChatMessage, ProviderConfig, ModelConfig, TokenUsage, ResponseFormat }

export interface RetryConfig {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
}

export interface StreamEvent {
  type: 'chunk' | 'thought' | 'tool_call' | 'error' | 'done'
  content?: string
  toolCall?: {
    id: string
    name: string
    arguments: string
  }
  error?: string
  usage?: TokenUsage
}

export interface StreamChatOptions {
  provider?: ProviderConfig
  model?: ModelConfig
  tools?: any[]
  signal?: AbortSignal
  enableThinking?: boolean
  thinkingBudgetTokens?: number
  responseFormat?: ResponseFormat
  retry?: RetryConfig
  sessionId?: string
}

/**
 * Capability Seam: LlmService
 * Defines the contract for streaming LLM inference across any model provider.
 */
export abstract class LlmService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'llm')
  }

  /**
   * Stream a multi-turn chat completion with structured events (chunks, thoughts, tool_calls, usage).
   */
  public abstract streamChat(
    messages: ChatMessage[],
    options?: StreamChatOptions
  ): AsyncGenerator<StreamEvent, void, unknown>
}

export const name = 'llm'

export function apply(ctx: Context) {
  // Capability seam registration point for Cordis
}

export default LlmService
