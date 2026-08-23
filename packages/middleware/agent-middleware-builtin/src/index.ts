import type { Context } from '@custom-harness/core-context'
import { skillPrunerMiddleware } from './skill-pruner.js'
import { toolFilterMiddleware } from './tool-filter.js'
import { skillReminderMiddleware } from './skill-reminder.js'
import { autoSummaryMiddleware } from './auto-summary.js'
import { sqlSafetyGuardMiddleware } from './sql-guard.js'

export * from './skill-pruner.js'
export * from './tool-filter.js'
export * from './skill-reminder.js'
export * from './auto-summary.js'
export * from './sql-guard.js'

export const name = 'agent-middleware-builtin'
export const inject = ['agentMiddleware']

/**
 * Registers all built-in agent middleware into the AgentMiddlewareService.
 *
 * beforeChat pipeline (execution order by `order` field):
 *   - skill-pruner    (order: -100, all presets)  — replaces large historical skill docs with refs
 *   - tool-filter     (order:  -90, all presets)  — hides disallowed tools from LLM schema
 *   - skill-reminder  (order:  -80, preset: test) — injects available-skills note on turn 1
 *
 * beforeTool pipeline:
 *   - sql-safety-guard (order:    0, preset: test) — read-only SQL policy for Analysis SQL Agent
 *
 * afterChat pipeline:
 *   - auto-summary    (order:  100, all presets)  — triggers summary turn when model returns empty
 */
export function apply(ctx: Context) {
  ctx.agentMiddleware.register(skillPrunerMiddleware)
  ctx.agentMiddleware.register(toolFilterMiddleware)
  ctx.agentMiddleware.register(skillReminderMiddleware)
  ctx.agentMiddleware.register(sqlSafetyGuardMiddleware)
  ctx.agentMiddleware.register(autoSummaryMiddleware)
}
