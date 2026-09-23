import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface ReflexionEntry {
  id: string
  timestamp: number
  task: string
  workspace?: string
  error?: string
  reflection: string
  tags?: string[]
}

export interface ReflexionQueryOptions {
  query?: string
  workspace?: string
  limit?: number
}

export abstract class ReflexionService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'reflexion')
  }

  /**
   * Persists a newly learned reflection / failure post-mortem.
   */
  public abstract recordReflection(
    entry: Omit<ReflexionEntry, 'id' | 'timestamp'>
  ): Promise<ReflexionEntry>

  /**
   * Retrieves relevant reflections matching the task context or workspace.
   */
  public abstract getReflections(
    options?: ReflexionQueryOptions
  ): Promise<ReflexionEntry[]>

  /**
   * Clears stored reflections.
   */
  public abstract clearReflections(): Promise<void>

  /**
   * Formats relevant reflections into a prompt section block for the agent.
   */
  public abstract renderPromptSection(
    task?: string,
    workspace?: string
  ): Promise<string>
}

export const name = 'reflexion'

export function apply(ctx: Context) {
  // Service definition seam
}

export default ReflexionService
