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
  public currentSessionAllowedTools?: string[]

  constructor(ctx: Context) {
    super(ctx, 'systemPrompt')
    this.registerDefaults()
  }

  public setSessionWorkspace(ws: string) {
    this.currentSessionWorkspace = ws
  }

  public setAllowedTools(tools?: string[]) {
    this.currentSessionAllowedTools = tools && tools.length > 0 ? tools : undefined
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
        return `Operating System: ${process.platform} (${process.arch})\nCurrent Working Directory: ${cwd}\nRepository Root: ${cwd}\n\nSTRICT WORKSPACE CONFINEMENT:\n- You are STRICTLY sandboxed inside the active workspace directory: ${cwd}\n- You must ONLY search, read, write, edit, and execute commands within this workspace directory.\n- NEVER attempt to inspect or run commands on root/system folders (/etc, /root, /usr, /var, /home/user outside workspace). Sudo and privileged commands are forbidden.`
      }
    })

    // 3. Tool Usage Directives (100)
    this.section({
      name: 'tool-guidelines',
      order: 100,
      text: () => {
        let activeTools = this.ctx.tools?.getActiveTools() || []
        if (this.currentSessionAllowedTools && this.currentSessionAllowedTools.length > 0) {
          const allowedSet = new Set(this.currentSessionAllowedTools)
          activeTools = activeTools.filter(t => allowedSet.has(t.name))
        }
        const toolList = activeTools.map(t => `- **${t.name}**: ${t.description}`).join('\n')
        const toolNames = activeTools.map(t => `'${t.name}'`).join(', ')
        return `AVAILABLE TOOLS (${activeTools.length} Tools Currently Active):\n${toolList || '(No tools enabled)'}\n\nCRITICAL OPERATIONAL RULES:
- You ONLY have access to the active tools listed above (${toolNames}). Do NOT attempt to invoke any other tool name.
- ALWAYS invoke the real tool call (e.g. ${toolNames}).
- NEVER merely write commands in plain text.
- Inspect tool execution results, apply necessary changes, and always provide a clear, helpful, natural language response directly to the user summarizing the result or explaining any issues.
- When running Python scripts in bash/terminal, ALWAYS use the \`python3\` binary. Do NOT use unaliased \`python\`.`
      }
    })

    // 4. Specialized Skills Catalog (110)
    this.section({
      name: 'skills-catalog',
      order: 110,
      text: () => {
        const skillsService = (this.ctx as any).skills
        if (!skillsService) return ''
        const skillsList = skillsService.listActiveSkills
          ? skillsService.listActiveSkills()
          : (skillsService.listSkills?.() || []).filter((s: any) => s.enabled !== false)
        if (!skillsList || skillsList.length === 0) return ''
        const items = skillsList.map((s: any) => `- **${s.name}**: ${s.description || 'Uzmanlık talimatı'} (Yüklemek için: \`skill(skillName: '${s.name}')\`)`).join('\n')
        return `### ⚡ MEVCUT UZMANLIK BECERİLERİ (Specialized Skills Catalog):
Aşağıda sistemde kayıtlı ve aktif uzmanlık becerileri listelenmiştir:
${items}

Skill Kullanım Yönergesi:
- Göreviniz yukarıdaki özel alan becerilerinden biriyle ilgili olduğunda, ihtiyaç duyduğunuzda \`skill(skillName: '<beceri adı>')\` aracını çağırarak ilgili uzmanlık yönergelerini yükleyebilirsiniz.`
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
