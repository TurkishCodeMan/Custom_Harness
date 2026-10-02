import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ChatMessage } from '@custom-harness/core-types'

import type { AgentRunOptions, ToolExecutionContext } from './types.js'
import { extractThoughts } from './thoughts.js'
import { ensureUserMessage, stripReasoningFromHistory, applyToolOutputSlidingWindow } from './message-pruner.js'
import { resolveProviderAndModel, resolveActivePreset } from './resolver.js'
import { buildSystemPrompt } from './prompt-builder.js'
import { executeToolCall } from './tool-executor.js'
import { prepareToolsForPreset, resolveAvailableSkills } from './tool-scoper.js'

export * from './types.js'
export * from './thoughts.js'
export * from './message-pruner.js'
export * from './resolver.js'
export * from './prompt-builder.js'
export * from './tool-executor.js'
export * from './tool-scoper.js'
export * from './schema-validator.js'
export * from './contract-delegator.js'

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

// ─── Spill / SlidingWindow eşik hizalaması (Sorun #1) ─────────────────────────
// SpillStore 3000 token ≈ 10.800 char sonra devreye girer.
// SlidingWindow "in-window" üst sınırı spill eşiğiyle hizalı olmalı:
// spill devreye girmeden sliding window kesmemeli, aksi hâlde model
// "dosyaya bak" ipucu alır ama dosya yazılmamış olur.
//
// Kural: SLIDING_WINDOW_MAX_CHARS ≥ SPILL_THRESHOLD_CHARS
// Spill eşiği: ~10.800 char  →  Sliding window max: 12.000 char (biraz üstünde)
const SLIDING_WINDOW_MAX_CHARS = 12_000 // spill eşiğinin (~10.800) üzerinde tutulur

export class AgentService extends Service {
  static inject = inject

  constructor(ctx: Context) {
    super(ctx, 'agent')
  }

  /**
   * Fail-fast guard: missing core services surface immediately rather than
   * causing silent crashes deep inside the loop.
   */
  public assertRequiredServices(): void {
    const required = ['session', 'settings', 'llm', 'tools'] as const
    for (const svc of required) {
      if (!this.ctx[svc]) {
        throw new Error(`[AgentService] Zorunlu '${svc}' servisi Context üzerinde bulunamadı.`)
      }
    }
  }

  /**
   * Build the clean LLM payload for one turn from canonical session history.
   *
   * Returns ONLY the conversation messages (no system prompt) so the caller
   * controls where system goes. This avoids the fragile .slice(1) pattern (Sorun #3).
   *
   * Never mutates session.messages.
   */
  private buildConversationPayload(
    sessionMessages: ChatMessage[],
    prompt: string,
    ephemeral: ChatMessage[],
    onCompaction?: AgentRunOptions['onCompaction']
  ): ChatMessage[] {
    let msgs = [...sessionMessages]

    // Compact if compactor is available — fire onCompaction exactly once (Sorun #5 fix)
    if (this.ctx.compactor) {
      const result = this.ctx.compactor.compact(msgs)
      if (result.compacted) {
        msgs = result.messages
        onCompaction?.({
          messageCount: result.prunedCount || 0,
          summary: result.summary || ''
        })
      }
    }

    // Pipeline: ensure structure → strip reasoning → sliding window
    msgs = ensureUserMessage(msgs, prompt)
    msgs = stripReasoningFromHistory(msgs)
    // Sorun #1: maxToolChars is set above spill threshold so sliding window
    // never truncates content that hasn't been spilled yet.
    msgs = applyToolOutputSlidingWindow(msgs, 6, SLIDING_WINDOW_MAX_CHARS)

    // Append ephemeral messages at the end (Sorun #4: accepts any ChatMessage role)
    return [...msgs, ...ephemeral]
  }

  /**
   * Main agent entrypoint: ReAct conversation loop.
   */
  public async run(options: AgentRunOptions): Promise<string> {
    this.assertRequiredServices()

    const { sessionId, prompt, signal } = options
    const runId = options.runId || `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

    // Resolve or create session
    const session = this.ctx.session.getSession(sessionId) || this.ctx.session.createSession(undefined, undefined, options.userId)

    // Record user prompt in canonical session history
    this.ctx.session.appendMessage(sessionId, {
      role: 'user',
      content: prompt,
      ...(options.isInternal ? { isInternal: true } : {})
    })

    // Resolve settings, model, preset, workspace
    const settings = this.ctx.settings.getSettings()
    const userId = options.userId || session.userId
    const userSettings = userId && this.ctx.settings?.getSettingsForUser
      ? this.ctx.settings.getSettingsForUser(userId)
      : settings

    const activePreset = resolveActivePreset(options, session, settings, userSettings, this.ctx, userId)
    const { provider, model } = resolveProviderAndModel(options, this.ctx.settings, activePreset)
    const cwd = options.workspace || activePreset?.workspace || session.workspace || userSettings?.workspace || settings.workspace || process.cwd()

    const systemPrompt: ChatMessage = {
      role: 'system',
      content: buildSystemPrompt(this.ctx, activePreset, cwd, options.systemPrompt)
    }

    // Sorun #2: maxTurns is configurable per run, preset, or caller; defaults to 60
    const maxTurns = options.maxTurns ?? (activePreset?.maxTurns as number | undefined) ?? 60
    let turnCount = 0
    let finalResponse = ''

    // Sorun #4: ephemeralQueue now holds ChatMessage (any role), not just user strings
    let ephemeralQueue: ChatMessage[] = []

    // onCompaction fires at most once per run — closure captures compactionFired by reference
    let compactionFired = false
    const onCompactionOnce: AgentRunOptions['onCompaction'] = (info) => {
      if (!compactionFired) {
        compactionFired = true
        options.onCompaction?.(info)
      }
    }

    while (turnCount < maxTurns) {
      if (signal?.aborted) break
      turnCount++

      // Drain ephemeral queue for this turn
      const ephemeral = [...ephemeralQueue]
      ephemeralQueue = []

      const presetsResolver = (this.ctx as any).agentPresets || (this.ctx as any).settings
      const toolsToPass = prepareToolsForPreset(this.ctx.tools, activePreset, presetsResolver, userId)
      const availableSkills = resolveAvailableSkills(this.ctx.skills, activePreset, userId, cwd)

      // Build conversation payload (no system prompt — added explicitly below)
      // Sorun #3: no more .slice(1) fragility; system is never inside the array
      const conversationMessages = this.buildConversationPayload(
        session.messages,
        prompt,
        ephemeral,
        onCompactionOnce
      )

      // Run beforeChat middleware — receives conversation messages only (no system)
      const beforeChatCtx = {
        sessionId,
        userId,
        preset: activePreset,
        turnCount,
        signal,
        systemPrompt: systemPrompt.content as string,
        messages: conversationMessages,
        tools: toolsToPass,
        options: options as any,
        availableSkills
      }

      if (this.ctx.agentMiddleware?.runBeforeChat) {
        await this.ctx.agentMiddleware.runBeforeChat(beforeChatCtx)
      }

      // System prompt is prepended explicitly — always first, never duplicated
      const messagesToSend: ChatMessage[] = [systemPrompt, ...beforeChatCtx.messages]

      // Stream LLM response
      let assistantContent = ''
      let thinkingContent = ''
      let lastUsage: any = undefined
      const pendingToolCalls: { id: string; name: string; arguments: string }[] = []

      const effectiveResponseFormat = options.responseFormat || activePreset?.responseFormat
      const effectiveTemperature = typeof options.temperature === 'number'
        ? options.temperature
        : (typeof activePreset?.temperature === 'number' ? activePreset.temperature : undefined)

      for await (const event of this.ctx.llm.streamChat(messagesToSend, {
        provider,
        model,
        signal,
        tools: beforeChatCtx.tools,
        enableThinking: options.enableThinking,
        thinkingBudgetTokens: options.thinkingBudgetTokens,
        responseFormat: effectiveResponseFormat,
        temperature: effectiveTemperature,
        sessionId
      })) {
        if (signal?.aborted) break

        switch (event.type) {
          case 'thought':
            thinkingContent += event.content || ''
            if (event.content) options.onThought?.(event.content)
            break
          case 'chunk':
            assistantContent += event.content || ''
            if (event.content) options.onChunk?.(event.content)
            break
          case 'tool_call':
            if (event.toolCall) {
              pendingToolCalls.push({
                id: event.toolCall.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: event.toolCall.name,
                arguments: event.toolCall.arguments || ''
              })
            }
            break
          case 'error': {
            const errMsg = `\n[Model Error: ${event.error}]`
            assistantContent += errMsg
            options.onChunk?.(errMsg)
            console.error('[AgentService] LLM stream error:', event.error)
            break
          }
          case 'done':
            if (event.usage) {
              lastUsage = event.usage
              options.onUsage?.(event.usage)
              if (typeof (this.ctx as any).emit === 'function') {
                (this.ctx as any).emit('llm/token-usage', { sessionId, model: model?.id, usage: event.usage })
              }
            }
            break
        }
      }

      // Extract embedded XML thoughts if model writes them inline
      const { cleanContent, finalThinking } = extractThoughts(assistantContent, thinkingContent)

      // If model only thought but produced no content and no tool calls, surface the thinking as response
      const effectiveContent = cleanContent || (pendingToolCalls.length === 0 ? finalThinking : undefined)

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: effectiveContent || undefined,
        reasoning_content: finalThinking || undefined,
        presetName: activePreset?.name || activePreset?.id || 'Full-Stack Developer',
        modelName: model?.name || model?.id,
        tokenUsage: lastUsage,
        ...(options.isInternal ? { isInternal: true } : {})
      }

      if (pendingToolCalls.length > 0) {
        // Tool execution turn: persist assistant + tool_calls, then run tools sequentially
        // (sequential = deterministic ordering; parallel caused filesystem race conditions)
        assistantMsg.tool_calls = pendingToolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments }
        }))
        this.ctx.session.appendMessage(sessionId, assistantMsg)

        const toolCtx: ToolExecutionContext = {
          sessionId, runId, userId, activePreset, turnCount, signal, cwd,
          onToolStart: options.onToolStart,
          onToolResult: options.onToolResult
        }
        await Promise.all(pendingToolCalls.map(call => executeToolCall(this.ctx, call, toolCtx)))
      } else {
        // Final turn: afterChat middleware → autonomous continuation → done
        if (this.ctx.agentMiddleware?.runAfterChat) {
          const outcome = await this.ctx.agentMiddleware.runAfterChat({
            sessionId, userId, preset: activePreset, turnCount, signal, assistantMessage: assistantMsg
          })

          if (outcome.shouldContinue && turnCount < maxTurns) {
            // Sorun #4: middleware can inject any ChatMessage role into the queue
            if (outcome.prompt) {
              ephemeralQueue.push({ role: 'user', content: outcome.prompt })
            }
            if (outcome.messages?.length) {
              ephemeralQueue.push(...(outcome.messages as ChatMessage[]))
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

        finalResponse = effectiveContent || finalThinking || ''
        this.ctx.session.appendMessage(sessionId, assistantMsg)
        break
      }
    }

    this.ctx.repeatGuard?.reset(sessionId)
    return finalResponse
  }
}

export function apply(ctx: Context) {
  ctx.set('agent', new AgentService(ctx))
}
