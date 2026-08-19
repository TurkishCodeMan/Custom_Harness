import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'plan-mode'
export const inject = ['tools', 'systemPrompt']

export class PlanModeService extends Service {
  private active = false

  constructor(ctx: Context) {
    super(ctx, 'planMode')
  }

  public isPlanMode(): boolean {
    return this.active
  }

  public setPlanMode(active: boolean) {
    this.active = active
    console.log(`[PlanMode] Planning Mode is now: ${active ? 'ACTIVE' : 'INACTIVE'}`)
  }
}

export function apply(ctx: Context) {
  const service = new PlanModeService(ctx)
  ctx.set('planMode', service)

  // 1. System Prompt Layer for Plan Mode
  if (ctx.systemPrompt?.section) {
    ctx.systemPrompt.section({
      name: 'plan-mode-guidance',
      order: 15,
      text: () => {
        if (!service.isPlanMode()) return ''
        return `\n## PLANNING MODE (Active)\nYou are currently in Planning Mode.\n1. DO NOT modify any code or execute destructive file writes.\n2. Conduct research using read_file, list_dir, grep_search, and lsp.\n3. Draft a thorough implementation plan including proposed changes and verification steps.\n4. When your plan is ready, call exit_plan_mode to submit it for user review.\n`
      }
    })
  }

  // 2. Model-facing exit_plan_mode tool
  ctx.tools.register(
    defineTool({
      name: 'exit_plan_mode',
      description: 'Submits the drafted implementation plan for user review and exits Planning Mode.',
      parameters: {
        type: 'object',
        properties: {
          planSummary: {
            type: 'string',
            description: 'Concise summary of the implementation plan and key architectural decisions.'
          },
          readyForExecution: {
            type: 'boolean',
            description: 'Set to true when the plan is complete and ready for user approval.'
          }
        },
        required: ['planSummary']
      },
      async execute({ planSummary, readyForExecution }: { planSummary: string; readyForExecution?: boolean }) {
        if (readyForExecution) {
          service.setPlanMode(false)
          return `Plan submitted successfully! Planning mode disabled. You may now proceed with code modifications following the plan:\n\n${planSummary}`
        }
        return `Plan draft recorded:\n\n${planSummary}`
      }
    })
  )
}

export default PlanModeService
