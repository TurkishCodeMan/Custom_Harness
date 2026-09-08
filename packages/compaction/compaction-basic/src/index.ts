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
   * Compacts conversation messages if message count or token volume exceeds 20,000 tokens (~60k chars) or if forced.
   */
  public compact(messages: ChatMessage[], maxRetainedTurns: number = 8, force = false): { messages: ChatMessage[]; compacted: boolean; summary?: string; prunedCount?: number } {
    if (!messages || messages.length <= 4) {
      return { messages, compacted: false }
    }

    const totalChars = messages.reduce((acc, m) => acc + (m.content?.length || 0) + (m.reasoning_content?.length || 0), 0)
    const approxTokens = Math.ceil(totalChars / 3)
    // Compact when conversation exceeds ~3,500 tokens (12,000 chars) or 8 messages for safe 16k context window
    const shouldCompact = force || approxTokens > 3500 || totalChars > 12000 || messages.length > 8

    if (!shouldCompact) {
      return { messages, compacted: false }
    }

    const retainCount = Math.max(4, Math.min(maxRetainedTurns, messages.length))
    const splitIndex = Math.max(0, messages.length - retainCount)
    const olderMessages = messages.slice(0, splitIndex)
    const recentMessages = messages.slice(splitIndex)

    if (olderMessages.length === 0) {
      return { messages, compacted: false }
    }

    // Build concise summary of older turns
    const summaries: string[] = []
    for (const msg of olderMessages) {
      if (msg.role === 'user') {
        const text = msg.content || ''
        summaries.push(`- Kullanıcı İstemi: ${text.slice(0, 150)}`)
      } else if (msg.role === 'assistant' && msg.content) {
        summaries.push(`- Asistan Yanıtı: ${msg.content.slice(0, 150)}`)
      } else if (msg.role === 'tool') {
        summaries.push(`- [${msg.name || 'Araç'}] Çıktısı işlendi.`)
      }
    }

    const cleanSummary = summaries.join('\n')
    const promptForModel = `[GEÇMİŞ BAĞLAM - Özet]:\n${cleanSummary}\n\n(Konuşma kesintisiz devam etmektedir. Son kullanıcı istemine doğrudan yanıt ver.)`
    const summaryMessage: ChatMessage = {
      role: 'user',
      content: promptForModel
    }

    return {
      messages: [summaryMessage, ...recentMessages],
      compacted: true,
      summary: cleanSummary,
      prunedCount: olderMessages.length
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('compactor', new CompactionBasicService(ctx))
}
