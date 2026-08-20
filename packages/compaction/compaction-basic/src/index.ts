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
   * Compacts conversation messages if message count or token character volume exceeds threshold or if forced.
   */
  public compact(messages: ChatMessage[], maxRetainedTurns: number = 20, force = false): { messages: ChatMessage[]; compacted: boolean; summary?: string; prunedCount?: number } {
    if (!messages || messages.length <= 2) {
      return { messages, compacted: false }
    }

    const totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0) + (m.reasoning_content?.length || 0), 0)
    const shouldCompact = force || messages.length > 8 || totalChars > 12000

    if (!shouldCompact) {
      return { messages, compacted: false }
    }

    // Always keep initial user prompt (messages[0])
    const initialUserMsg = messages[0]
    const retainCount = Math.min(8, Math.max(2, maxRetainedTurns))
    const splitIndex = Math.max(1, messages.length - retainCount)
    const olderMessages = messages.slice(1, splitIndex)
    const recentMessages = messages.slice(splitIndex)

    if (olderMessages.length === 0) {
      return { messages, compacted: false }
    }

    // Build summary of older turns
    const summaries: string[] = []
    for (const msg of olderMessages) {
      if (msg.role === 'user') {
        const text = msg.content || ''
        summaries.push(`- Kullanıcı İstemi: ${text.slice(0, 150)}`)
      } else if (msg.role === 'assistant' && msg.content) {
        summaries.push(`- Asistan Yanıtı / Kararı: ${msg.content.slice(0, 150)}`)
      } else if (msg.role === 'tool') {
        summaries.push(`- [${msg.name || 'Araç'}] Çıktısı işlendi.`)
      }
    }

    const summaryText = `[Önceki Konuşma ve Araç Çıktıları Özeti / Compacted Context Anchor]:\n${summaries.join('\n')}\n(Yukarıdaki özet bağlamı göz önünde bulundurularak konuşmaya devam edilmektedir.)`
    const summaryMessage: ChatMessage = {
      role: 'user',
      content: summaryText
    }

    return {
      messages: [initialUserMsg, summaryMessage, ...recentMessages],
      compacted: true,
      summary: summaryText,
      prunedCount: olderMessages.length
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('compactor', new CompactionBasicService(ctx))
}
