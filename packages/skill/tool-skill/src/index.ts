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

  public getHarnessRoot(): string {
    let cur = path.resolve(__dirname)
    while (cur && cur !== path.dirname(cur)) {
      if (fs.existsSync(path.join(cur, 'package.json')) && fs.existsSync(path.join(cur, 'packages'))) {
        return cur
      }
      cur = path.dirname(cur)
    }
    return process.env.WORKSPACE_DIR || process.cwd()
  }

  public discover(targetDir?: string) {
    this.skills.clear()

    const harnessRoot = this.getHarnessRoot()
    const searchDirs: string[] = []

    const addCandidate = (p: string) => {
      if (p && !searchDirs.includes(p) && fs.existsSync(p)) {
        searchDirs.push(p)
      }
    }

    // Yalnızca custom-harness proje ana dizinindeki .agents/skills ve skills klasörleri
    addCandidate(path.join(harnessRoot, '.agents', 'skills'))
    addCandidate(path.join(harnessRoot, 'skills'))

    for (const baseDir of searchDirs) {
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

      const trimmed = raw.trim()
      if (trimmed.startsWith('---')) {
        const parts = trimmed.split('---')
        if (parts.length >= 3) {
          try {
            const frontmatter = YAML.parse(parts[1])
            if (frontmatter && typeof frontmatter === 'object') {
              name = frontmatter.name || id
              description = frontmatter.description || ''
            }
          } catch {}
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

  public getSkillRaw(id: string): { raw: string; filePath: string } | undefined {
    const skill = this.skills.get(id)
    if (!skill || !skill.filePath || !fs.existsSync(skill.filePath)) return undefined
    return {
      raw: fs.readFileSync(skill.filePath, 'utf8'),
      filePath: skill.filePath
    }
  }

  public getDefaultTemplate(name = 'yeni-beceri', description = 'Bu becerinin ne yaptığı ve ne zaman kullanılacağı'): string {
    return `---
name: ${name}
description: ${description}
version: 1.0.0
---

# ${name.toUpperCase()} Uzmanlık Becerisi

Bu beceri aktif edildiğinde aşağıdaki adımları ve kuralları izleyin:

## 1. Amaç & Kapsam
${description}

## 2. Talimatlar ve İş Akışı
1. Kullanıcıdan gelen isteği ve ilgili dosyaları analiz et.
2. İşlemi en iyi standartlara uygun olarak tamamla.
3. Çıktıyı açık ve anlaşılır şekilde kullanıcıya sun.
`
  }

  public createSkill(params: {
    id: string
    name: string
    description: string
    content?: string
    rawContent?: string
    isGlobal?: boolean
    workspaceDir?: string
  }): SkillItem {
    const skillId = params.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    if (!skillId) throw new Error('Geçerli bir beceri ID/adı belirtilmelidir.')

    const harnessRoot = this.getHarnessRoot()
    const baseDir = path.join(harnessRoot, '.agents', 'skills')

    const skillDir = path.join(baseDir, skillId)
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true })
    }

    const filePath = path.join(skillDir, 'SKILL.md')
    const finalContent = params.rawContent || `---
name: ${params.name || skillId}
description: ${params.description || ''}
version: 1.0.0
---

${params.content || this.getDefaultTemplate(params.name || skillId, params.description)}`

    fs.writeFileSync(filePath, finalContent, 'utf8')
    this.discover()

    const created = this.getSkill(skillId)
    if (!created) {
      throw new Error(`Beceri oluşturuldu ancak yüklenemedi: ${skillId}`)
    }
    return created
  }

  public updateSkill(id: string, params: {
    name?: string
    description?: string
    content?: string
    rawContent?: string
    workspaceDir?: string
  }): SkillItem {
    this.discover()
    let skill = this.skills.get(id) || Array.from(this.skills.values()).find(s => s.name === id || s.id === id)
    if (!skill || !skill.filePath) {
      const candidate = path.join(this.getHarnessRoot(), '.agents', 'skills', id, 'SKILL.md')
      if (fs.existsSync(candidate)) {
        this.loadSkill(id, candidate)
        skill = this.skills.get(id)
      }
    }
    if (!skill || !skill.filePath) {
      throw new Error(`Güncellenecek beceri bulunamadı: ${id}`)
    }

    let finalContent = ''
    if (params.rawContent) {
      finalContent = params.rawContent
    } else {
      const name = params.name || skill.name || id
      const description = params.description !== undefined ? params.description : (skill.description || '')
      const body = params.content !== undefined ? params.content : skill.content
      finalContent = `---
name: ${name}
description: ${description}
---

${body}`
    }

    fs.writeFileSync(skill.filePath, finalContent, 'utf8')
    this.discover()

    return this.getSkill(id) || skill
  }

  public deleteSkill(id: string, workspaceDir?: string): boolean {
    this.discover()
    let skill = this.skills.get(id) || Array.from(this.skills.values()).find(s => s.name === id || s.id === id)
    if (!skill || !skill.filePath) {
      const candidate = path.join(this.getHarnessRoot(), '.agents', 'skills', id, 'SKILL.md')
      if (fs.existsSync(candidate)) {
        this.loadSkill(id, candidate)
        skill = this.skills.get(id)
      }
    }
    if (!skill || !skill.filePath) {
      throw new Error(`Silinecek beceri bulunamadı: ${id}`)
    }

    const skillDir = path.dirname(skill.filePath)
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true })
    }

    this.skills.delete(id)
    this.discover()
    return true
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
