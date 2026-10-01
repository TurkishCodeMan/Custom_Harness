import type { Context } from '@custom-harness/core-context'
import type {
  AgentMiddlewareDefinition,
  BeforeChatContext,
  BeforeToolContext,
  AfterToolContext,
  AfterChatContext
} from '@custom-harness/agent-middleware'
import type { AgentTurnSnapshot, ToolExecutionRecord } from '@custom-harness/inspector'
import type { LocalInspectorService } from './index.js'

function estimateTokens(ctx: Context, text: string): number {
  if (!text) return 0
  try {
    const tm = (ctx as any).tokenMeter || (ctx as any).get?.('tokenMeter', false)
    if (tm?.estimateText) {
      return tm.estimateText(text)
    }
  } catch {}
  return Math.max(1, Math.ceil(text.length / 3.6))
}

export function createInspectorMiddleware(
  service: LocalInspectorService,
  ctx: Context
): AgentMiddlewareDefinition {
  const activeToolStartTimes = new Map<string, number>()

  return {
    name: 'inspector-interceptor',
    // Order 999 ensures this middleware runs AFTER other middlewares have added/pruned messages,
    // so it records the exact, final payload being dispatched to the LLM.
    order: 999,

    beforeChat: async (beforeCtx: BeforeChatContext, next: () => Promise<void>) => {
      // 1. Run remaining middlewares first so we capture the true final state
      await next()

      const {
        sessionId,
        userId,
        preset,
        turnCount,
        systemPrompt,
        messages,
        tools,
        options,
        availableSkills
      } = beforeCtx

      // Estimate tokens
      const systemPromptTokens = estimateTokens(ctx, systemPrompt || '')
      const messagesText = messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n')
      const messagesTokens = estimateTokens(ctx, messagesText)
      const toolsText = JSON.stringify(tools || [])
      const toolsTokens = estimateTokens(ctx, toolsText)
      const totalTokens = systemPromptTokens + messagesTokens + toolsTokens

      // Extract original user prompt from options or find last user message in conversation
      const prompt = (options as any)?.prompt ||
        [...messages].reverse().find((m) => m.role === 'user')?.content?.toString() ||
        ''

      const turnId = `turn_${sessionId}_t${turnCount}_${Date.now()}`

      const snapshot: AgentTurnSnapshot = {
        id: turnId,
        sessionId,
        turnCount,
        timestamp: Date.now(),
        status: 'running',
        input: {
          sessionId,
          prompt,
          userId,
          presetId: preset?.id,
          presetName: preset?.name,
          workspace: (options as any)?.workspace || preset?.workspace,
          availableSkills: availableSkills?.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description
          })),
          options: {
            provider: (options as any)?.provider || preset?.providerId || (preset as any)?.provider,
            model: (options as any)?.model || preset?.modelId || (preset as any)?.model,
            enableThinking: (options as any)?.enableThinking,
            thinkingBudgetTokens: (options as any)?.thinkingBudgetTokens,
            maxTurns: (options as any)?.maxTurns
          }
        },
        context: {
          systemPrompt,
          sessionMessagesCount: (ctx.session?.getSession?.(sessionId)?.messages?.length) || messages.length,
          conversationMessagesCount: messages.length,
          compacted: Boolean((options as any)?._compacted)
        },
        llmPayload: {
          provider: (options as any)?.provider || preset?.providerId || (preset as any)?.provider || 'default',
          model: (options as any)?.model || preset?.modelId || (preset as any)?.model || 'default',
          messagesToSend: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          tools: tools || [],
          enableThinking: (options as any)?.enableThinking,
          thinkingBudgetTokens: (options as any)?.thinkingBudgetTokens,
          estimatedTokens: {
            systemPromptTokens,
            messagesTokens,
            toolsTokens,
            totalTokens
          }
        },
        toolExecutions: []
      }

      await service.recordTurnStart(snapshot)
    },

    beforeTool: async (toolCtx: BeforeToolContext, next: () => Promise<void>) => {
      activeToolStartTimes.set(toolCtx.toolCallId, Date.now())
      await next()
    },

    afterTool: async (toolCtx: AfterToolContext, next: () => Promise<void>) => {
      await next()

      const startedAt = activeToolStartTimes.get(toolCtx.toolCallId) || Date.now()
      const completedAt = Date.now()
      const durationMs = completedAt - startedAt
      activeToolStartTimes.delete(toolCtx.toolCallId)

      const outputStr = typeof toolCtx.output === 'string' ? toolCtx.output : JSON.stringify(toolCtx.output)
      const isSpilled = Boolean(outputStr && outputStr.includes('[⚠️ ÇIKTI TAŞMASI'))

      let spillFilePath: string | undefined = undefined
      if (isSpilled) {
        const match = outputStr.match(/Dosya Yolu:\s*([^\n\r]+)/)
        if (match?.[1]) {
          spillFilePath = match[1].trim()
        }
      }

      const toolRecord: ToolExecutionRecord = {
        callId: toolCtx.toolCallId,
        toolName: toolCtx.toolName,
        args: toolCtx.params,
        output: toolCtx.output,
        durationMs,
        spilled: isSpilled,
        spillFilePath,
        startedAt,
        completedAt
      }

      await service.recordToolExecution(toolCtx.sessionId, toolRecord)
    },

    afterChat: async (chatCtx: AfterChatContext, next: () => Promise<void>) => {
      await next()

      const { assistantMessage, sessionId } = chatCtx
      const toolCalls = assistantMessage.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function?.name || '',
        arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}
      }))

      await service.recordTurnEnd(sessionId, {
        assistantContent: typeof assistantMessage.content === 'string' ? assistantMessage.content : undefined,
        thinkingContent: assistantMessage.reasoning_content,
        toolCalls,
        completedAt: Date.now()
      })
    }
  }
}
