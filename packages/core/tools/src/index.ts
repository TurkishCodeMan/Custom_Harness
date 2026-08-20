import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ToolDefinition } from '@custom-harness/core-types'

export function defineTool(def: ToolDefinition): ToolDefinition {
  return def
}

export const name = 'tools'
export const inject = ['settings']

export class ToolsService extends Service {
  declare ctx: Context
  static inject = ['settings']
  private registry = new Map<string, ToolDefinition>()

  constructor(ctx: Context) {
    super(ctx, 'tools')
  }

  public register(tool: ToolDefinition): () => void {
    this.registry.set(tool.name, tool)
    return () => this.unregister(tool.name)
  }

  public unregister(name: string) {
    this.registry.delete(name)
  }

  public get(name: string): ToolDefinition | undefined {
    return this.registry.get(name)
  }

  public getAll(): ToolDefinition[] {
    return Array.from(this.registry.values())
  }

  public getActiveTools(): ToolDefinition[] {
    return Array.from(this.registry.values()).filter(tool => {
      return this.ctx.settings?.isToolEnabled ? this.ctx.settings.isToolEnabled(tool.name) : true
    })
  }

  public getOpenAiSchemas(): any[] {
    return this.getActiveTools().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
  }

  public async execute(
    name: string,
    args: any,
    context?: { signal?: AbortSignal; cwd?: string; sessionId?: string }
  ): Promise<any> {
    const isEnabled = this.ctx.settings?.isToolEnabled ? this.ctx.settings.isToolEnabled(name) : true
    if (!isEnabled) {
      throw new Error(`Araç şu anda devre dışı: ${name}`)
    }
    const tool = this.registry.get(name)
    if (!tool) {
      throw new Error(`Araç bulunamadı: ${name}`)
    }

    // 1. tools/pre-execute hook
    this.ctx.emit('tools/pre-execute' as any, { name, args, context })

    // 2. Execute
    const result = await tool.execute(args, context)

    // 3. tools/post-execute hook
    this.ctx.emit('tools/post-execute' as any, { name, args, result, context })

    return result
  }
}

export function apply(ctx: Context) {
  ctx.set('tools', new ToolsService(ctx))
}
