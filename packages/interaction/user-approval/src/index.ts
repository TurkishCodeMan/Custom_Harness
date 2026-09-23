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
  declare ctx: Context
  static inject = ['settings']
  public static instance?: ApprovalService
  private pendingApprovals = new Map<string, (outcome: ApprovalOutcome) => void>()
  private policy: ApprovalPolicy = 'ask_dangerous'

  constructor(ctx: Context) {
    super(ctx, 'approval')
    ApprovalService.instance = this
  }

  public static getInstance(ctx?: Context): ApprovalService | undefined {
    if (ApprovalService.instance) return ApprovalService.instance
    if (ctx && (ctx as any).approval) return (ctx as any).approval
    return undefined
  }

  public setPolicy(policy: ApprovalPolicy): void {
    this.policy = policy
    console.log(`🛡️ [Approval] Yetki politikası güncellendi: ${policy}`)
    if (policy === 'auto') {
      // Unblock all pending approvals immediately when user selects Tam Otonom
      for (const [id, resolve] of this.pendingApprovals.entries()) {
        this.pendingApprovals.delete(id)
        resolve('allow_once')
      }
      try {
        ;(this.ctx as any).emit('approval/cleared', {})
      } catch {}
    }
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
    const isApprovalEnabled = this.ctx.settings?.isApprovalEnabled ? this.ctx.settings.isApprovalEnabled() : true
    if (!isApprovalEnabled || this.policy === 'auto') {
      return 'allow_once'
    }
    // Auto-allow safe inspection / read-only / delegation tools
    const autoAllowedTools = [
      'mcp',
      'read',
      'read_file',
      'list',
      'list_dir',
      'search_files',
      'find_by_name',
      'glob',
      'grep',
      'grep_search',
      'workspace_browse',
      'query_session_history',
      'lsp',
      'skill',
      'manage_todo',
      'ask_user_question',
      'web_search',
      'read_url_content',
      'schedule_list',
      'schedule_get',
      'invoke_subagent',
      'subagent',
      'subagent_spawn',
      'subagent_list',
      'subagent_wait',
      'plan'
    ]

    if (
      autoAllowedTools.includes(toolName) ||
      toolName.startsWith('read_') ||
      toolName.startsWith('list_') ||
      toolName.startsWith('search_') ||
      toolName.startsWith('get_') ||
      toolName.startsWith('subagent') ||
      toolName === 'read' ||
      toolName === 'list'
    ) {
      return 'allow_once'
    }

    if (signal?.aborted) {
      return 'deny'
    }

    const id = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    return new Promise((resolve) => {
      // 30-second timeout safeguard so background operations never get stuck indefinitely
      const timer = setTimeout(() => {
        if (this.pendingApprovals.has(id)) {
          this.pendingApprovals.delete(id)
          console.warn(`[Approval] '${toolName}' onay isteği zaman aşımına uğradı, otomatik devam ediliyor.`)
          resolve('allow_once')
        }
      }, 30000)

      this.pendingApprovals.set(id, (outcome: ApprovalOutcome) => {
        clearTimeout(timer)
        resolve(outcome)
      })

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
export const inject = ['settings']

export function apply(ctx: Context) {
  ctx.set('approval', new ApprovalService(ctx))
}

export default ApprovalService
