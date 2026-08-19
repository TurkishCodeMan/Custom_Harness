import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ChatMessage } from '@custom-harness/core-types'

export const name = 'compactor'

export class CompactionBasicService extends Service {
  declare ctx: Context

  constructor(ctx: Context) {
    super(ctx, 'compactor')
  }

  /**
   * Compacts conversation messages if message count or token character volume exceeds threshold
   */
  public compact(messages: ChatMessage[], maxRetainedTurns: number = 20): { messages: ChatMessage[]; compacted: boolean } {
    if (!messages || messages.length <= 4) {
      return { messages, compacted: false }
    }

    const totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0) + (m.reasoning_content?.length || 0), 0)
    const shouldCompact = messages.length > 12 || totalChars > 18000

    if (!shouldCompact) {
      return { messages, compacted: false }
    }

    // Always keep initial user prompt (messages[0])
    const initialUserMsg = messages[0]
    const retainCount = 10
    const splitIndex = Math.max(1, messages.length - retainCount)
    const olderMessages = messages.slice(1, splitIndex)
    const recentMessages = messages.slice(splitIndex)

    // Build summary of older turns
    const summaries: string[] = []
    for (const msg of olderMessages) {
      if (msg.role === 'user') {
        const text = msg.content || ''
        summaries.push(`Kullanıcı: ${text.slice(0, 100)}...`)
      } else if (msg.role === 'assistant' && msg.content) {
        summaries.push(`Asistan: ${msg.content.slice(0, 100)}...`)
      } else if (msg.role === 'tool') {
        summaries.push(`[${msg.name || 'Araç'}] Çıktısı işlendi.`)
      }
    }

    const summaryMessage: ChatMessage = {
      role: 'system',
      content: `[Önceki Konuşma ve Araç Özeti / Compacted Context Anchor]:\n${summaries.join('\n')}`
    }

    return {
      messages: [initialUserMsg, summaryMessage, ...recentMessages],
      compacted: true
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('compactor', new CompactionBasicService(ctx))
}
