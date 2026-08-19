import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ChatMessage, ModelConfig } from '@custom-harness/core-types'

export interface AgentRunOptions {
  sessionId: string
  prompt: string
  providerId?: string
  modelId?: string
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
    const provider = options.providerId
      ? settings.providers[options.providerId]
      : this.ctx.settings.getActiveProvider()
    const model = options.modelId
      ? provider?.models.find((m: ModelConfig) => m.id === options.modelId)
      : this.ctx.settings.getActiveModel()

    // 2. Prepare Dynamic System Prompt (via @custom-harness/core-system-prompt & persona)
    const cwd = session.workspace || settings.workspace || process.cwd()
    const activePreset = this.ctx.agentPresets ? this.ctx.agentPresets.getActive() : this.ctx.settings?.getActivePreset()
    const personaPrompt = this.ctx.persona ? this.ctx.persona.getActivePersona() : activePreset?.systemPrompt

    if (this.ctx.systemPrompt) {
      this.ctx.systemPrompt.setSessionWorkspace(cwd)
      if (personaPrompt) {
        this.ctx.systemPrompt.section({
          name: 'persona',
          order: 0,
          text: `Agent Persona (${activePreset?.name || 'Active'}):\n${personaPrompt}`
        })
      }
    }

    const renderedPrompt = this.ctx.systemPrompt
      ? this.ctx.systemPrompt.render()
      : (personaPrompt || `You are an autonomous AI coding assistant. Working directory: ${cwd}`)

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
      const toolsToPass = this.ctx.tools.getOpenAiSchemas()
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
        if (event.type === 'thought' && event.content) {
          currentThinking += event.content
          options.onThought?.(event.content)
        } else if (event.type === 'chunk' && event.content) {
          currentAssistantContent += event.content
          options.onChunk?.(event.content)
        } else if (event.type === 'tool_call' && event.toolCall) {
          pendingToolCalls.push(event.toolCall)
        } else if (event.type === 'error' && event.error) {
          options.onChunk?.(`\n[Hata]: ${event.error}\n`)
          currentAssistantContent += `\n[Hata]: ${event.error}\n`
        }
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: currentAssistantContent || undefined,
        reasoning_content: currentThinking || undefined
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
        if (taskFinished) {
          break
        }
        if (options.autonomous && turnCount < maxTurns) {
          this.ctx.session.appendMessage(sessionId, {
            role: 'user',
            content: '[INSTRUCTION]: You are in autonomous execution mode. Continue your task by executing tools (e.g. run_code, read_file, edit_file, bash). Do not stop to give intermediate explanations. When you have completely accomplished the goal and verified all changes, call finish_task.'
          })
          continue
        }
        break
      }

      for (const call of pendingToolCalls) {
        if (signal?.aborted) break

        if (call.name === 'finish_task') {
          taskFinished = true
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

      if (taskFinished) {
        break
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
