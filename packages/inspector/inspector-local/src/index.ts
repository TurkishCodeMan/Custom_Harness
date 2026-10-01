import type { Context } from '@custom-harness/core-context'
import {
  InspectorService,
  type AgentTurnSnapshot,
  type InspectorFilter,
  type ToolExecutionRecord,
  type LlmResponseSnapshot
} from '@custom-harness/inspector'
import { InspectorStorage, type LocalInspectorConfig } from './storage.js'
import { createInspectorMiddleware } from './middleware.js'

export * from './storage.js'
export * from './middleware.js'

export const name = 'inspector-local'
export const inject = ['agentMiddleware', 'session', 'tokenMeter']

export class LocalInspectorService extends InspectorService {
  static inject = inject
  declare ctx: Context
  private storage: InspectorStorage

  constructor(ctx: Context, config?: LocalInspectorConfig) {
    super(ctx)
    this.storage = new InspectorStorage(config)
  }

  public recordTurnStart(snapshot: AgentTurnSnapshot): void {
    this.storage.save(snapshot)
    try {
      ;(this.ctx as any).emit?.('inspector/turn_start', snapshot)
    } catch {}
  }

  public recordToolExecution(sessionId: string, toolExecution: ToolExecutionRecord): void {
    const updated = this.storage.addToolExecution(sessionId, toolExecution)
    if (updated) {
      try {
        ;(this.ctx as any).emit?.('inspector/tool_execution', { sessionId, toolExecution })
      } catch {}
    }
  }

  public recordTurnEnd(sessionId: string, response: LlmResponseSnapshot): void {
    const updated = this.storage.updateTurnEnd(sessionId, response)
    if (updated) {
      try {
        ;(this.ctx as any).emit?.('inspector/turn_end', updated)
      } catch {}
    }
  }

  public getLatest(sessionId: string): AgentTurnSnapshot | undefined {
    return this.storage.getLatest(sessionId)
  }

  public getSessionTurns(sessionId: string): AgentTurnSnapshot[] {
    return this.storage.getSessionTurns(sessionId)
  }

  public getTurn(id: string): AgentTurnSnapshot | undefined {
    return this.storage.getTurn(id)
  }

  public query(filter?: InspectorFilter): AgentTurnSnapshot[] {
    return this.storage.query(filter)
  }

  public clear(sessionId?: string): void {
    this.storage.clear(sessionId)
  }
}

export function apply(ctx: Context, config?: LocalInspectorConfig) {
  const service = new LocalInspectorService(ctx, config)
  ctx.set('inspector', service)

  // Attach middleware into Cordis agentMiddleware pipeline
  const middleware = createInspectorMiddleware(service, ctx)
  if (ctx.agentMiddleware?.register) {
    ctx.agentMiddleware.register(middleware)
  } else {
    // If agentMiddleware loads later, register on ready
    ctx.on('ready', () => {
      if (ctx.agentMiddleware?.register) {
        ctx.agentMiddleware.register(middleware)
      }
    })
  }

  // Also listen for final agent done metrics (e.g. usage, duration) to enrich snapshot
  ctx.on('agent/done' as any, (data: any) => {
    if (data?.sessionId) {
      service.recordTurnEnd(data.sessionId, {
        usage: data.measurement?.usage,
        durationMs: data.measurement?.durationMs,
        completedAt: Date.now()
      })
    }
  })

  // Listen for agent errors
  ctx.on('agent/error' as any, (data: any) => {
    if (data?.sessionId) {
      service.recordTurnEnd(data.sessionId, {
        error: data.error || 'Unknown error occurred in agent turn',
        completedAt: Date.now()
      })
    }
  })
}

export default LocalInspectorService
