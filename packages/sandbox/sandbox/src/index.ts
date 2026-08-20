import { Context, Service } from 'cordis'

export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

export interface SandboxPolicy {
  mode: SandboxMode
  workspaceRoot: string
  sessionId?: string
}

export interface ConfinedArgv {
  binary: string
  args: string[]
  useSandbox: boolean
  mode: SandboxMode
  enforcement: 'full' | 'partial' | 'none'
  denialSignatures: string[]
}

export abstract class SandboxService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'sandbox')
  }

  abstract confine(command: string, policy: SandboxPolicy): ConfinedArgv
  abstract confineInteractive(policy: SandboxPolicy): ConfinedArgv
  abstract getAvailableRunners(): string[]
}

export const name = 'sandbox'

export function apply(ctx: Context) {}

declare module '@custom-harness/core-context' {
  interface Context {
    sandbox?: SandboxService
  }
}
