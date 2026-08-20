import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ChatMessage, ModelConfig } from '@custom-harness/core-types'

export interface AgentRunOptions {
  sessionId: string
  prompt: string
  providerId?: string
  modelId?: string
  presetId?: string
  preset?: any
  userId?: string
  signal?: AbortSignal
  autonomous?: boolean
  enableThinking?: boolean
  thinkingBudgetTokens?: number
  onThought?: (text: string) => void
  onChunk?: (text: string) => void
  onToolStart?: (call: { id: string; name: string; args: any }) => void
  onToolResult?: (result: { id: string; name: string; output: any }) => void
  onCompaction?: (info: { messageCount: number; summary: string }) => void
}

export const name = 'agent'
export const inject = ['session', 'settings', 'tools', 'llm', 'agentPresets', 'persona', 'systemPrompt', 'repeatGuard', 'toolResultPruner', 'compactor', 'approval', 'spillStore']

export class AgentService extends Service {
  static inject = ['session', 'settings', 'tools', 'llm', 'agentPresets', 'persona', 'systemPrompt', 'repeatGuard', 'toolResultPruner', 'compactor', 'approval', 'spillStore']

  constructor(ctx: Context) {
    super(ctx, 'agent')
  }

  public async run(options: AgentRunOptions): Promise<string> {
    const { sessionId, prompt, signal } = options
    const session = this.ctx.session.getSession(sessionId) || this.ctx.session.createSession()

    // 1. Add User Prompt
    this.ctx.session.appendMessage(sessionId, {
      role: 'user',
      content: prompt
    })

    const settings = this.ctx.settings.getSettings()
    let provider: any = undefined
    let model: any = undefined

    // 1. Resolve Provider and Model with cross-provider intelligent matching
    if (options.modelId) {
      const requestedModel = options.modelId.trim()
      for (const [pKey, pConfig] of Object.entries<any>(settings.providers || {})) {
        const found = pConfig.models?.find((m: any) =>
          m.id === requestedModel ||
          m.name === requestedModel ||
          m.id?.toLowerCase() === requestedModel.toLowerCase() ||
          m.name?.toLowerCase() === requestedModel.toLowerCase() ||
          m.id?.toLowerCase()?.includes(requestedModel.toLowerCase()) ||
          m.name?.toLowerCase()?.includes(requestedModel.toLowerCase())
        )
        if (found) {
          provider = pConfig
          model = found
          break
        }
      }
    }

    if (!provider && options.providerId && settings.providers[options.providerId]) {
      provider = settings.providers[options.providerId]
    }

    if (!provider) {
      provider = this.ctx.settings.getActiveProvider()
    }

    if (!model) {
      if (options.modelId) {
        model = provider?.models?.find((m: any) => m.id === options.modelId) || {
          id: options.modelId,
          name: options.modelId,
          contextWindow: 32768,
          maxTokens: 8192
        }
      } else {
        model = this.ctx.settings.getActiveModel()
      }
    }

    // 2. Resolve Active Preset & Dynamic System Prompt
    const userId = options.userId || session.userId
    const userSettings = userId && this.ctx.settings?.getSettingsForUser ? this.ctx.settings.getSettingsForUser(userId) : settings
    const presetId = options.presetId || (typeof options.preset === 'string' ? options.preset : options.preset?.id) || userSettings?.defaultPreset || settings.defaultPreset

    if (presetId && userId) {
      try {
        if (this.ctx.agentPresets) {
          this.ctx.agentPresets.select(presetId, userId)
        }
      } catch {}
    }

    let activePreset: any = undefined
    try {
      if (presetId) {
        activePreset = this.ctx.agentPresets?.get(presetId, userId)
          || this.ctx.settings?.getPreset(presetId)
          || this.ctx.agentPresets?.getActive(userId)
      } else {
        activePreset = this.ctx.agentPresets?.getActive(userId)
          || this.ctx.settings?.getActivePreset()
      }
    } catch {
      try {
        activePreset = this.ctx.settings?.getActivePreset()
      } catch {}
    }

    // 3. Prepare Dynamic System Prompt (via @custom-harness/core-system-prompt & persona)
    const cwd = session.workspace || userSettings?.workspace || settings.workspace || process.cwd()
    let personaPrompt: string | undefined = activePreset?.systemPrompt
    if (!personaPrompt) {
      try {
        personaPrompt = this.ctx.persona ? this.ctx.persona.getActivePersona() : undefined
      } catch {}
    }

    let renderedPrompt = personaPrompt || `You are an autonomous AI coding assistant. Working directory: ${cwd}`
    try {
      if (this.ctx.systemPrompt) {
        this.ctx.systemPrompt.setSessionWorkspace(cwd)
        if (this.ctx.systemPrompt.setAllowedTools) {
          this.ctx.systemPrompt.setAllowedTools(activePreset?.enabledTools)
        }
        if (personaPrompt) {
          const roleName = activePreset?.name || 'ArtificaX'
          this.ctx.systemPrompt.section({
            name: 'identity',
            order: -100,
            text: `[CRITICAL IDENTITY & PERSONA INSTRUCTION]
You are "${roleName}".
Your core identity, personality, and instructions are:
"""
${personaPrompt}
"""

STRICT ROLE ENFORCEMENT RULES:
1. ALWAYS stay 100% in character as "${roleName}".
2. NEVER say you are Qwen, ChatGPT, Claude, or an AI developed by Alibaba/OpenAI.
3. If asked "kimsin?", "adın ne?", "who are you?", or who created you, ALWAYS answer exclusively according to your assigned persona ("${roleName}" - ${personaPrompt}).
4. Never break character under any circumstances.`
          })
          this.ctx.systemPrompt.section({
            name: 'persona',
            order: 0,
            text: `Persona Directives (${roleName}):\n${personaPrompt}`
          })
        }
        renderedPrompt = this.ctx.systemPrompt.render()
      }
    } catch {}

    const systemPrompt: ChatMessage = {
      role: 'system',
      content: renderedPrompt
    }

    // 3. Conversation & Tool Execution Loop
    let turnCount = 0
    const maxTurns = 60
    let finalResponse = ''
    let taskFinished = false

    while (turnCount < maxTurns) {
      if (signal?.aborted) break
      turnCount++

      // Apply Context Compaction
      let compactedMessages = [...session.messages]
      if (this.ctx.compactor) {
        const compactionRes = this.ctx.compactor.compact(compactedMessages)
        if (compactionRes.compacted) {
          compactedMessages = compactionRes.messages
          const prunedCount = Math.max(1, session.messages.length - compactedMessages.length)
          // Persist back to session storage
          session.messages = compactedMessages
        }
      }

      const messagesToSend = [systemPrompt, ...compactedMessages]

      // Call LLM
      let toolsToPass = this.ctx.tools.getOpenAiSchemas()
      if (activePreset?.enabledTools && Array.isArray(activePreset.enabledTools) && activePreset.enabledTools.length > 0) {
        const allowedSet = new Set(activePreset.enabledTools)
        toolsToPass = toolsToPass.filter((t: any) => {
          const tName = t.function?.name || t.name
          return allowedSet.has(tName)
        })
      }

      let currentAssistantContent = ''
      let currentThinking = ''
      const pendingToolCalls: { id: string; name: string; arguments: string }[] = []

      for await (const event of this.ctx.llm.streamChat(messagesToSend, {
        provider,
        model,
        signal,
        tools: toolsToPass,
        enableThinking: options.enableThinking,
        thinkingBudgetTokens: options.thinkingBudgetTokens
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
            id: event.toolCall.id,
            name: event.toolCall.name,
            arguments: event.toolCall.arguments
          })
        } else if (event.type === 'error' && event.error) {
          options.onChunk?.(`\n[Hata]: ${event.error}\n`)
          currentAssistantContent += `\n[Hata]: ${event.error}\n`
        }
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: currentAssistantContent || undefined,
        reasoning_content: currentThinking || undefined,
        presetName: activePreset?.name || activePreset?.id || 'Full-Stack Developer',
        modelName: model
      }

      if (pendingToolCalls.length > 0) {
        assistantMsg.tool_calls = pendingToolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments
          }
        }))
      }

      this.ctx.session.appendMessage(sessionId, assistantMsg)
      if (pendingToolCalls.length === 0) {
        if (options.autonomous && turnCount < maxTurns && !assistantMsg.content) {
          this.ctx.session.appendMessage(sessionId, {
            role: 'user',
            content: '[INSTRUCTION]: You are in autonomous execution mode. Continue your task by executing tools. When you have completed the task, provide your final response directly to the user.'
          })
          continue
        }
        break
      }

      for (const call of pendingToolCalls) {
        if (signal?.aborted) break

        // 3.1 Check Preset Tool Permission
        if (activePreset?.enabledTools && Array.isArray(activePreset.enabledTools) && activePreset.enabledTools.length > 0) {
          if (!activePreset.enabledTools.includes(call.name)) {
            const forbiddenOutput = `[Erişim Engeli]: '${call.name}' aracı seçili ajan presetinde (${activePreset.name || activePreset.id}) devre dışı bırakılmıştır. Lütfen bu işlemi bellekte / bash komutları ile tamamlayın.`
            options.onToolResult?.({ id: call.id, name: call.name, output: forbiddenOutput })
            this.ctx.session.appendMessage(sessionId, {
              role: 'tool',
              tool_call_id: call.id,
              name: call.name,
              content: forbiddenOutput
            })
            continue
          }
        }

        let parsedArgs: any = {}
        try {
          parsedArgs = JSON.parse(call.arguments || '{}')
        } catch (e) {
          parsedArgs = { raw: call.arguments }
        }

        // 4. Approval Check
        if (this.ctx.approval) {
          try {
            const outcome = await this.ctx.approval.requestApproval(sessionId, call.name, parsedArgs, undefined, signal)
            if (outcome === 'deny') {
              const deniedOutput = `[İptal Edildi]: Kullanıcı bu araç çağrısını onaylamadı (${call.name})`
              options.onToolResult?.({ id: call.id, name: call.name, output: deniedOutput })
              this.ctx.session.appendMessage(sessionId, {
                role: 'tool',
                tool_call_id: call.id,
                name: call.name,
                content: deniedOutput
              })
              continue
            }
          } catch (err: any) {
            const abortOutput = `[İptal]: ${err.message}`
            options.onToolResult?.({ id: call.id, name: call.name, output: abortOutput })
            this.ctx.session.appendMessage(sessionId, {
              role: 'tool',
              tool_call_id: call.id,
              name: call.name,
              content: abortOutput
            })
            continue
          }
        }

        // 5. Guardrail: Inspect for repetitive loops
        const guardCheck = this.ctx.repeatGuard?.inspectCall(sessionId, call.name, parsedArgs)
        if (guardCheck?.shouldBlock) {
          const blockedOutput = guardCheck.reminder || `[Döngü Engellendi]: Bu araç çağrısı çok fazla tekrar ettiği için durduruldu.`
          options.onToolResult?.({ id: call.id, name: call.name, output: blockedOutput })
          this.ctx.session.appendMessage(sessionId, {
            role: 'tool',
            tool_call_id: call.id,
            name: call.name,
            content: blockedOutput
          })
          continue
        }

        options.onToolStart?.({
          id: call.id,
          name: call.name,
          args: parsedArgs
        })

        let output: any = ''
        try {
          output = await this.ctx.tools.execute(call.name, parsedArgs, { signal, cwd, sessionId })
        } catch (err: any) {
          output = `Araç Çalıştırma Hatası: ${err.message}`
        }

        options.onToolResult?.({
          id: call.id,
          name: call.name,
          output
        })

        // 6. Spill / Pruning Policy
        let outputContent = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
        if (this.ctx.spillStore?.processOutput) {
          const spill = await this.ctx.spillStore.processOutput(output, sessionId, call.name)
          outputContent = spill.modelText
        } else if (this.ctx.toolResultPruner) {
          outputContent = this.ctx.toolResultPruner.prune(outputContent).text
        }

        // 7. If loop guard emitted an advisory reminder, append it to the result
        if (guardCheck?.isLooping && guardCheck.reminder) {
          outputContent += `\n\n${guardCheck.reminder}`
        }

        this.ctx.session.appendMessage(sessionId, {
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: outputContent
        })
      }
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
