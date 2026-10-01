import type { ChatMessage, TokenUsage, ResponseFormat } from '@custom-harness/core-types'

export interface AgentRunOptions {
  sessionId: string
  prompt: string
  runId?: string
  providerId?: string
  modelId?: string
  presetId?: string
  preset?: any
  workspace?: string
  userId?: string
  signal?: AbortSignal
  autonomous?: boolean
  /** Max ReAct turns before the loop is forcefully terminated. Default: 60 */
  maxTurns?: number
  enableThinking?: boolean
  thinkingBudgetTokens?: number
  responseFormat?: ResponseFormat
  temperature?: number
  systemPrompt?: string
  onThought?: (text: string) => void
  onChunk?: (text: string) => void
  onToolStart?: (call: { id: string; name: string; args: any; runId?: string }) => void
  onToolResult?: (result: { id: string; name: string; output: any; runId?: string }) => void
  onCompaction?: (info: { messageCount: number; summary: string }) => void
  onUsage?: (usage: TokenUsage) => void
  isInternal?: boolean
}

export interface ToolExecutionContext {
  sessionId: string
  runId?: string
  userId?: string
  activePreset?: any
  turnCount: number
  signal?: AbortSignal
  cwd: string
  onToolStart?: (call: { id: string; name: string; args: any; runId?: string }) => void
  onToolResult?: (result: { id: string; name: string; output: any; runId?: string }) => void
}

export interface ProviderModelResolution {
  provider: any
  model: any
}

export interface ExtractedThoughts {
  cleanContent: string
  finalThinking: string
}
