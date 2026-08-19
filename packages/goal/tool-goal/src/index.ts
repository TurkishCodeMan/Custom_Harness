import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export interface GoalState {
  id: string
  objective: string
  criteria: string[]
  completedCriteria: string[]
  active: boolean
  round: number
}

export const name = 'tool-goal'
export const inject = ['tools']

export class GoalService extends Service {
  private currentGoal: GoalState | null = null

  constructor(ctx: Context) {
    super(ctx, 'goal')
  }

  public setGoal(objective: string, criteria: string[]): GoalState {
    this.currentGoal = {
      id: `goal-${Date.now()}`,
      objective,
      criteria,
      completedCriteria: [],
      active: true,
      round: 1
    }
    return this.currentGoal
  }

  public markCriterion(criterion: string): GoalState | null {
    if (!this.currentGoal) return null
    if (!this.currentGoal.completedCriteria.includes(criterion)) {
      this.currentGoal.completedCriteria.push(criterion)
    }
    if (this.currentGoal.completedCriteria.length === this.currentGoal.criteria.length) {
      this.currentGoal.active = false
    }
    return this.currentGoal
  }

  public getGoal(): GoalState | null {
    return this.currentGoal
  }
}

export function apply(ctx: Context) {
  const service = new GoalService(ctx)
  ctx.set('goal', service)

  ctx.tools.register(
    defineTool({
      name: 'manage_goal',
      description: 'Tracks and manages long-running autonomous project goals with multi-criteria checklist.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['set', 'check', 'mark_criterion', 'status'],
            description: 'Action to perform on the active goal.'
          },
          objective: {
            type: 'string',
            description: 'The high-level objective (required when action=set).'
          },
          criteria: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of verifiable criteria that define success (required when action=set).'
          },
          criterionCompleted: {
            type: 'string',
            description: 'The specific criterion that was verified (required when action=mark_criterion).'
          }
        },
        required: ['action']
      },
      async execute({ action, objective, criteria, criterionCompleted }: { action: string; objective?: string; criteria?: string[]; criterionCompleted?: string }) {
        if (action === 'set' && objective && criteria) {
          const g = service.setGoal(objective, criteria)
          return `Goal initialized with ${g.criteria.length} criteria:\n\n` + g.criteria.map((c, i) => `[ ] ${i + 1}. ${c}`).join('\n')
        }

        if (action === 'mark_criterion' && criterionCompleted) {
          const g = service.markCriterion(criterionCompleted)
          if (!g) return 'No active goal found.'
          const remaining = g.criteria.length - g.completedCriteria.length
          return `Criterion completed! Remaining: ${remaining}/${g.criteria.length}`
        }

        const current = service.getGoal()
        if (!current) return 'No active goal is set.'
        return JSON.stringify(current, null, 2)
      }
    })
  )
}

export default GoalService
