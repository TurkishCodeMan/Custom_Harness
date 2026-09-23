import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ChatMessage } from '@custom-harness/core-types'

import type { AgentRunOptions, ToolExecutionContext } from './types.js'
import { extractThoughts } from './thoughts.js'
import { pruneToolMessages, ensureUserMessage } from './message-pruner.js'
import { resolveProviderAndModel, resolveActivePreset } from './resolver.js'
import { buildSystemPrompt } from './prompt-builder.js'
import { executeToolCall } from './tool-executor.js'

export * from './types.js'
export * from './thoughts.js'
export * from './message-pruner.js'
export * from './resolver.js'
export * from './prompt-builder.js'
export * from './tool-executor.js'

export const name = 'agent'
export const inject = [
  'session',
  'settings',
  'tools',
  'llm',
  'agentPresets',
  'persona',
  'systemPrompt',
  'repeatGuard',
  'toolResultPruner',
  'compactor',
  'approval',
  'spillStore',
  'agentMiddleware',
  'skills'
]

export class AgentService extends Service {
  static inject = inject

  constructor(ctx: Context) {
    super(ctx, 'agent')
  }

  /**
   * Asserts required core services exist on Context.
   * Enforces fail-fast principle: missing services cause immediate failure instead of hidden crashes.
   */
  public assertRequiredServices(): void {
    if (!this.ctx.session) {
      throw new Error("[AgentService] Zorunlu 'session' servisi Context üzerinde bulunamadı.")
    }
    if (!this.ctx.settings) {
      throw new Error("[AgentService] Zorunlu 'settings' servisi Context üzerinde bulunamadı.")
    }
    if (!this.ctx.llm) {
      throw new Error("[AgentService] Zorunlu 'llm' servisi Context üzerinde bulunamadı.")
    }
    if (!this.ctx.tools) {
      throw new Error("[AgentService] Zorunlu 'tools' servisi Context üzerinde bulunamadı.")
    }
  }

  /**
   * Main agent entrypoint running the interactive ReAct conversation loop.
   */
  public async run(options: AgentRunOptions): Promise<string> {
    this.assertRequiredServices()

    const { sessionId, prompt, signal } = options
    const runId = options.runId || `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const session = this.ctx.session.getSession(sessionId) || this.ctx.session.createSession(undefined, undefined, options.userId)

    // 1. Record User Prompt in canonical session history
    this.ctx.session.appendMessage(sessionId, {
      role: 'user',
      content: prompt,
      ...(options.isInternal ? { isInternal: true } : {})
    })

    const settings = this.ctx.settings.getSettings()
    const userId = options.userId || session.userId
    const userSettings = userId && this.ctx.settings?.getSettingsForUser
      ? this.ctx.settings.getSettingsForUser(userId)
      : settings

    // 2. Resolve Model, Provider, Preset, and Dynamic System Prompt
    const { provider, model } = resolveProviderAndModel(options, this.ctx.settings)
    const activePreset = resolveActivePreset(options, session, settings, userSettings, this.ctx, userId)
    const cwd = session.workspace || userSettings?.workspace || settings.workspace || process.cwd()
    const renderedSystemPrompt = buildSystemPrompt(this.ctx, activePreset, cwd)

    const systemPrompt: ChatMessage = {
      role: 'system',
      content: renderedSystemPrompt
    }

    // 3. Conversation & Tool Execution Loop
    let turnCount = 0
    const maxTurns = 60
    let finalResponse = ''

    // Ephemeral message queue: Injected strictly for the next LLM turn; NEVER persisted to disk/session
    let ephemeralQueue: ChatMessage[] = []
    let compactionEmitted = false

    while (turnCount < maxTurns) {
      if (signal?.aborted) break
      turnCount++

      // Apply Context Compaction strictly to LLM payload (does not mutate persistent session.messages)
      let compactedMessages = [...session.messages]
      if (this.ctx.compactor) {
        const compactionRes = this.ctx.compactor.compact(compactedMessages)
        if (compactionRes.compacted) {
          compactedMessages = compactionRes.messages
          if (!compactionEmitted) {
            compactionEmitted = true
            options.onCompaction?.({
              messageCount: compactionRes.prunedCount || 0,
              summary: compactionRes.summary || ''
            })
          }
        }
      }

      // Ensure at least one user query is always present in payload for model parsers
      compactedMessages = ensureUserMessage(compactedMessages, prompt)

      // Prune older tool result messages in payload to preserve critical context window headroom
      compactedMessages = pruneToolMessages(compactedMessages)

      // Prepare available tools schemas scoped to active preset
      const toolsToPass = this.ctx.tools.getOpenAiSchemas(activePreset?.enabledTools)

      // Execute Agent Middleware (beforeChat)
      const beforeChatCtx = {
        sessionId,
        userId,
        preset: activePreset,
        turnCount,
        signal,
        systemPrompt: renderedSystemPrompt,
        messages: compactedMessages,
        tools: toolsToPass,
        options: options as any,
        availableSkills: (() => {
          if (!this.ctx.skills) return []
          let list = this.ctx.skills.listActiveSkills(userId, false, cwd)
          if (activePreset?.enabledSkills && activePreset.enabledSkills.length > 0) {
            const allowedSet = new Set(activePreset.enabledSkills)
            list = list.filter((s: any) => allowedSet.has(s.id) || allowedSet.has(s.name))
          }
          return list.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description ?? ''
          }))
        })()
      }

      if (this.ctx.agentMiddleware?.runBeforeChat) {
        await this.ctx.agentMiddleware.runBeforeChat(beforeChatCtx)
      }

      // Consume ephemeral queue for this turn
      const ephemeralMessages = [...ephemeralQueue]
      ephemeralQueue = []

      const messagesToSend = [systemPrompt, ...beforeChatCtx.messages, ...ephemeralMessages]

      let currentAssistantContent = ''
      let currentThinking = ''
      const pendingToolCalls: { id: string; name: string; arguments: string }[] = []

      // Stream LLM chat completion
      for await (const event of this.ctx.llm.streamChat(messagesToSend, {
        provider,
        model,
        signal,
        tools: beforeChatCtx.tools,
        enableThinking: options.enableThinking,
        thinkingBudgetTokens: options.thinkingBudgetTokens,
        sessionId
      })) {
        if (signal?.aborted) break

        if (event.type === 'thought') {
          currentThinking += event.content || ''
          if (event.content) options.onThought?.(event.content)
        } else if (event.type === 'chunk') {
          currentAssistantContent += event.content || ''
          if (event.content) options.onChunk?.(event.content)
        } else if (event.type === 'tool_call' && event.toolCall) {
          pendingToolCalls.push({
            id: event.toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: event.toolCall.name,
            arguments: event.toolCall.arguments || ''
          })
        } else if (event.type === 'error') {
          const errMsg = `\n[Model Hatası: ${event.error}]`
          currentAssistantContent += errMsg
          options.onChunk?.(errMsg)
          console.error('[AgentService] LLM stream error:', event.error)
        } else if (event.type === 'done' && event.usage) {
          options.onUsage?.(event.usage)
        }
      }

      // Extract embedded XML thoughts if present in content
      const { cleanContent, finalThinking } = extractThoughts(currentAssistantContent, currentThinking)

      // Fallback: If model emitted thinking without tool calls but cleanContent is empty,
      // promote thinking to content so the user/caller receives the result
      const effectiveContent = cleanContent || (pendingToolCalls.length === 0 ? finalThinking : undefined)

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: effectiveContent || undefined,
        reasoning_content: finalThinking || undefined,
        presetName: activePreset?.name || activePreset?.id || 'Full-Stack Developer',
        modelName: model?.name || model?.id,
        ...(options.isInternal ? { isInternal: true } : {})
      }

      // Case A: Model issued tool calls
      if (pendingToolCalls.length > 0) {
        assistantMsg.tool_calls = pendingToolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments
          }
        }))
        this.ctx.session.appendMessage(sessionId, assistantMsg)
      }

      // Case B: No tool calls emitted — check post-chat middleware
      if (pendingToolCalls.length === 0) {
        if (this.ctx.agentMiddleware?.runAfterChat) {
          const chatOutcome = await this.ctx.agentMiddleware.runAfterChat({
            sessionId,
            userId,
            preset: activePreset,
            turnCount,
            signal,
            assistantMessage: assistantMsg
          })

          if (chatOutcome.shouldContinue && turnCount < maxTurns) {
            if (chatOutcome.prompt) {
              ephemeralQueue.push({ role: 'user', content: chatOutcome.prompt })
            }
            continue
          }
        }

        if (options.autonomous && turnCount < maxTurns && !assistantMsg.content) {
          ephemeralQueue.push({
            role: 'user',
            content: '[INSTRUCTION]: You are in autonomous execution mode. Continue your task by executing tools. When you have completed the task, provide your final response directly to the user.'
          })
          continue
        }

        // Conversation turn completed with meaningful output — persist final assistant response
        this.ctx.session.appendMessage(sessionId, assistantMsg)
        finalResponse = effectiveContent || finalThinking || ''
        break
      }


      // Execute Tools in Parallel via Promise.all (with per-tool safety, approval, backoff, and event emission)
      const toolExecContext: ToolExecutionContext = {
        sessionId,
        runId,
        userId,
        activePreset,
        turnCount,
        signal,
        cwd,
        onToolStart: options.onToolStart,
        onToolResult: options.onToolResult
      }

      await Promise.all(
        pendingToolCalls.map(async (call) => {
          if (signal?.aborted) return
          await executeToolCall(this.ctx, call, toolExecContext)
        })
      )
    }

    if (this.ctx.repeatGuard) {
      this.ctx.repeatGuard.reset(sessionId)
    }

    return finalResponse
  }
}

export function apply(ctx: Context) {
  ctx.set('agent', new AgentService(ctx))
}
