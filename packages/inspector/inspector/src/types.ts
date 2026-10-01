import type { ChatMessage, TokenUsage } from '@custom-harness/core-types'

export interface SkillDescriptor {
  id: string
  name: string
  description: string
}

export interface AgentInputSnapshot {
  sessionId: string
  prompt: string
  userId?: string
  presetId?: string
  presetName?: string
  workspace?: string
  availableSkills?: SkillDescriptor[]
  options?: Record<string, unknown>
}

export interface AgentContextSnapshot {
  systemPrompt: string
  sessionMessagesCount: number
  conversationMessagesCount: number
  ephemeralMessagesCount?: number
  compacted?: boolean
  compactionSummary?: string
  slidingWindowApplied?: boolean
}

export interface LlmPayloadSnapshot {
  provider?: string
  model?: string
  /**
   * Exact canonical messages array dispatched to the LLM.
   * [systemPromptMessage, ...conversationMessages]
   */
  messagesToSend: ChatMessage[]
  /**
   * OpenAI function-calling tool specifications provided to the model.
   */
  tools: any[]
  enableThinking?: boolean
  thinkingBudgetTokens?: number
  estimatedTokens?: {
    systemPromptTokens?: number
    messagesTokens?: number
    toolsTokens?: number
    totalTokens?: number
  }
}

export interface ToolExecutionRecord {
  callId: string
  toolName: string
  args: any
  output?: any
  durationMs?: number
  error?: string
  spilled?: boolean
  spillFilePath?: string
  startedAt?: number
  completedAt?: number
}

export interface LlmResponseSnapshot {
  assistantContent?: string
  thinkingContent?: string
  toolCalls?: Array<{ id: string; name: string; arguments: any }>
  usage?: TokenUsage
  durationMs?: number
  error?: string
  completedAt?: number
}

export interface AgentTurnSnapshot {
  id: string
  sessionId: string
  turnCount: number
  timestamp: number
  status: 'running' | 'completed' | 'error'
  input: AgentInputSnapshot
  context: AgentContextSnapshot
  llmPayload: LlmPayloadSnapshot
  toolExecutions?: ToolExecutionRecord[]
  llmResponse?: LlmResponseSnapshot
}

export interface InspectorFilter {
  sessionId?: string
  presetId?: string
  status?: 'running' | 'completed' | 'error'
  from?: number
  to?: number
  limit?: number
}
