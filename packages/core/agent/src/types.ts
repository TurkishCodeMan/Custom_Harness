import type { ChatMessage, TokenUsage } from '@custom-harness/core-types'

export interface AgentRunOptions {
  sessionId: string
  prompt: string
  providerId?: string
  modelId?: string
  presetId?: string
  preset?: any
  userId?: string
  signal?: AbortSignal
  autonomous?: boolean
  enableThinking?: boolean
  thinkingBudgetTokens?: number
  onThought?: (text: string) => void
  onChunk?: (text: string) => void
  onToolStart?: (call: { id: string; name: string; args: any }) => void
  onToolResult?: (result: { id: string; name: string; output: any }) => void
  onCompaction?: (info: { messageCount: number; summary: string }) => void
  onUsage?: (usage: TokenUsage) => void
}

export interface ToolExecutionContext {
  sessionId: string
  userId?: string
  activePreset?: any
  turnCount: number
  signal?: AbortSignal
  cwd: string
  onToolResult?: (result: { id: string; name: string; output: any }) => void
}

export interface ProviderModelResolution {
  provider: any
  model: any
}

export interface ExtractedThoughts {
  cleanContent: string
  finalThinking: string
}
