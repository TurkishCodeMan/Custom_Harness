import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import fs from 'node:fs'
import path from 'node:path'

export const name = 'systemPrompt'
export const inject = ['settings', 'tools', 'skills']

export interface PromptSection {
  name: string
  order: number
  text: string | (() => string)
}

export class SystemPromptService extends Service {
  declare ctx: Context
  static inject = ['settings', 'tools', 'skills']
  private sections: Map<string, PromptSection> = new Map()
  public currentSessionWorkspace?: string
  public currentSessionPresetId?: string
  public currentSessionUserId?: string
  public currentSessionAllowedTools?: string[]
  public currentSessionAllowedSkills?: string[]

  constructor(ctx: Context) {
    super(ctx, 'systemPrompt')
    this.registerDefaults()
  }

  public setSessionWorkspace(ws: string) {
    this.currentSessionWorkspace = ws
  }

  public setSessionPresetId(id?: string) {
    this.currentSessionPresetId = id
  }

  public setSessionUserId(userId?: string) {
    this.currentSessionUserId = userId
  }

  public setAllowedTools(tools?: string[]) {
    this.currentSessionAllowedTools = tools && tools.length > 0 ? tools : []
  }

  public setAllowedSkills(skills?: string[]) {
    this.currentSessionAllowedSkills = skills && skills.length > 0 ? skills : []
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
        const snapshot = buildWorkspaceSnapshot(cwd)
        return `Operating System: ${process.platform} (${process.arch})
Current Working Directory: ${cwd}
Repository Root: ${cwd}

STRICT WORKSPACE CONFINEMENT:
- You are STRICTLY sandboxed inside the active workspace directory: ${cwd}
- You must ONLY search, read, write, edit, and execute commands within this workspace directory.
- NEVER attempt to inspect or run commands on root/system folders (/etc, /root, /usr, /var, /home/user outside workspace). Sudo and privileged commands are forbidden.

${snapshot}`
      }
    })

    // 3. Tool Usage Directives (100)
    this.section({
      name: 'tool-guidelines',
      order: 100,
      text: () => {
        return `### 🛠️ TOOL EXECUTION GUIDELINES:
- Invoke tools through the structured function calling interface.
- After tool execution completes, summarize findings clearly and directly to the user.
- When running Python scripts via terminal, use the \`python3\` binary.`
      }
    })

    // 4. Specialized Skills Catalog (110)
    this.section({
      name: 'skills-catalog',
      order: 110,
      text: () => {
        const skillsService = this.ctx.skills
        if (!skillsService) return ''
        let skillsList = skillsService.listActiveSkills
          ? skillsService.listActiveSkills(undefined, false, this.currentSessionWorkspace)
          : (skillsService.listSkills?.(undefined, false, this.currentSessionWorkspace) || []).filter((s: any) => s.enabled !== false)
        if (!skillsList || skillsList.length === 0) return ''

        // Role-based skill scoping: Preset'te açıkça seçilmemişse hiçbir beceri prompta düşmez (Zero-Trust)
        if (!this.currentSessionAllowedSkills || this.currentSessionAllowedSkills.length === 0) {
          return ''
        }

        const allowedSet = new Set(this.currentSessionAllowedSkills.map(s => s.toLowerCase()))
        skillsList = skillsList.filter((s: any) => allowedSet.has((s.id || '').toLowerCase()) || allowedSet.has((s.name || '').toLowerCase()))

        if (!skillsList || skillsList.length === 0) return ''

        const items = skillsList.map((s: any) => `- **${s.name}**: ${s.description || 'Specialized workflow instruction'} (Load via: \`skill(skillName: '${s.name}')\`)`).join('\n')
        return `### ⚡ SPECIALIZED SKILLS CATALOG:
Below is the list of active specialized skills registered in the system:
${items}

Skill Usage Directives:
- When your task relates to any specialized domain listed above, invoke \`skill(skillName: '<skill-name>')\` to load its specialized workflows and guidelines.`
      }
    })

    // 5. Factuality & Accuracy (120)
    this.section({
      name: 'anti-hallucination',
      order: 120,
      text: () => `### 🛡️ FACTUALITY & ACCURACY GUIDELINES:
1. **Action-Before-Assertion:** Verify project facts and data using tools before asserting conclusions.
2. **Epistemic Honesty:** Never fabricate missing numbers, files, or information. If details are absent, state it clearly.
3. **Verified Packages:** Use only verified dependencies and actual project configurations.`
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

/**
 * Generates a compact directory tree of the workspace (max 2 levels deep, max 60 entries).
 * Injected into the system prompt so the model knows the file layout from turn 1
 * and doesn't waste turns exploring with list_dir / bash ls.
 *
 * Token cost: ~100–300 tokens (names only, no file contents).
 */
export function buildWorkspaceSnapshot(cwd: string, maxEntries = 40, maxDepth = 2, maxPerDir = 12): string {
  if (!cwd) return ''

  try {
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) return ''
  } catch {
    return ''
  }

  const lines: string[] = []
  let entryCount = 0

  function walk(dir: string, depth: number, prefix: string): void {
    if (depth > maxDepth || entryCount >= maxEntries) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    // Directories first, then files; both sorted alphabetically
    const dirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
    const files = entries.filter(e => !e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
    const sorted = [...dirs, ...files]

    // Skip hidden dirs and common noise folders
    const SKIP = new Set(['.git', 'node_modules', '.dsh', '__pycache__', '.cache', 'dist', '.next'])

    for (let i = 0; i < sorted.length; i++) {
      if (entryCount >= maxEntries) {
        lines.push(`${prefix}... (${sorted.length - i} daha / more entries omitted)`)
        break
      }

      const entry = sorted[i]
      if (SKIP.has(entry.name)) continue

      // Cap per-directory file listing to avoid bloat in large flat dirs (e.g. 100 invoice PDFs)
      if (!entry.isDirectory() && i >= maxPerDir) {
        const remaining = sorted.slice(i).filter(e => !e.isDirectory()).length
        lines.push(`${prefix}... (${remaining} daha dosya / more files omitted)`)
        break
      }

      const isLast = i === sorted.length - 1
      const connector = isLast ? '└── ' : '├── '
      const childPrefix = isLast ? prefix + '    ' : prefix + '│   '
      const label = entry.isDirectory() ? `${entry.name}/` : entry.name

      lines.push(`${prefix}${connector}${label}`)
      entryCount++

      if (entry.isDirectory() && depth < maxDepth) {
        walk(path.join(dir, entry.name), depth + 1, childPrefix)
      }
    }
  }

  lines.push(`${path.basename(cwd)}/`)
  walk(cwd, 1, '')

  if (lines.length <= 1) return ''

  return `WORKSPACE STRUCTURE (${entryCount} entries, max depth ${maxDepth}):\n\`\`\`\n${lines.join('\n')}\n\`\`\`\nNote: This snapshot reflects the workspace at session start. Use tools for real-time state.`
}

