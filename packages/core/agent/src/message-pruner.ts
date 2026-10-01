import type { ChatMessage } from '@custom-harness/core-types'

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

/**
 * OPTIMIZATION 1: Strip reasoning_content from historical assistant messages.
 *
 * Model's own <think> / reasoning blocks are useful during streaming for the user to see,
 * but should NEVER be fed back into the LLM on subsequent turns. Sending them back doubles
 * context size with zero benefit — the model only needs its own net result (content) and
 * the tool calls it made, not the reasoning trail it used to arrive there.
 *
 * Works strictly on the LLM payload copy; never mutates persistent session.messages.
 */
export function stripReasoningFromHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(msg => {
    if (msg.role === 'assistant' && (msg as any).reasoning_content) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { reasoning_content, ...rest } = msg as any
      return rest as ChatMessage
    }
    return msg
  })
}

/**
 * OPTIMIZATION 2: Sliding Window for Tool Outputs.
 *
 * Tool outputs older than `windowSize` turns are collapsed to a single-line reference.
 * This prevents large file reads, bash outputs, or API results from inflating older turns
 * while still keeping the model aware that those tool calls happened and succeeded/failed.
 *
 * "Turn" = one assistant message (with or without tool_calls).
 * Only role:'tool' messages are compressed; role:'user' and role:'assistant' are always kept intact.
 * Works strictly on the LLM payload copy; never mutates persistent session.messages.
 *
 * @param messages Full compacted messages array (no system prompt)
 * @param windowSize Number of recent assistant turns to keep in full (default: 6)
 * @param maxToolChars Max characters to keep for in-window tool outputs (default: 3000)
 */
export function applyToolOutputSlidingWindow(
  messages: ChatMessage[],
  windowSize: number = 6,
  maxToolChars: number = 3000
): ChatMessage[] {
  // Find indices of all assistant messages (each marks the start of a "turn")
  const assistantIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'assistant') {
      assistantIndices.push(i)
    }
  }

  // Determine the cutoff: turns BEFORE this index are "old" and should be compressed
  const cutoffTurnIndex = Math.max(0, assistantIndices.length - windowSize)
  const cutoffMsgIndex = assistantIndices[cutoffTurnIndex] ?? 0

  return messages.map((msg, idx) => {
    // Beceri (skill) araç mesajları şema ve talimat içerir, tüm oturum boyunca ajana lazımdır; budama dışı tutulur
    const isSkillTool =
      msg.role === 'tool' &&
      (msg.name === 'skill' ||
        (msg as any).toolName === 'skill' ||
        (typeof msg.content === 'string' && msg.content.includes('AKTİF BECERİ TALİMATLARI')))
    if (isSkillTool) {
      return msg
    }

    // Only compress tool messages that are older than the window
    if (msg.role === 'tool' && idx < cutoffMsgIndex) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      const toolName = (msg as any).tool_call_id || (msg as any).name || 'araç'

      // If content is already short, leave it alone
      if (content.length <= 200) return msg

      return {
        ...msg,
        content: `[Önceki turda ${toolName} çalıştırıldı — çıktı bağlam tasarrufu için gizlendi (${content.length} karakter). Sonuç bir önceki assistant mesajında özetlendi.]`
      } as ChatMessage
    }

    // For in-window tool messages, cap at maxToolChars to prevent single-turn bloat
    if (msg.role === 'tool' && idx >= cutoffMsgIndex) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      if (content.length > maxToolChars) {
        return {
          ...msg,
          content: content.slice(0, maxToolChars) + `\n... [Çıktı ${content.length - maxToolChars} karakter kısaltıldı — tam metin spill dosyasında mevcuttur]`
        } as ChatMessage
      }
    }

    return msg
  })
}

