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
    if (!process.env.WORKSPACE_DIR) {
      this.registerCodeMode()
    }
  }

  /**
   * Registers the DeepSeek-Harness Code Mode (run_code) tool
   */
  private registerCodeMode() {
    this.register(defineTool({
      name: 'run_code',
      description: 'Execute a JavaScript/TypeScript program that calls tools programmatically. Use `await tools.<name>(args)` to call tools. Returns the evaluation result.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The body of an async function. You can use `await tools.<toolName>(args)` and `return <value>`.'
          },
          description: {
            type: 'string',
            description: 'Brief description of what this code script does.'
          }
        },
        required: ['code']
      },
      execute: async (args: { code: string; description?: string }, context) => {
        const logs: string[] = []
        const toolProxy: Record<string, Function> = {}

        // Construct tool proxy functions
        for (const tool of this.getActiveTools()) {
          if (tool.name === 'run_code') continue
          toolProxy[tool.name] = async (toolArgs: any) => {
            logs.push(`[run_code:call] -> ${tool.name}`)
            const res = await tool.execute(toolArgs, context)
            return res
          }
        }

        try {
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
          const fn = new AsyncFunction('tools', 'console', 'context', `
            const customLogs = [];
            const customConsole = {
              log: (...args) => customLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
              error: (...args) => customLogs.push('[ERROR] ' + args.join(' ')),
              warn: (...args) => customLogs.push('[WARN] ' + args.join(' '))
            };
            try {
              const __result = await (async () => {
                ${args.code}
              })();
              return { success: true, result: __result, logs: customLogs };
            } catch (err) {
              return { success: false, error: err.message, stack: err.stack, logs: customLogs };
            }
          `)

          const execution = await fn(toolProxy, console, context)
          return execution
        } catch (err: any) {
          return {
            success: false,
            error: `Code Mode Sözdizimi/Çalıştırma Hatası: ${err.message}`
          }
        }
      }
    }))
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
