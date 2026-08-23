import type { ChatMessage, AgentPreset } from '@custom-harness/core-types'

// ---------------------------------------------------------------------------
// Shared base context carried through every middleware hook
// ---------------------------------------------------------------------------

/** Minimal skill descriptor forwarded from the skills service */
export interface SkillSummary {
  id: string
  name: string
  description: string
}

export interface AgentMiddlewareContext {
  sessionId: string
  userId?: string
  preset?: AgentPreset
  turnCount: number
  signal?: AbortSignal
  /** Active skills the agent can load — populated by core-agent from ctx.skills */
  availableSkills?: SkillSummary[]
}


// ---------------------------------------------------------------------------
// Per-hook contexts
// ---------------------------------------------------------------------------

export interface BeforeChatContext extends AgentMiddlewareContext {
  /** Rendered system prompt string */
  systemPrompt: string
  /** Full conversation history that will be sent to the LLM */
  messages: ChatMessage[]
  /** OpenAI-schema tool definitions */
  tools: any[]
  /** Raw AgentRunOptions forwarded from the caller */
  options: Record<string, unknown>
}

export interface BeforeToolContext extends AgentMiddlewareContext {
  /** Name of the tool about to be executed */
  toolName: string
  /** Parsed tool arguments */
  params: any
  /** Unique tool-call ID assigned by the LLM */
  toolCallId: string
  /**
   * Set to `true` inside a middleware to skip real execution.
   * The pipeline stops immediately after the middleware returns.
   */
  skipExecution?: boolean
  /** Custom output to return to the model when execution is skipped */
  customOutput?: any
}

export interface AfterToolContext extends AgentMiddlewareContext {
  toolName: string
  params: any
  toolCallId: string
  /** Mutable — middleware may replace or transform the tool output */
  output: any
}

export interface AfterChatContext extends AgentMiddlewareContext {
  assistantMessage: ChatMessage
  /**
   * Set to `true` to request an additional LLM turn.
   * Must also set `continuationPrompt` so the agent knows what to say.
   */
  shouldContinue?: boolean
  continuationPrompt?: string
}

// ---------------------------------------------------------------------------
// Middleware definition contract
// ---------------------------------------------------------------------------

export interface AgentMiddlewareDefinition {
  /** Unique identifier — used as the registration key */
  name: string
  /** Execution order within the pipeline. Lower = runs first. Default: 0 */
  order?: number
  /**
   * When provided, middleware only runs for the listed preset IDs.
   * Omit to apply to all presets.
   */
  presets?: string[]
  beforeChat?: (ctx: BeforeChatContext, next: () => Promise<void>) => Promise<void>
  beforeTool?: (ctx: BeforeToolContext, next: () => Promise<void>) => Promise<void>
  afterTool?: (ctx: AfterToolContext, next: () => Promise<void>) => Promise<void>
  afterChat?: (ctx: AfterChatContext, next: () => Promise<void>) => Promise<void>
}
