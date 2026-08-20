import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface JobSnapshot {
  id: string
  name: string
  command?: string
  status: JobStatus
  exitCode?: number
  startedAt: number
  completedAt?: number
  logs: string
  sessionId?: string
  userId?: string
}

export interface JobStartRequest {
  name: string
  command: string
  cwd?: string
  sessionId?: string
  userId?: string
  env?: Record<string, string>
}

export abstract class JobRegistry extends Service {
  constructor(ctx: Context) {
    super(ctx, 'jobs')
  }

  public abstract start(spec: JobStartRequest): Promise<JobSnapshot>
  public abstract list(sessionId?: string, userId?: string): JobSnapshot[]
  public abstract get(id: string): JobSnapshot | undefined
  public abstract kill(id: string): Promise<boolean>
  public abstract getLogs(id: string, tailLines?: number): string
}

export const name = 'jobs'

export function apply(ctx: Context) {
  // Service definition seam
}
