import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import type { SkillItem } from '@custom-harness/core-types'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const name = 'plugin-skills'
export const inject = ['tools', 'settings']

export class SkillsService extends Service {
  private skills = new Map<string, SkillItem>()

  constructor(ctx: Context) {
    super(ctx, 'skills')
    this.discover()
  }

  public discover(targetDir?: string) {
    this.skills.clear()

    const activeWorkspace = targetDir || process.env.WORKSPACE_DIR || process.cwd()
    const searchDirs: string[] = []

    // 1. custom-harness ana çalıştırma dizini (.agents/skills)
    let frameworkRoot = path.resolve(__dirname)
    while (frameworkRoot && frameworkRoot !== path.dirname(frameworkRoot)) {
      const harnessSkills = path.join(frameworkRoot, '.agents', 'skills')
      if (fs.existsSync(harnessSkills) && !searchDirs.includes(harnessSkills)) {
        searchDirs.push(harnessSkills)
        break
      }
      frameworkRoot = path.dirname(frameworkRoot)
    }

    // 2. Aktif çalışılan proje/workspace dizini (.agents/skills)
    let cur = path.resolve(activeWorkspace)
    while (cur && cur !== path.dirname(cur)) {
      const candidate = path.join(cur, '.agents', 'skills')
      if (fs.existsSync(candidate) && !searchDirs.includes(candidate)) {
        searchDirs.push(candidate)
      }
      cur = path.dirname(cur)
    }

    // 3. Global kullanıcı dizini (~/.agents/skills)
    const userGlobalSkills = path.join(os.homedir(), '.agents', 'skills')
    if (fs.existsSync(userGlobalSkills) && !searchDirs.includes(userGlobalSkills)) {
      searchDirs.push(userGlobalSkills)
    }

    for (const baseDir of searchDirs) {
      if (!fs.existsSync(baseDir)) continue
      try {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillFile = path.join(baseDir, entry.name, 'SKILL.md')
            if (fs.existsSync(skillFile)) {
              this.loadSkill(entry.name, skillFile)
            }
          }
        }
      } catch (e) {
        console.warn('[Skills] Failed to read skills dir:', baseDir, e)
      }
    }
  }

  private loadSkill(id: string, filePath: string) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      let name = id
      let description = ''
      let content = raw

      if (raw.startsWith('---')) {
        const parts = raw.split('---')
        if (parts.length >= 3) {
          const frontmatter = YAML.parse(parts[1])
          if (frontmatter) {
            name = frontmatter.name || id
            description = frontmatter.description || ''
          }
          content = parts.slice(2).join('---').trim()
        }
      }

      this.skills.set(id, {
        id,
        name,
        description,
        filePath,
        content
      })
    } catch (e) {
      console.warn(`[Skills] Failed to parse skill ${id}:`, e)
    }
  }

  public listSkills(): SkillItem[] {
    return Array.from(this.skills.values())
  }

  public getSkill(id: string): SkillItem | undefined {
    return this.skills.get(id)
  }
}

export function apply(ctx: Context) {
  const service = new SkillsService(ctx)
  ctx.set('skills', service)

  ctx.tools.register(
    defineTool({
      name: 'skill',
      description: 'Uzmanlık becerilerini (.agents/skills/ altındaki SKILL.md dosyaları) listeler ve yükler.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'read'],
            description: "'list' mevcut becerileri listeler, 'read' seçilen becerinin talimatlarını okur."
          },
          skillName: {
            type: 'string',
            description: "Okunacak becerinin adı (action='read' olduğunda zorunludur)."
          }
        },
        required: ['action']
      },
      execute: async (
        { action, skillName }: { action: 'list' | 'read'; skillName?: string },
        context?: { cwd?: string }
      ) => {
        service.discover(context?.cwd)
        if (action === 'list') {
          const list = service.listSkills()
          if (list.length === 0) return 'Henüz tanımlı bir beceri bulunamadı.'
          return list.map(s => `- **${s.name}**: ${s.description}`).join('\n')
        }

        if (action === 'read' && skillName) {
          const skill = service.getSkill(skillName) || service.listSkills().find(s => s.name === skillName)
          if (!skill) return `Beceri bulunamadı: ${skillName}`
          return `### Beceri Talimatları (${skill.name}):\n\n${skill.content}`
        }

        return 'Geçersiz parametre.'
      }
    })
  )
}
