import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface TerminalSessionInfo {
  id: string
  name: string
  cwd: string
  createdAt: number
  lastActiveAt: number
  alive: boolean
}

export interface TerminalSendResult {
  sessionId: string
  output: string
  exitCode?: number
  completed: boolean
}

export abstract class TerminalService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'terminals')
  }

  public abstract spawn(name?: string, cwd?: string): Promise<TerminalSessionInfo>
  public abstract send(sessionId: string, text: string, submit?: boolean, timeoutMs?: number): Promise<TerminalSendResult>
  public abstract read(sessionId: string, tailBytes?: number): string
  public abstract list(): TerminalSessionInfo[]
  public abstract kill(sessionId: string): Promise<boolean>
}

export const name = 'terminals'

export function apply(ctx: Context) {
  // Service definition seam
}
