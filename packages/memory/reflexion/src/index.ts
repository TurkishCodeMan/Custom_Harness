import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface ReflexionEntry {
  id: string
  timestamp: number
  task: string
  workspace?: string
  presetId?: string
  userId?: string
  sessionId?: string
  error?: string
  reflection: string
  tags?: string[]
}

export interface ReflexionQueryOptions {
  query?: string
  workspace?: string
  presetId?: string
  userId?: string
  limit?: number
}

export abstract class ReflexionService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'reflexion')
  }

  /**
   * Persists a newly learned reflection / failure post-mortem with optional tenant isolation.
   */
  public abstract recordReflection(
    entry: Omit<ReflexionEntry, 'id' | 'timestamp'>,
    userId?: string
  ): Promise<ReflexionEntry>

  /**
   * Retrieves relevant reflections matching the task context, workspace, and tenant boundary.
   */
  public abstract getReflections(
    options?: ReflexionQueryOptions
  ): Promise<ReflexionEntry[]>

  /**
   * Clears stored reflections (tenant-scoped if userId provided).
   */
  public abstract clearReflections(userId?: string): Promise<void>

  /**
   * Formats relevant reflections into a prompt section block for the agent.
   */
  public abstract renderPromptSection(
    task?: string,
    workspace?: string,
    userId?: string
  ): Promise<string>
}

export const name = 'reflexion'

export function apply(ctx: Context) {
  // Service definition seam
}

export default ReflexionService
