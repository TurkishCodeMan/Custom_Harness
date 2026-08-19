import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ChatMessage, ProviderConfig, ModelConfig } from '@custom-harness/core-types'

export interface StreamEvent {
  type: 'chunk' | 'thought' | 'tool_call' | 'error' | 'done'
  content?: string
  toolCall?: {
    id: string
    name: string
    arguments: string
  }
  error?: string
}

export const name = 'llm'
export const inject = ['settings']

export class LlmService extends Service {
  static inject = ['settings']

  constructor(ctx: Context) {
    super(ctx, 'llm')
  }

  public async *streamChat(
    messages: ChatMessage[],
    options: {
      provider?: ProviderConfig
      model?: ModelConfig
      tools?: any[]
      signal?: AbortSignal
      enableThinking?: boolean
      thinkingBudgetTokens?: number
    } = {}
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const settings = this.ctx.settings.getSettings()
    const provider = options.provider || this.ctx.settings.getActiveProvider()
    if (!provider) {
      yield { type: 'error', error: 'Yapılandırılmış bir LLM sağlayıcısı bulunamadı.' }
      return
    }

    const model = options.model || this.ctx.settings.getActiveModel()
    const modelId = model?.id || settings.defaultModel

    const url = provider.baseURL.replace(/\/+$/, '') + '/chat/completions'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    const apiKey = provider.apiKey || (provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : '')
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const body: Record<string, any> = {
      model: modelId,
      messages: messages.map(m => {
        const item: any = { role: m.role, content: m.content || '' }
        if (m.tool_calls) item.tool_calls = m.tool_calls
        if (m.tool_call_id) item.tool_call_id = m.tool_call_id
        if (m.name) item.name = m.name
        return item
      }),
      stream: true
    }

    // Model-level direct thinking control
    if (options.enableThinking === false) {
      body.enable_thinking = false
      body.thinking = { type: 'disabled' }
      body.reasoning_effort = 'none'
    } else {
      // Keep thinking strictly budgeted/constrained
      const budget = options.thinkingBudgetTokens || 1024
      body.enable_thinking = true
      body.thinking = { type: 'enabled', budget_tokens: budget }
      body.reasoning_effort = 'low'
      body.max_thinking_tokens = budget
    }

    // Dynamically calculate safe max_tokens so (input_tokens + max_tokens) never exceeds model contextWindow
    const contextLimit = model?.contextWindow || 24576
    const totalPayloadChars = JSON.stringify(messages).length + JSON.stringify(options.tools || []).length
    const approxInputTokens = Math.ceil(totalPayloadChars / 2.8) + 200
    const safeRemainingTokens = Math.max(256, contextLimit - approxInputTokens - 512)
    // Coding agent turns only need up to 2048 tokens per turn
    const targetMaxTokens = Math.min(model?.maxTokens || 2048, 2048)

    body.max_tokens = Math.min(targetMaxTokens, safeRemainingTokens)
    body.temperature = 0.2
    body.frequency_penalty = 0.1

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools
      body.tool_choice = 'auto'
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options.signal
      })
    } catch (err: any) {
      if (err.name === 'AbortError') {
        yield { type: 'done' }
        return
      }
      yield { type: 'error', error: `LLM Bağlantı Hatası: ${err.message}` }
      return
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      yield { type: 'error', error: `LLM API Hatası (HTTP ${response.status}): ${errText}` }
      return
    }

    if (!response.body) {
      yield { type: 'error', error: 'LLM yanıt akışı boş.' }
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    const toolCallsMap = new Map<number, { id: string; name: string; args: string }>()
    let inThoughtTag = false
    let fullAssistantText = ''

    try {
      while (true) {
        if (options.signal?.aborted) {
          reader.cancel()
          break
        }

        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue
          if (trimmed === 'data: [DONE]') continue

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6)
            try {
              const data = JSON.parse(jsonStr)
              const choice = data.choices?.[0]
              if (!choice) continue

              const delta = choice.delta
              if (!delta) continue

              const reasoning = delta.reasoning_content || delta.reasoning
              if (reasoning) {
                yield { type: 'thought', content: reasoning }
              }

              if (delta.content) {
                const text = delta.content
                fullAssistantText += text

                if (text.includes('<thought>') || text.includes('<think>')) {
                  inThoughtTag = true
                }

                if (inThoughtTag) {
                  yield { type: 'thought', content: text.replace(/<\/?think>|<\/?thought>/g, '') }
                  if (text.includes('</thought>') || text.includes('</think>')) {
                    inThoughtTag = false
                  }
                } else {
                  yield { type: 'chunk', content: text }
                }

                // Fast anti-loop guard: Break stream if fake tool outputs or repetitive blocks appear
                if (text.includes('eget_tool_output') || text.includes('eget_tool_call')) {
                  await reader.cancel()
                  break
                }

                if (fullAssistantText.length > 100) {
                  const sample = fullAssistantText.slice(-35)
                  const count = fullAssistantText.split(sample).length - 1
                  if (count >= 3) {
                    await reader.cancel()
                    break
                  }
                }
              }

              if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0
                  const existing = toolCallsMap.get(idx) || { id: '', name: '', args: '' }

                  if (tc.id) existing.id += tc.id
                  if (tc.function?.name) existing.name += tc.function.name
                  if (tc.function?.arguments) existing.args += tc.function.arguments

                  toolCallsMap.set(idx, existing)
                }
              }
            } catch (e) {}
          }
        }
      }

      const registeredToolNames = new Set((options.tools || []).map((t: any) => t.function?.name || t.name))
      if (toolCallsMap.size === 0 && fullAssistantText) {
        // Fallback: Parse inline tool calls like eget_file{...}, edit_file{...}, bash{...}
        const inlineRegex = /([a-zA-Z0-9_]+)\s*\{([\s\S]*?)\}/g
        let match: RegExpExecArray | null
        while ((match = inlineRegex.exec(fullAssistantText)) !== null) {
          let toolName = match[1].trim()
          if (toolName.includes('edit_file') || toolName === 'eget_file') toolName = 'edit_file'
          else if (toolName.includes('read_file') || toolName.includes('file_content')) toolName = 'read_file'
          else if (toolName.includes('write_file')) toolName = 'write_file'
          else if (toolName.includes('finish')) toolName = 'finish_task'
          
          const rawArgs = match[2].trim()

          // Extract key:<|"|>val<|"|> format or standard JSON
          const parsedObj: Record<string, any> = {}
          const kvRegex = /([a-zA-Z0-9_]+)\s*:\s*(?:<\|"\|>([\s\S]*?)<\|"\|>|"([^"]*)"|'([^']*)')/g
          let kvMatch: RegExpExecArray | null
          let foundKv = false
          while ((kvMatch = kvRegex.exec(rawArgs)) !== null) {
            foundKv = true
            const k = kvMatch[1]
            const v = kvMatch[2] ?? kvMatch[3] ?? kvMatch[4] ?? ''
            parsedObj[k] = v
          }

          if (!foundKv) {
            try {
              Object.assign(parsedObj, JSON.parse(`{${rawArgs}}`))
            } catch (e) {
              parsedObj['raw'] = rawArgs
            }
          }

          // Dynamically accept any tool registered in the current active bundle
          if (registeredToolNames.has(toolName) || registeredToolNames.size === 0) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: toolName,
                arguments: JSON.stringify(parsedObj)
              }
            }
          }
        }
      }

      for (const [_, tc] of toolCallsMap) {
        if (tc.name) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: tc.id || `call_${Date.now()}`,
              name: tc.name,
              arguments: tc.args
            }
          }
        }
      }

      yield { type: 'done' }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        yield { type: 'done' }
      } else {
        yield { type: 'error', error: `Akış Okuma Hatası: ${err.message}` }
      }
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('llm', new LlmService(ctx))
}
