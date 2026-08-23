import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type {
  AgentMiddlewareDefinition,
  BeforeChatContext,
  BeforeToolContext,
  AfterToolContext,
  AfterChatContext
} from './types.js'
import {
  runBeforeChatPipeline,
  runBeforeToolPipeline,
  runAfterToolPipeline,
  runAfterChatPipeline
} from './pipeline.js'

export * from './types.js'
export * from './define.js'
export * from './pipeline.js'

export const name = 'agentMiddleware'

export class AgentMiddlewareService extends Service {
  declare ctx: Context
  private middlewares: Map<string, AgentMiddlewareDefinition> = new Map()

  constructor(ctx: Context) {
    super(ctx, 'agentMiddleware')
  }

  /**
   * Registers a middleware definition. Returns an unregister callback.
   */
  public register(mw: AgentMiddlewareDefinition): () => void {
    this.middlewares.set(mw.name, mw)
    return () => {
      this.middlewares.delete(mw.name)
    }
  }

  /**
   * Unregisters a middleware by name.
   */
  public unregister(name: string): boolean {
    return this.middlewares.delete(name)
  }

  /**
   * Returns all currently registered middleware definitions.
   */
  public listMiddlewares(): AgentMiddlewareDefinition[] {
    return Array.from(this.middlewares.values())
  }

  /**
   * Runs the beforeChat pipeline before sending messages to the LLM.
   */
  public async runBeforeChat(ctx: BeforeChatContext): Promise<void> {
    const list = this.listMiddlewares()
    await runBeforeChatPipeline(list, ctx)
  }

  /**
   * Runs the beforeTool pipeline before executing a tool.
   */
  public async runBeforeTool(ctx: BeforeToolContext): Promise<{ shouldBlock: boolean; output?: any }> {
    const list = this.listMiddlewares()
    return await runBeforeToolPipeline(list, ctx)
  }

  /**
   * Runs the afterTool pipeline to format or prune tool outputs.
   */
  public async runAfterTool(ctx: AfterToolContext): Promise<any> {
    const list = this.listMiddlewares()
    return await runAfterToolPipeline(list, ctx)
  }

  /**
   * Runs the afterChat pipeline when a turn finishes without active tool calls.
   */
  public async runAfterChat(ctx: AfterChatContext): Promise<{ shouldContinue: boolean; prompt?: string }> {
    const list = this.listMiddlewares()
    return await runAfterChatPipeline(list, ctx)
  }
}

export function apply(ctx: Context) {
  ctx.set('agentMiddleware', new AgentMiddlewareService(ctx))
}
