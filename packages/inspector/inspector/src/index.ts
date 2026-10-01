import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type {
  AgentTurnSnapshot,
  InspectorFilter,
  ToolExecutionRecord,
  LlmResponseSnapshot
} from './types.js'

export * from './types.js'

/**
 * Capability Seam: InspectorService
 * 
 * Provides runtime observability into:
 * 1. What enters the agent (inputs, prompt, session history, available skills, active preset)
 * 2. What context is assembled (pruning, compaction, system prompt, sliding window)
 * 3. What exact payload is sent to the LLM (raw messages array, OpenAI tool specs, model config)
 * 4. What the LLM produced (thoughts, tool calls, assistant text, latency, token usage)
 */
export abstract class InspectorService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'inspector')
  }

  /**
   * Records the initial snapshot of an agent turn before it contacts the LLM.
   */
  public abstract recordTurnStart(snapshot: AgentTurnSnapshot): Promise<void> | void

  /**
   * Records a tool call execution and its output within the active turn.
   */
  public abstract recordToolExecution(sessionId: string, toolExecution: ToolExecutionRecord): Promise<void> | void

  /**
   * Completes the snapshot with the LLM response, thoughts, tool calls, and usage metrics.
   */
  public abstract recordTurnEnd(sessionId: string, response: LlmResponseSnapshot): Promise<void> | void

  /**
   * Returns the most recent turn snapshot for a given session.
   */
  public abstract getLatest(sessionId: string): Promise<AgentTurnSnapshot | undefined> | AgentTurnSnapshot | undefined

  /**
   * Returns all turn snapshots recorded for a session, chronologically ordered.
   */
  public abstract getSessionTurns(sessionId: string): Promise<AgentTurnSnapshot[]> | AgentTurnSnapshot[]

  /**
   * Returns a specific turn snapshot by its unique ID.
   */
  public abstract getTurn(id: string): Promise<AgentTurnSnapshot | undefined> | AgentTurnSnapshot | undefined

  /**
   * Searches and filters across all recorded snapshots.
   */
  public abstract query(filter?: InspectorFilter): Promise<AgentTurnSnapshot[]> | AgentTurnSnapshot[]

  /**
   * Clears snapshots for a specific session, or all snapshots if sessionId is omitted.
   */
  public abstract clear(sessionId?: string): Promise<void> | void
}

export const name = 'inspector'
export const inject = []

export function apply(ctx: Context) {
  // Cordis Service Definition Seam
}

export default InspectorService
