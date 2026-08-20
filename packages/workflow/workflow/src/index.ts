import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface WorkflowRunOptions {
  id?: string
  name: string
  steps: {
    name: string
    prompt: string
    cwd?: string
  }[]
  cwd?: string
  signal?: AbortSignal
}

export interface WorkflowStepResult {
  stepName: string
  status: 'completed' | 'failed'
  output: string
  elapsedMs: number
}

export interface WorkflowRunResult {
  id: string
  name: string
  status: 'completed' | 'failed' | 'cancelled'
  stepResults: WorkflowStepResult[]
  totalElapsedMs: number
}

export abstract class WorkflowEngine extends Service {
  constructor(ctx: Context) {
    super(ctx, 'workflowEngine')
  }

  public abstract execute(options: WorkflowRunOptions): Promise<WorkflowRunResult>
}

export const name = 'workflowEngine'

export function apply(ctx: Context) {
  // Service definition seam
}
