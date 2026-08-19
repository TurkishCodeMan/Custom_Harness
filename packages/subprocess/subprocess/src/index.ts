import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut?: boolean
}

export interface ExecOptions {
  cwd?: string
  env?: Record<string, string>
  timeoutMs?: number
  maxBufferBytes?: number
  signal?: AbortSignal
  onChunk?: (chunk: { stdout?: string; stderr?: string }) => void
}

export abstract class SubprocessService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'subprocess')
  }

  public abstract exec(command: string, options?: ExecOptions): Promise<ExecResult>
  public abstract spawn(command: string, args: string[], options?: ExecOptions): Promise<any>
}

export const name = 'subprocess'

export function apply(ctx: Context) {
  // Service definition seam
}

export default SubprocessService
