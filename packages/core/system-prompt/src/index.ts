import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export const name = 'systemPrompt'
export const inject = ['settings', 'tools']

export interface PromptSection {
  name: string
  order: number
  text: string | (() => string)
}

export class SystemPromptService extends Service {
  declare ctx: Context
  static inject = ['settings', 'tools']
  private sections: Map<string, PromptSection> = new Map()
  public currentSessionWorkspace?: string

  constructor(ctx: Context) {
    super(ctx, 'systemPrompt')
    this.registerDefaults()
  }

  public setSessionWorkspace(ws: string) {
    this.currentSessionWorkspace = ws
  }

  private registerDefaults() {
    // 1. Base Identity (-100)
    this.section({
      name: 'identity',
      order: -100,
      text: () => {
        const model = this.ctx.settings?.getActiveModel()
        return `You are an elite autonomous AI Software Engineer and Autonomous Agent running on DeepSeek Harness Architecture.\nPowered by model: ${model?.name || model?.id || 'Custom LLM'}.`
      }
    })

    // 2. Working Directory & Workspace (50)
    this.section({
      name: 'workspace',
      order: 50,
      text: () => {
        const settings = this.ctx.settings?.getSettings()
        const cwd = this.currentSessionWorkspace || settings?.workspace || process.cwd()
        return `Operating System: ${process.platform} (${process.arch})\nCurrent Working Directory: ${cwd}\nRepository Root: ${cwd}`
      }
    })

    // 3. Tool Usage Directives (100)
    this.section({
      name: 'tool-guidelines',
      order: 100,
      text: () => {
        const activeTools = this.ctx.tools?.getActiveTools() || []
        const toolList = activeTools.map(t => `- **${t.name}**: ${t.description}`).join('\n')
        const toolNames = activeTools.map(t => `'${t.name}'`).join(', ')
        return `AVAILABLE TOOLS (${activeTools.length} Tools Currently Active):\n${toolList || '(No tools enabled)'}\n\nCRITICAL OPERATIONAL RULES:
- You ONLY have access to the active tools listed above (${toolNames}). Do NOT attempt to invoke any other tool name.
- ALWAYS invoke the real tool call (e.g. ${toolNames}).
- NEVER merely write commands in plain text.
- Inspect results, apply necessary changes, and conclude your work.`
      }
    })
  }

  /**
   * Registers or updates a system prompt section by unique name
   */
  public section(sec: PromptSection): void {
    this.sections.set(sec.name, sec)
  }

  public removeSection(name: string): void {
    this.sections.delete(name)
  }

  /**
   * Assembles and renders all registered prompt sections in ascending order
   */
  public render(): string {
    const sorted = Array.from(this.sections.values()).sort((a, b) => a.order - b.order)
    const parts = sorted.map(sec => {
      const content = typeof sec.text === 'function' ? sec.text() : sec.text
      return content.trim()
    }).filter(Boolean)

    return parts.join('\n\n')
  }
}

export function apply(ctx: Context) {
  ctx.set('systemPrompt', new SystemPromptService(ctx))
}
