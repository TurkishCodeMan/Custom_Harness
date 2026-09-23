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
   * Compacts conversation messages if message count > 10 or token volume >= 12,000 tokens (~30,000 chars) or if forced.
   */
  public compact(
    messages: ChatMessage[],
    maxRetainedTurns: number = 8,
    force = false
  ): { messages: ChatMessage[]; compacted: boolean; summary?: string; prunedCount?: number } {
    if (!messages || messages.length <= 2) {
      return { messages, compacted: false }
    }

    const totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0) + (m.reasoning_content?.length || 0), 0)
    const approxTokens = Math.ceil(totalChars / 2.5)

    // Trigger compaction when message count > 10 OR tokens >= 12,000 (or if forced)
    const shouldCompact = force || messages.length > 10 || approxTokens >= 12000

    if (!shouldCompact) {
      return { messages, compacted: false }
    }

    // Always keep initial user prompt (messages[0])
    const initialUserMsg = messages[0]
    const retainCount = Math.min(Math.max(1, messages.length - 2), Math.min(8, Math.max(1, maxRetainedTurns)))
    const splitIndex = Math.max(1, messages.length - retainCount)
    const olderMessages = messages.slice(1, splitIndex)
    const recentMessages = messages.slice(splitIndex)

    if (olderMessages.length === 0) {
      return { messages, compacted: false }
    }

    // Build summary of older turns
    const summaries: string[] = []
    let toolCount = 0
    for (const msg of olderMessages) {
      if (msg.role === 'user') {
        const text = msg.content || ''
        if (!text.startsWith('[Önceki Konuşma') && !text.startsWith('[GEÇMİŞ BAĞLAM')) {
          summaries.push(`- Kullanıcı İstemi: ${text.slice(0, 150)}`)
        }
      } else if (msg.role === 'assistant' && msg.content && !msg.content.startsWith('[Model Hatası')) {
        summaries.push(`- Asistan Yanıtı / Kararı: ${msg.content.slice(0, 150)}`)
      } else if (msg.role === 'tool') {
        toolCount++
        if (toolCount <= 5) {
          summaries.push(`- [${msg.name || 'Araç'}] Çıktısı işlendi.`)
        }
      }
    }
    if (toolCount > 5) {
      summaries.push(`- ... (Toplam ${toolCount} adet araç/terminal adımı yürütüldü)`)
    }

    // Keep summary bounded to prevent overflow in long sessions
    let summaryContent = summaries.slice(-20).join('\n')
    if (summaryContent.length > 2000) {
      summaryContent = summaryContent.slice(-2000)
    }

    const summaryText = `[Önceki Konuşma ve Araç Çıktıları Özeti / Compacted Context Anchor]:\n${summaryContent}\n(Yukarıdaki özet bağlamı göz önünde bulundurularak konuşmaya devam edilmektedir.)`
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
