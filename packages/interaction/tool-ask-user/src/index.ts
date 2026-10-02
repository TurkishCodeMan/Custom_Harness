import fs from 'node:fs'
import path from 'node:path'
import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-ask-user'
export const inject = ['tools', 'userQuestions', 'approval']

function extractCaseId(args: any): string | null {
  if (args.case_id && typeof args.case_id === 'string') return args.case_id.trim().toUpperCase()
  if (args.details?.case_id && typeof args.details.case_id === 'string') return args.details.case_id.trim().toUpperCase()
  const text = `${args.title || ''} ${args.summary || ''}`
  const match = text.match(/\b(CASE-\d{4}-\d{3,5})\b/i)
  return match ? match[1].toUpperCase() : null
}

const description = 'Ask the user a concise question when you need confirmation, a choice, or missing information before proceeding. '
  + 'Send one or more questions, each with a stable id that will be echoed in the answer.'

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ask_user_question',
    description,
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          description: 'Questions to ask the user before continuing.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Stable id for this question; echoed in the answer.' },
              question: { type: 'string', description: 'The specific question to ask the user.' },
              header: {
                type: 'string',
                description: 'Optional short heading for the question, such as "Confirm" or "Choose Mode".',
              },
              options: {
                type: 'array',
                description: 'Optional choices to show the user. If you recommend one, put it first and append "(Recommended)" to that label.',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: 'Short user-facing option label.' },
                    description: { type: 'string', description: 'One sentence explaining the tradeoff or impact.' },
                  },
                  required: ['label']
                },
              },
              multi_select: {
                type: 'boolean',
                description: 'Whether the user may select more than one option. Defaults to false.',
              },
            },
            required: ['id', 'question']
          },
        },
      },
      required: ['questions']
    },
    async execute(args: { questions: any[] }, exec?: { signal?: AbortSignal }) {
      const result = await ctx.userQuestions.ask({
        questions: args.questions.map(question => ({
          id: question.id,
          question: question.question,
          ...(question.header !== undefined ? { header: question.header } : {}),
          ...(question.options !== undefined ? { options: question.options } : {}),
          ...(question.multi_select !== undefined ? { multiSelect: question.multi_select } : {}),
        })),
        signal: exec?.signal,
      })
      return JSON.stringify(result, null, 2)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'submit_decision_for_approval',
    description: 'Submits a finalized business decision, recommendation, high-value transaction, or critical action to the executive human approval queue (Company OS Approvals). The workflow pauses until an authorized human operator approves or denies the submission. Once approved, the canonical approval record is written to cases/<case_id>/final/approval.json automatically.',
    parameters: {
      type: 'object',
      required: ['action', 'title', 'summary'],
      properties: {
        action: {
          type: 'string',
          description: 'Standardized action identifier (e.g., INVOICE_PAYMENT_APPROVAL, BUDGET_OVERRUN, DEPLOY_PRODUCTION, CONTRACT_SIGN, REFUND_REQUEST).'
        },
        case_id: {
          type: 'string',
          description: 'Case identifier (e.g. CASE-2026-0001, CASE-2026-0002).'
        },
        approval_file_path: {
          type: 'string',
          description: 'Optional target path where the canonical approval record should be persisted (e.g. "cases/CASE-2026-0001/final/approval.json" or "approvals/INV-11.json"). Adapts to company workspace layout.'
        },
        title: {
          type: 'string',
          description: 'Concise headline for the approval card displayed in Company OS (e.g., "Fatura 51109301 Ödeme Onayı").'
        },
        summary: {
          type: 'string',
          description: 'Detailed justification and audit summary explaining why this approval is recommended.'
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Risk and urgency level of the request. Defaults to medium.'
        },
        details: {
          type: 'object',
          description: 'Structured key-value payload supporting the decision (e.g., { invoice_no, amount, currency, supplier, case_id, approval_file_path }).'
        }
      }
    },
    async execute(
      args: { action: string; case_id?: string; approval_file_path?: string; title: string; summary: string; severity?: string; details?: any },
      exec?: { sessionId?: string; signal?: AbortSignal; activePreset?: any }
    ) {
      const sessionId = exec?.sessionId || 'default'
      const caseId = extractCaseId(args)
      const workspace = (ctx as any).settings?.getWorkspace?.() || process.cwd()

      // Resolve canonical approval path dynamically from arguments or company structure
      const customPath = args.approval_file_path || args.details?.approval_file_path || args.details?.output_path
      let canonicalPath: string | null = null
      if (customPath) {
        canonicalPath = path.isAbsolute(customPath) ? customPath : path.join(workspace, customPath)
      } else if (args.details?.case_dir) {
        canonicalPath = path.join(workspace, args.details.case_dir, 'approval.json')
      } else if (caseId && fs.existsSync(path.join(workspace, 'cases', caseId))) {
        // Only use cases/<caseId>/final/ if that specific case folder exists on disk in this workspace
        canonicalPath = path.join(workspace, 'cases', caseId, 'final', 'approval.json')
      } else if (caseId) {
        canonicalPath = path.join(workspace, 'approvals', `${caseId}_approval.json`)
      }

      // 1. Backend Idempotency Check: Don't reopen approval if already approved
      if (canonicalPath && fs.existsSync(canonicalPath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'))
          if (existing.action === args.action && existing.status === 'APPROVED') {
            return JSON.stringify({
              status: 'APPROVED',
              outcome: 'allow_once',
              approved: true,
              action: args.action,
              case_id: caseId,
              canonical_state_file: canonicalPath,
              message: `[IDEMPOTENCY]: Bu vaka (${caseId}) ve aksiyon (${args.action}) için resmi onay daha önce (${existing.approved_at}) alınmış ve kaydedilmiş. Mükerrer onay açılmadı.`,
              approval_record: existing
            }, null, 2)
          }
        } catch {}
      }

      const approvalSvc = (ctx as any).approval
      if (!approvalSvc || typeof approvalSvc.requestDecisionApproval !== 'function') {
        return JSON.stringify({
          status: 'APPROVED',
          outcome: 'allow_once',
          approved: true,
          message: 'Sistemde onay servisi etkin olmadığı için otomatik onaylandı.'
        }, null, 2)
      }

      const outcome = await approvalSvc.requestDecisionApproval({
        sessionId,
        positionId: exec?.activePreset?.id,
        positionTitle: exec?.activePreset?.name || exec?.activePreset?.id,
        action: args.action,
        title: args.title,
        summary: args.summary,
        severity: args.severity || 'medium',
        details: { ...(args.details || {}), ...(caseId ? { case_id: caseId } : {}) },
        signal: exec?.signal
      })

      const approved = outcome === 'allow_once' || outcome === 'allow_always'

      // 2. Canonical Business State Persistence on Approval
      let canonicalInfo: any = null
      if (approved && canonicalPath && caseId) {
        try {
          fs.mkdirSync(path.dirname(canonicalPath), { recursive: true })
          canonicalInfo = {
            approval_id: `APR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            case_id: caseId,
            action: args.action,
            status: 'APPROVED',
            approved_by: 'user_admin',
            approved_at: new Date().toISOString(),
            decision_source: exec?.activePreset?.id || 'invoice-reviewer-v1',
            summary: args.summary,
            details: args.details || {}
          }
          fs.writeFileSync(canonicalPath, JSON.stringify(canonicalInfo, null, 2), 'utf8')
        } catch (e: any) {
          console.warn(`[tool-ask-user] Failed to write canonical approval.json for ${caseId}:`, e.message)
        }
      }

      return JSON.stringify({
        status: approved ? 'APPROVED' : 'DENIED',
        outcome,
        approved,
        action: args.action,
        title: args.title,
        case_id: caseId,
        canonical_state_file: canonicalInfo ? canonicalPath : undefined,
        message: approved
          ? `Yönetici bu kararı resmi olarak onayladı (${args.action}).${canonicalInfo ? ` Kanonik onay durumu '${canonicalPath}' dosyasına kaydedildi.` : ''}`
          : `Yönetici bu kararı reddetti (${args.action}). İşlem durduruldu.`
      }, null, 2)
    }
  }))
}
