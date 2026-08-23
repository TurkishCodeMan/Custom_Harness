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
export const inject = ['session', 'settings', 'tools', 'llm', 'agentPresets', 'persona', 'systemPrompt', 'repeatGuard', 'toolResultPruner', 'compactor', 'approval', 'spillStore', 'agentMiddleware', 'skills']

export class AgentService extends Service {
  static inject = ['session', 'settings', 'tools', 'llm', 'agentPresets', 'persona', 'systemPrompt', 'repeatGuard', 'toolResultPruner', 'compactor', 'approval', 'spillStore', 'agentMiddleware', 'skills']




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
          contextWindow: 24576,
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

[CRITICAL OPERATIONAL RULES & TOOL EXECUTION PROTOCOL]
1. TOOL-FIRST PROACTIVE EXECUTION:
   - When given a task, DO NOT output introductory conversational filler (e.g. do NOT say "Öncelikle inceleyelim...", "Adım 1...", "Şimdi yapıyorum...").
   - You MUST immediately emit the required tool calls (e.g. fs, bash, skill, etc.) to perform the necessary actions.

2. ACCURATE EXECUTION & FILE MANAGEMENT:
   - Inspect files and execute commands appropriately for the given role and user instructions.
   - When editing or creating project files, use available tools proactively.

STRICT ROLE ENFORCEMENT / KİMLİK KURALLARI:
1. ALWAYS stay 100% in character as "${roleName}".
4. If asked "kimsin?", "adın ne?", "who are you?", ALWAYS answer directly that you are "${roleName}".`
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

    while (turnCount < maxTurns) {
      if (signal?.aborted) break
      turnCount++

      // Apply Context Compaction
      let compactedMessages = [...session.messages]
      if (this.ctx.compactor) {
        const compactionRes = this.ctx.compactor.compact(compactedMessages)
        if (compactionRes.compacted) {
          compactedMessages = compactionRes.messages
          // Persist back to session storage
          session.messages = compactedMessages
        }
      }

      // Get all available tools; tool-filter middleware will narrow this list for the active preset
      const toolsToPass = this.ctx.tools.getOpenAiSchemas()

      // Execute Agent Middleware (beforeChat)
      // IMPORTANT: capture as a named object so mutations to ctx.messages / ctx.tools
      // by middlewares (skill-pruner, tool-filter, skill-reminder, etc.) are visible below.
      const beforeChatCtx = {
        sessionId,
        userId,
        preset: activePreset,
        turnCount,
        signal,
        systemPrompt: renderedPrompt,
        messages: compactedMessages,
        tools: toolsToPass,
        options: options as any,
        availableSkills: this.ctx.skills
          ? this.ctx.skills.listActiveSkills(userId).map((s: any) => ({
              id: s.id,
              name: s.name,
              description: s.description ?? ''
            }))
          : []
      }
      await this.ctx.agentMiddleware.runBeforeChat(beforeChatCtx)

      const messagesToSend = [systemPrompt, ...beforeChatCtx.messages]

      let currentAssistantContent = ''
      let currentThinking = ''
      const pendingToolCalls: { id: string; name: string; arguments: string }[] = []

      for await (const event of this.ctx.llm.streamChat(messagesToSend, {
        provider,
        model,
        signal,
        tools: beforeChatCtx.tools,
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
            id: event.toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: event.toolCall.name,
            arguments: event.toolCall.arguments || ''
          })
          options.onToolStart?.({
            id: event.toolCall.id || '',
            name: event.toolCall.name,
            args: event.toolCall.arguments
          })
        }

      }

      finalResponse = currentAssistantContent
      let finalContent = currentAssistantContent
      let finalThinking = currentThinking

      // Extract thoughts
      if (finalContent.includes('<thought>') || finalContent.includes('<think>') || finalContent.includes('<commentary>')) {
        const extracted: string[] = []
        const regex = /<(?:thought|think|commentary)(?:>|[\s\n\r])([\s\S]*?)(?:<\/(?:thought|think|commentary)>|$)/gi
        let match: RegExpExecArray | null
        while ((match = regex.exec(finalContent)) !== null) {
          if (match[1]?.trim()) {
            extracted.push(match[1].trim())
          }
        }
        if (extracted.length > 0) {
          finalThinking = finalThinking ? `${finalThinking}\n\n${extracted.join('\n\n')}` : extracted.join('\n\n')
          finalContent = finalContent.replace(/<(?:thought|think|commentary)(?:>|[\s\n\r])[\s\S]*?(?:<\/(?:thought|think|commentary)>|$)/gi, '').trim()
        }
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: finalContent || undefined,
        reasoning_content: finalThinking || undefined,
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
      
      // Post-chat middleware check
      if (pendingToolCalls.length === 0) {
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
            this.ctx.session.appendMessage(sessionId, {
              role: 'user',
              content: chatOutcome.prompt
            })
          }
          continue
        }
        if (options.autonomous && turnCount < maxTurns && !assistantMsg.content) {
          this.ctx.session.appendMessage(sessionId, {
            role: 'user',
            content: '[INSTRUCTION]: You are in autonomous execution mode. Continue your task by executing tools. When you have completed the task, provide your final response directly to the user.'
          })
          continue
        }
        break
      }

      // Execute Tools
      for (const call of pendingToolCalls) {
        if (signal?.aborted) break

        let parsedArgs: any = {}
        try {
          parsedArgs = JSON.parse(call.arguments || '{}')
        } catch (e) {
          parsedArgs = { raw: call.arguments }
        }

        // Execute Agent Middleware (beforeTool)
        // tool-guard and sql-safety-guard middlewares handle permission checks
        const toolCheck = await this.ctx.agentMiddleware.runBeforeTool({
          sessionId,
          userId,
          preset: activePreset,
          turnCount,
          signal,
          toolName: call.name,
          params: parsedArgs,
          toolCallId: call.id
        })
        if (toolCheck.shouldBlock) {
          const blockedOutput = toolCheck.output ?? `[Erişim Engeli]: '${call.name}' araç çağrısı güvenlik politikası gereği durduruldu.`
          options.onToolResult?.({ id: call.id, name: call.name, output: blockedOutput })
          this.ctx.session.appendMessage(sessionId, {
            role: 'tool',
            tool_call_id: call.id,
            name: call.name,
            content: blockedOutput
          })
          continue
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

        // 5. Guardrail & Execute
        let guardCheck: { isLooping: boolean; reminder?: string; shouldBlock?: boolean } | undefined = undefined
        if (this.ctx.repeatGuard) {
          guardCheck = this.ctx.repeatGuard.inspectCall(sessionId, call.name, parsedArgs)
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
        }

        let output: any = ''
        try {
          output = await this.ctx.tools.execute(call.name, parsedArgs, { signal, cwd, sessionId })
        } catch (err: any) {
          output = `Araç Çalıştırma Hatası: ${err.message}`
        }

        options.onToolResult?.({ id: call.id, name: call.name, output })

        // 6. Pruning & Middleware
        let outputContent = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
        if (this.ctx.spillStore?.processOutput) {
          const spill = await this.ctx.spillStore.processOutput(output, sessionId, call.name)
          outputContent = spill.modelText
        } else if (this.ctx.toolResultPruner) {
          outputContent = this.ctx.toolResultPruner.prune(outputContent).text
        }

        outputContent = await this.ctx.agentMiddleware.runAfterTool({
          sessionId,
          userId,
          preset: activePreset,
          turnCount,
          signal,
          toolName: call.name,
          params: parsedArgs,
          toolCallId: call.id,
          output: outputContent
        })

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
