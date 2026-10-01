import type { ThreadMessage, Position, ExecutionActionCard, ExecutionActionItem } from './types.js'

/**
 * Groups consecutive assistant turns and tool messages belonging to the same
 * conversational round (i.e. responding to a specific user prompt) into a single
 * unified ThreadMessage with one consolidated action card.
 *
 * Prevents 50+ intermediate tool calls from appearing as 50+ separate assistant bubbles
 * when a session is loaded from the backend or the page is refreshed.
 */
export function groupMessagesByRound(
  rawMessages: any[],
  positions: Position[] = []
): ThreadMessage[] {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return []
  }

  const result: ThreadMessage[] = []
  let currentAssistantRound: {
    id: string
    role: 'assistant'
    presetName?: string
    modelName?: string
    timestamp: number
    content: string
    reasoning_content: string
    tool_calls: any[]
    items: ExecutionActionItem[]
    existingActionCards: ExecutionActionCard[]
  } | null = null

  const flushAssistantRound = () => {
    if (!currentAssistantRound) return

    let actionCards: ExecutionActionCard[] | undefined = undefined

    // 1. If existing actionCards exist on messages, preserve their items
    if (currentAssistantRound.existingActionCards.length > 0) {
      actionCards = currentAssistantRound.existingActionCards.map(c => ({
        ...c,
        isExpanded: false
      }))
    }

    // 2. If we collected items from tool_calls, build a unified action card
    if (currentAssistantRound.items.length > 0) {
      const presetName = currentAssistantRound.presetName
      const pos = positions.find(
        p => p.id === presetName || p.presetId === presetName || p.title === presetName
      )
      const unifiedCard: ExecutionActionCard = {
        id: `card_${currentAssistantRound.id}`,
        name: pos?.title || 'Yürütülen Araçlar & Aksiyonlar',
        icon: pos?.icon || '⚙️',
        badgeText: `${currentAssistantRound.items.length} eylem tamamlandı`,
        isExpanded: false,
        items: currentAssistantRound.items
      }

      if (actionCards && actionCards.length > 0) {
        // Merge or replace placeholder card
        actionCards = [unifiedCard]
      } else {
        actionCards = [unifiedCard]
      }
    }

    result.push({
      id: currentAssistantRound.id,
      role: 'assistant',
      content: currentAssistantRound.content.trim() || undefined,
      reasoning_content: currentAssistantRound.reasoning_content.trim() || undefined,
      presetName: currentAssistantRound.presetName,
      tool_calls: currentAssistantRound.tool_calls.length > 0 ? currentAssistantRound.tool_calls : undefined,
      actionCards,
      timestamp: currentAssistantRound.timestamp
    })

    currentAssistantRound = null
  }

  for (let idx = 0; idx < rawMessages.length; idx++) {
    const m = rawMessages[idx]
    if (!m) continue

    if (m.role === 'user') {
      flushAssistantRound()
      result.push({
        id: m.id || `user_${idx}_${m.timestamp || Date.now()}`,
        role: 'user',
        content: m.content,
        attachments: m.attachments,
        timestamp: m.timestamp || Date.now()
      })
      continue
    }

    if (m.role === 'tool') {
      // Find matching item in current round to populate output
      if (currentAssistantRound && currentAssistantRound.items.length > 0) {
        const toolCallId = m.tool_call_id
        const toolName = m.name
        const item = currentAssistantRound.items.find(
          it =>
            (toolCallId && it.id === toolCallId) ||
            (!toolCallId && it.label === toolName && it.output === undefined) ||
            (it.label === toolName && it.output === undefined)
        )
        if (item) {
          item.output = m.content
        }
      }
      continue
    }

    if (m.role === 'assistant') {
      // Start or merge into current assistant round
      if (!currentAssistantRound) {
        currentAssistantRound = {
          id: m.id || `asst_round_${idx}_${m.timestamp || Date.now()}`,
          role: 'assistant',
          presetName: m.presetName,
          modelName: m.modelName,
          timestamp: m.timestamp || Date.now(),
          content: typeof m.content === 'string' ? m.content : '',
          reasoning_content: typeof m.reasoning_content === 'string' ? m.reasoning_content : '',
          tool_calls: [],
          items: [],
          existingActionCards: Array.isArray(m.actionCards) ? [...m.actionCards] : []
        }
      } else {
        // Merge attributes
        if (m.presetName && !currentAssistantRound.presetName) {
          currentAssistantRound.presetName = m.presetName
        }
        if (m.content) {
          currentAssistantRound.content = currentAssistantRound.content
            ? `${currentAssistantRound.content}\n\n${m.content}`
            : m.content
        }
        if (m.reasoning_content) {
          currentAssistantRound.reasoning_content = currentAssistantRound.reasoning_content
            ? `${currentAssistantRound.reasoning_content}\n\n${m.reasoning_content}`
            : m.reasoning_content
        }
        if (Array.isArray(m.actionCards) && m.actionCards.length > 0) {
          currentAssistantRound.existingActionCards.push(...m.actionCards)
        }
      }

      // Collect tool calls
      if (m.tool_calls && Array.isArray(m.tool_calls)) {
        for (let tIdx = 0; tIdx < m.tool_calls.length; tIdx++) {
          const tc = m.tool_calls[tIdx]
          currentAssistantRound.tool_calls.push(tc)

          const toolName = tc.function?.name || tc.name || 'tool'
          let parsedArgs: any = {}
          try {
            parsedArgs =
              typeof tc.function?.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : tc.function?.arguments || tc.args || {}
          } catch {
            parsedArgs = { raw: tc.function?.arguments }
          }
          const detail =
            parsedArgs.command ||
            parsedArgs.path ||
            parsedArgs.query ||
            parsedArgs.taskName ||
            parsedArgs.task ||
            (typeof parsedArgs === 'object'
              ? JSON.stringify(parsedArgs).slice(0, 70)
              : String(parsedArgs))

          // Match tool result in rawMessages
          const toolResultMsg = rawMessages.find(
            (other: any) =>
              other.role === 'tool' &&
              ((tc.id && other.tool_call_id === tc.id) || (!tc.id && other.name === toolName))
          )
          const output = toolResultMsg ? toolResultMsg.content : undefined

          currentAssistantRound.items.push({
            id: tc.id || `tc_${idx}_${tIdx}`,
            label: toolName,
            status: 'completed' as const,
            detail: String(detail || ''),
            input: parsedArgs,
            output: output
          })
        }
      }
    }
  }

  flushAssistantRound()
  return result
}
