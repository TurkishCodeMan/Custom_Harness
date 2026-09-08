import type { ChatMessage } from '@custom-harness/core-types'

export const PRUNE_NOTICE = '... [Önceki tur çıktısı bağlam koruması amacıyla özetlendi / Earlier tool result truncated]'

/**
 * Prunes older tool result messages in payload to preserve critical context window headroom.
 * Messages within the recent window (default: last 4 messages) are untouched.
 */
export function pruneToolMessages(
  messages: ChatMessage[],
  recentThreshold: number = 4,
  maxAllowedLength: number = 300,
  keepLength: number = 200
): ChatMessage[] {
  if (!messages || messages.length === 0) return []

  const len = messages.length
  return messages.map((m, idx) => {
    const isRecent = idx >= len - recentThreshold
    if (!isRecent && m.role === 'tool' && (m.content || '').length > maxAllowedLength) {
      return {
        ...m,
        content: `${(m.content || '').slice(0, keepLength)}\n\n${PRUNE_NOTICE}`
      }
    }
    return m
  })
}

/**
 * Ensures that at least one user prompt is present in the outgoing payload,
 * which is required by various model parsers (e.g. Anthropic/OpenAI compatibility layers).
 */
export function ensureUserMessage(messages: ChatMessage[], prompt: string): ChatMessage[] {
  const result = [...messages]
  if (!result.some(m => m.role === 'user')) {
    result.push({ role: 'user', content: prompt })
  }
  return result
}
