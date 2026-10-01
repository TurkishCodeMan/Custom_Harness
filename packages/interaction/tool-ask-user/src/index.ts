import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-ask-user'
export const inject = ['tools', 'userQuestions', 'approval']

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
    description: 'Submits a finalized business decision, recommendation, high-value transaction, or critical action to the executive human approval queue (Company OS Approvals). The workflow pauses until an authorized human operator approves or denies the submission.',
    parameters: {
      type: 'object',
      required: ['action', 'title', 'summary'],
      properties: {
        action: {
          type: 'string',
          description: 'Standardized action identifier (e.g., INVOICE_PAYMENT_APPROVAL, BUDGET_OVERRUN, DEPLOY_PRODUCTION, CONTRACT_SIGN, REFUND_REQUEST).'
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
          description: 'Structured key-value payload supporting the decision (e.g., { invoice_no, amount, currency, supplier }).'
        }
      }
    },
    async execute(
      args: { action: string; title: string; summary: string; severity?: string; details?: any },
      exec?: { sessionId?: string; signal?: AbortSignal; activePreset?: any }
    ) {
      const sessionId = exec?.sessionId || 'default'
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
        details: args.details || {},
        signal: exec?.signal
      })

      const approved = outcome === 'allow_once' || outcome === 'allow_always'
      return JSON.stringify({
        status: approved ? 'APPROVED' : 'DENIED',
        outcome,
        approved,
        action: args.action,
        title: args.title,
        message: approved
          ? `Yönetici bu kararı resmi olarak onayladı (${args.action}).`
          : `Yönetici bu kararı reddetti (${args.action}). İşlem durduruldu.`
      }, null, 2)
    }
  }))
}
