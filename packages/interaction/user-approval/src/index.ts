import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface ApprovalRequest {
  id: string
  action: string
  details?: any
  createdAt: number
}

export type ApprovalOutcome = 'allow_once' | 'allow_always' | 'deny'

export type ApprovalPolicy = 'auto' | 'ask_dangerous' | 'ask_all'

export interface ApprovalResponse {
  id: string
  outcome: ApprovalOutcome
}

export class ApprovalService extends Service {
  private pendingApprovals = new Map<string, (outcome: ApprovalOutcome) => void>()
  private policy: ApprovalPolicy = 'ask_dangerous'

  constructor(ctx: Context) {
    super(ctx, 'approval')
  }

  public setPolicy(policy: ApprovalPolicy): void {
    this.policy = policy
  }

  public getPolicy(): ApprovalPolicy {
    return this.policy
  }

  public async ask(action: string, details?: any): Promise<ApprovalOutcome> {
    return this.requestApproval('default', action, details)
  }

  public async requestApproval(
    sessionId: string,
    toolName: string,
    args: any,
    extra?: any,
    signal?: AbortSignal
  ): Promise<ApprovalOutcome> {
    if (this.policy === 'auto') {
      return 'allow_once'
    }
    // Auto-allow safe inspection / read-only tools
    const autoAllowedTools = [
      'mcp',
      'read_file',
      'list_dir',
      'search_files',
      'query_session_history',
      'lsp',
      'skill',
      'manage_todo',
      'ask_user_question'
    ]

    if (autoAllowedTools.includes(toolName)) {
      return 'allow_once'
    }

    if (signal?.aborted) {
      return 'deny'
    }

    const id = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    return new Promise((resolve) => {
      this.pendingApprovals.set(id, resolve)
      this.ctx.emit('approval/asked', {
        id,
        sessionId,
        toolName,
        action: toolName,
        args,
        details: args,
        createdAt: Date.now()
      })
    })
  }

  public respond(id: string, outcome: ApprovalOutcome): boolean {
    const resolve = this.pendingApprovals.get(id)
    if (resolve) {
      this.pendingApprovals.delete(id)
      resolve(outcome)
      return true
    }
    return false
  }
}

export const name = 'user-approval'

export function apply(ctx: Context) {
  ctx.set('approval', new ApprovalService(ctx))
}

export default ApprovalService
