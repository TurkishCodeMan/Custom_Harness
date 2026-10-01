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
      'submit_decision_for_approval',
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

    // Auto-allow safe calculation / inspection bash commands (python arithmetic, cat, ls, head)
    if (toolName === 'bash' && typeof args?.command === 'string') {
      const cmd = args.command.trim()
      // Strip leading cd commands like "cd /path/to/dir && ..."
      const effectiveCmd = cmd.replace(/^cd\s+[^&;]+\s*(&&|;)\s*/i, '').trim()
      const isSafe = /^(python3?\s+-c|cat|head|tail|echo|ls|grep|find|wc|pwd)\b/i.test(effectiveCmd)
      const hasDestructive = /(rm|mv|chmod|chown|dd|mkfs|sudo|kill|pkill)\b/i.test(cmd)
      if (isSafe && !hasDestructive) {
        return 'allow_once'
      }
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
        action: extra?.action || toolName,
        title: extra?.title || `${toolName}`,
        summary: extra?.summary,
        severity: extra?.severity || 'medium',
        args,
        details: extra?.details || args,
        createdAt: Date.now()
      })
    })
  }

  public async requestDecisionApproval(params: {
    sessionId: string
    positionId?: string
    positionTitle?: string
    action: string
    title: string
    summary: string
    severity?: string
    details?: any
    timeoutMs?: number
    signal?: AbortSignal
  }): Promise<ApprovalOutcome> {
    const isApprovalEnabled = this.ctx.settings?.isApprovalEnabled ? this.ctx.settings.isApprovalEnabled() : true
    if (!isApprovalEnabled) {
      return 'allow_once'
    }
    if (params.signal?.aborted) {
      return 'deny'
    }

    const id = `appr_decision_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const timeoutMs = params.timeoutMs ?? 300_000 // 5 minutes default for human business decisions

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pendingApprovals.has(id)) {
          this.pendingApprovals.delete(id)
          console.warn(`[Approval] Karar onayı zaman aşımına uğradı (${params.action}): ${id}`)
          resolve('deny')
        }
      }, timeoutMs)

      this.pendingApprovals.set(id, (outcome: ApprovalOutcome) => {
        clearTimeout(timer)
        resolve(outcome)
      })

      this.ctx.emit('approval/asked', {
        id,
        sessionId: params.sessionId,
        positionId: params.positionId,
        positionTitle: params.positionTitle,
        toolName: 'submit_decision_for_approval',
        action: params.action,
        title: params.title,
        summary: params.summary,
        severity: params.severity || 'medium',
        details: params.details || {},
        timeout: Math.round(timeoutMs / 1000),
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
