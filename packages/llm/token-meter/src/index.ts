import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ChatMessage, ModelConfig, TokenUsage } from '@custom-harness/core-types'

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

export interface SessionActualUsage {
  sessionId: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  turnCount: number
  lastPromptTokens: number
  lastCompletionTokens: number
  lastUpdated: number
  modelId?: string
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
  actualUsage?: SessionActualUsage
  isCalibrated?: boolean
}

export const name = 'token-meter'
export const inject = ['settings', 'tools', 'session', 'systemPrompt', 'compactor']

export class TokenMeterService extends Service {
  declare ctx: Context
  static inject = ['settings', 'tools', 'session', 'systemPrompt', 'compactor']

  private _sessionUsage?: Map<string, SessionActualUsage>
  private _lastSessionState?: Map<string, { promptTokens: number; messageCount: number }>

  private get sessionUsage(): Map<string, SessionActualUsage> {
    if (!this._sessionUsage) this._sessionUsage = new Map()
    return this._sessionUsage
  }

  private get lastSessionState(): Map<string, { promptTokens: number; messageCount: number }> {
    if (!this._lastSessionState) this._lastSessionState = new Map()
    return this._lastSessionState
  }

  constructor(ctx: Context) {
    super(ctx, 'tokenMeter')

    if (ctx && typeof (ctx as any).on === 'function') {
      ;(ctx as any).on('llm/token-usage', (data: { sessionId?: string; model?: string; usage?: TokenUsage }) => {
        if (data?.usage) {
          this.recordUsage(data.sessionId, data.usage, data.model)
        }
      })
    }
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
   * Record actual token consumption reported by the LLM provider.
   */
  public recordUsage(sessionId?: string, usage?: TokenUsage, modelId?: string): void {
    if (!usage) return
    const sid = sessionId || 'default'
    const prev = this.sessionUsage.get(sid) || {
      sessionId: sid,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      turnCount: 0,
      lastPromptTokens: 0,
      lastCompletionTokens: 0,
      lastUpdated: Date.now()
    }

    const newPrompt = prev.promptTokens + (usage.promptTokens || 0)
    const newCompletion = prev.completionTokens + (usage.completionTokens || 0)
    const newTotal = prev.totalTokens + (usage.totalTokens || ((usage.promptTokens || 0) + (usage.completionTokens || 0)))

    this.sessionUsage.set(sid, {
      sessionId: sid,
      promptTokens: newPrompt,
      completionTokens: newCompletion,
      totalTokens: newTotal,
      turnCount: prev.turnCount + 1,
      lastPromptTokens: usage.promptTokens || 0,
      lastCompletionTokens: usage.completionTokens || 0,
      lastUpdated: Date.now(),
      modelId: modelId || prev.modelId
    })

    if (sessionId) {
      const session = this.ctx?.session?.getSession ? this.ctx.session.getSession(sessionId) : null
      const messageCount = session?.messages?.length || 0
      this.lastSessionState.set(sessionId, {
        promptTokens: usage.promptTokens || 0,
        messageCount
      })
    }
  }

  public getSessionUsage(sessionId: string): SessionActualUsage | undefined {
    return this.sessionUsage.get(sessionId)
  }

  public getAllUsage(): Record<string, SessionActualUsage> {
    return Object.fromEntries(this.sessionUsage.entries())
  }

  public clearUsage(sessionId?: string): void {
    if (sessionId) {
      this.sessionUsage.delete(sessionId)
      this.lastSessionState.delete(sessionId)
    } else {
      this.sessionUsage.clear()
      this.lastSessionState.clear()
    }
  }

  /**
   * Measures current session context occupancy and breakdown.
   * If actual token usage from an LLM run is available, calibrates the context measurement
   * against the verified token count reported by the model.
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

    // 1. System Prompt Tokens (rendered dynamically from ctx.systemPrompt if available)
    let systemPromptText = ''
    if (this.ctx.systemPrompt) {
      try {
        systemPromptText = this.ctx.systemPrompt.render()
      } catch {}
    }
    if (!systemPromptText) {
      const cwd = this.ctx.settings.getSettings().workspace || process.cwd()
      systemPromptText = `You are a helpful and intelligent AI Coding Assistant powered by ${activeModel?.name || modelId}.\nYour current working directory is: ${cwd}\nYou have access to tools for interacting with the system.`
    }
    const systemTokens = this.estimateText(systemPromptText) + 8

    // 2. Tools Schema Tokens
    const toolSchemas = this.ctx.tools?.getOpenAiSchemas ? this.ctx.tools.getOpenAiSchemas() : []
    let toolsTokens = 0
    if (toolSchemas && toolSchemas.length > 0) {
      const toolsJson = JSON.stringify(toolSchemas)
      toolsTokens = this.estimateText(toolsJson) + 12
    }

    // 3. Message History Tokens (Projected through compactor if session messages are large)
    let messageTokens = 0
    let sessionMessageCount = 0
    if (sessionId) {
      const session = this.ctx.session?.getSession ? this.ctx.session.getSession(sessionId) : null
      if (session && session.messages) {
        sessionMessageCount = session.messages.length
        let messagesToMeasure = session.messages
        if (this.ctx.compactor) {
          const compRes = this.ctx.compactor.compact([...session.messages])
          if (compRes.compacted) {
            messagesToMeasure = compRes.messages
          }
        }
        for (const msg of messagesToMeasure) {
          messageTokens += this.estimateMessage(msg)
        }
      }
    }

    let usedTokens = systemTokens + toolsTokens + messageTokens
    let isCalibrated = false
    const actualUsage = sessionId ? (this.sessionUsage?.get(sessionId) || undefined) : undefined
    const lastState = sessionId ? (this.lastSessionState?.get(sessionId) || undefined) : undefined

    // Ground context measurement with verified tokens from LLM turn if available
    if (lastState && lastState.promptTokens > 0) {
      const newMessagesCount = Math.max(0, sessionMessageCount - lastState.messageCount)
      const baselineContext = lastState.promptTokens + (actualUsage?.lastCompletionTokens || 0)
      if (newMessagesCount === 0) {
        usedTokens = baselineContext
        messageTokens = Math.max(0, usedTokens - systemTokens - toolsTokens)
        isCalibrated = true
      } else {
        const session = this.ctx.session?.getSession ? this.ctx.session.getSession(sessionId!) : null
        let deltaTokens = 0
        if (session && session.messages) {
          const newMessages = session.messages.slice(lastState.messageCount)
          for (const msg of newMessages) {
            deltaTokens += this.estimateMessage(msg)
          }
        }
        usedTokens = baselineContext + deltaTokens
        messageTokens = Math.max(0, usedTokens - systemTokens - toolsTokens)
        isCalibrated = true
      }
    }

    const percent = Math.min(100, Math.round((usedTokens / contextWindow) * 100))

    const breakdownTotal = Math.max(1, usedTokens)
    const systemPercent = Math.round((systemTokens / breakdownTotal) * 100)
    const toolsPercent = Math.round((toolsTokens / breakdownTotal) * 100)
    const messagePercent = Math.max(0, 100 - systemPercent - toolsPercent)

    const clampedTokens = Math.min(usedTokens, contextWindow)

    return {
      contextPressure: {
        usedTokens: clampedTokens,
        contextWindow,
        percent,
        projectedTokens: clampedTokens
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
      totalTokens: clampedTokens,
      percentage: percent,
      actualUsage,
      isCalibrated
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('tokenMeter', new TokenMeterService(ctx))
}

