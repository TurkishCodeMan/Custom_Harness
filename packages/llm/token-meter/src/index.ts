import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ChatMessage, ModelConfig } from '@custom-harness/core-types'

export interface ContextBreakdown {
  systemTokens: number
  toolsTokens: number
  messageTokens: number
  systemPercent: number
  toolsPercent: number
  messagePercent: number
}

export interface ContextPressure {
  usedTokens: number
  contextWindow: number
  percent: number
  projectedTokens: number
}

export interface TokenMeasurement {
  contextPressure: ContextPressure
  contextBreakdown: ContextBreakdown
  modelId: string
  contextWindow: number
  disabled?: boolean
  systemPromptTokens?: number
  toolsTokens?: number
  historyTokens?: number
  totalTokens?: number
  percentage?: number
}

export const name = 'token-meter'
export const inject = ['settings', 'tools', 'session']

export class TokenMeterService extends Service {
  declare ctx: Context
  static inject = ['settings', 'tools', 'session']

  constructor(ctx: Context) {
    super(ctx, 'tokenMeter')
  }

  /**
   * Fast & robust token estimation heuristic (4 chars per token + structural overhead).
   */
  public estimateText(text?: string): number {
    if (!text) return 0
    return Math.max(1, Math.ceil(text.length / 4))
  }

  /**
   * Estimate token count of a single ChatMessage.
   */
  public estimateMessage(msg: ChatMessage): number {
    let tokens = 4 // Base message role overhead
    if (msg.content) {
      tokens += this.estimateText(msg.content)
    }
    if (msg.reasoning_content) {
      tokens += this.estimateText(msg.reasoning_content)
    }
    if (msg.tool_calls) {
      for (const call of msg.tool_calls) {
        tokens += 6 // tool call wrapper overhead
        tokens += this.estimateText(call.function?.name)
        tokens += this.estimateText(call.function?.arguments)
      }
    }
    return tokens
  }

  /**
   * Measures current session context occupancy and breakdown.
   */
  public measureSession(sessionId?: string, modelOverride?: ModelConfig): TokenMeasurement {
    const isPluginEnabled = this.ctx.settings?.getPlugin ? (this.ctx.settings.getPlugin('token-meter')?.enabled !== false) : true
    const activeModel = modelOverride || this.ctx.settings.getActiveModel()
    const contextWindow = activeModel?.contextWindow || 24576
    const modelId = activeModel?.id || 'default-model'

    if (!isPluginEnabled) {
      return {
        contextPressure: {
          usedTokens: 0,
          contextWindow,
          percent: 0,
          projectedTokens: 0
        },
        contextBreakdown: {
          systemTokens: 0,
          toolsTokens: 0,
          messageTokens: 0,
          systemPercent: 0,
          toolsPercent: 0,
          messagePercent: 0
        },
        modelId,
        contextWindow,
        disabled: true
      }
    }

    // 1. System Prompt Tokens
    const cwd = this.ctx.settings.getSettings().workspace || process.cwd()
    const systemPromptText = `You are a helpful and intelligent AI Coding Assistant powered by ${activeModel?.name || modelId}.
Your current working directory is: ${cwd}

You have access to tools for interacting with the system. Always prefer using tools when you need to inspect files, execute commands, or verify code.`
    const systemTokens = this.estimateText(systemPromptText) + 8

    // 2. Tools Schema Tokens
    const toolSchemas = this.ctx.tools.getOpenAiSchemas()
    let toolsTokens = 0
    if (toolSchemas && toolSchemas.length > 0) {
      const toolsJson = JSON.stringify(toolSchemas)
      toolsTokens = this.estimateText(toolsJson) + 12
    }

    // 3. Message History Tokens
    let messageTokens = 0
    if (sessionId) {
      const session = this.ctx.session.getSession(sessionId)
      if (session && session.messages) {
        for (const msg of session.messages) {
          messageTokens += this.estimateMessage(msg)
        }
      }
    }

    const usedTokens = systemTokens + toolsTokens + messageTokens
    const percent = Math.min(100, Math.round((usedTokens / contextWindow) * 100))

    const breakdownTotal = Math.max(1, usedTokens)
    const systemPercent = Math.round((systemTokens / breakdownTotal) * 100)
    const toolsPercent = Math.round((toolsTokens / breakdownTotal) * 100)
    const messagePercent = Math.max(0, 100 - systemPercent - toolsPercent)

    return {
      contextPressure: {
        usedTokens,
        contextWindow,
        percent,
        projectedTokens: usedTokens
      },
      contextBreakdown: {
        systemTokens,
        toolsTokens,
        messageTokens,
        systemPercent,
        toolsPercent,
        messagePercent
      },
      modelId,
      contextWindow,
      systemPromptTokens: systemTokens,
      toolsTokens,
      historyTokens: messageTokens,
      totalTokens: usedTokens,
      percentage: percent
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('tokenMeter', new TokenMeterService(ctx))
}
