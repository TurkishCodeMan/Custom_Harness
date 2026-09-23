import type { Context } from '@custom-harness/core-context'
import { ScheduleService } from './runtime.js'
import { registerScheduleTools } from './tools.js'

export * from './types.js'
export * from './domain.js'
export * from './runtime.js'
export * from './tools.js'

export const name = 'schedule'
export const inject = ['tools', 'settings', 'session', 'agent', 'agentPresets']

export function apply(ctx: Context) {
  const service = new ScheduleService(ctx)
  ctx.set('schedule', service)

  const disposers = registerScheduleTools(ctx, service)

  ctx.on('dispose', () => {
    service.stop()
    for (const d of disposers) {
      try { d() } catch {}
    }
  })
}

export default ScheduleService
