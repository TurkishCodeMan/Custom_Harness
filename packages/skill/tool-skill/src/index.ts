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

  public getTenantSkillsDir(userId: string): string {
    const dir = path.join(os.homedir(), '.dsh', 'tenants', userId, 'skills')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  public discover(targetDir?: string, userId?: string, isAdmin = false) {
    this.skills.clear()

    const harnessRoot = this.getHarnessRoot()
    
    // 1. Global / System Skills
    const globalDirs = [
      path.join(harnessRoot, '.agents', 'skills'),
      path.join(harnessRoot, 'skills')
    ]

    for (const baseDir of globalDirs) {
      if (fs.existsSync(baseDir)) {
        try {
          const entries = fs.readdirSync(baseDir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const skillFile = path.join(baseDir, entry.name, 'SKILL.md')
              if (fs.existsSync(skillFile)) {
                this.loadSkill(entry.name, skillFile, 'system', true)
              }
            }
          }
        } catch (e) {
          console.warn('[Skills] Failed to read global skills dir:', baseDir, e)
        }
      }
    }

    // 2. Tenant Specific Skills
    const tenantsBase = path.join(os.homedir(), '.dsh', 'tenants')
    if (fs.existsSync(tenantsBase)) {
      try {
        const tenantFolders = fs.readdirSync(tenantsBase, { withFileTypes: true })
        for (const tf of tenantFolders) {
          if (tf.isDirectory()) {
            const tId = tf.name
            // If not admin and not target user, skip
            if (!isAdmin && userId && tId !== userId) continue

            const tSkillsDir = path.join(tenantsBase, tId, 'skills')
            if (fs.existsSync(tSkillsDir)) {
              const entries = fs.readdirSync(tSkillsDir, { withFileTypes: true })
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const skillFile = path.join(tSkillsDir, entry.name, 'SKILL.md')
                  if (fs.existsSync(skillFile)) {
                    this.loadSkill(entry.name, skillFile, tId, false)
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Skills] Failed to read tenant skills:', e)
      }
    }
  }

  private loadSkill(id: string, filePath: string, defaultOwnerId = 'system', defaultIsGlobal = true) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      let name = id
      let description = ''
      let content = raw
      let ownerId = defaultOwnerId
      let isGlobal = defaultIsGlobal
      let isPublic = true
      let allowedUserIds = ['*']

      let enabled = true

      const trimmed = raw.trim()
      if (trimmed.startsWith('---')) {
        const parts = trimmed.split('---')
        if (parts.length >= 3) {
          try {
            const frontmatter = YAML.parse(parts[1])
            if (frontmatter && typeof frontmatter === 'object') {
              name = frontmatter.name || id
              description = frontmatter.description || ''
              if (frontmatter.owner_id) ownerId = frontmatter.owner_id
              if (frontmatter.allowed_user_ids && Array.isArray(frontmatter.allowed_user_ids)) allowedUserIds = frontmatter.allowed_user_ids
              if (frontmatter.is_public !== undefined) isPublic = Boolean(frontmatter.is_public)
              if (frontmatter.is_global !== undefined) isGlobal = Boolean(frontmatter.is_global)
              if (frontmatter.enabled !== undefined) enabled = Boolean(frontmatter.enabled)
              else if (frontmatter.is_active !== undefined) enabled = Boolean(frontmatter.is_active)
              else if (frontmatter.disabled !== undefined) enabled = !Boolean(frontmatter.disabled)
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
        content,
        ownerId,
        isGlobal,
        isPublic,
        allowedUserIds,
        enabled
      })
    } catch (e) {
      console.warn(`[Skills] Failed to parse skill ${id}:`, e)
    }
  }

  public listSkills(userId?: string, isAdmin = false): SkillItem[] {
    this.discover(undefined, userId, isAdmin)
    const all = Array.from(this.skills.values())
    if (isAdmin || !userId) return all
    return all.filter(s => {
      if (s.isGlobal) return true
      if (s.ownerId === userId) return true
      if (s.isPublic) return true
      if (s.allowedUserIds?.includes(userId) || s.allowedUserIds?.includes('*')) return true
      return false
    })
  }

  public listActiveSkills(userId?: string, isAdmin = false): SkillItem[] {
    const list = this.listSkills(userId, isAdmin)
    return list.filter(s => s.enabled !== false)
  }

  public toggleSkill(id: string, enabled: boolean, userId?: string, isAdmin = false): SkillItem {
    this.discover(undefined, userId, isAdmin)
    let skill = this.skills.get(id) || Array.from(this.skills.values()).find(s => s.name === id || s.id === id)
    if (!skill || !skill.filePath) {
      throw new Error(`Durumu değiştirilecek beceri bulunamadı: ${id}`)
    }

    if (!isAdmin && skill.ownerId && skill.ownerId !== 'system' && skill.ownerId !== userId) {
      throw new Error('Bu beceriyi açıp/kapatma yetkiniz bulunmuyor.')
    }

    if (skill.isGlobal && !isAdmin) {
      throw new Error('Global sistem becerilerini yalnızca yönetici açıp/kapatabilir.')
    }

    const raw = fs.readFileSync(skill.filePath, 'utf8')
    let body = skill.content || ''
    let frontmatter: any = {
      name: skill.name || id,
      description: skill.description || '',
      version: '1.0.0',
      owner_id: skill.ownerId || userId,
      allowed_user_ids: skill.allowedUserIds || ['*'],
      is_public: skill.isPublic !== false,
      is_global: Boolean(skill.isGlobal),
      enabled: enabled
    }

    const trimmed = raw.trim()
    if (trimmed.startsWith('---')) {
      const parts = trimmed.split('---')
      if (parts.length >= 3) {
        try {
          const parsed = YAML.parse(parts[1])
          if (parsed && typeof parsed === 'object') {
            frontmatter = {
              ...parsed,
              enabled: enabled
            }
          }
        } catch {}
        body = parts.slice(2).join('---').trim()
      }
    }

    const newRaw = `---\n${YAML.stringify(frontmatter).trim()}\n---\n\n${body}\n`
    fs.writeFileSync(skill.filePath, newRaw, 'utf8')
    this.discover(undefined, userId, isAdmin)

    return this.getSkill(id) || skill
  }

  public updateSkillPermissions(
    id: string,
    allowedUserIds: string[],
    isPublic: boolean,
    userId: string,
    isAdmin = false
  ): SkillItem {
    this.discover(undefined, userId, isAdmin)
    let skill = this.skills.get(id) || Array.from(this.skills.values()).find(s => s.name === id || s.id === id)
    if (!skill || !skill.filePath) {
      throw new Error(`İzinleri güncellenecek beceri bulunamadı: ${id}`)
    }

    if (!isAdmin && skill.ownerId && skill.ownerId !== 'system' && skill.ownerId !== userId) {
      throw new Error('Bu becerinin izinlerini yalnızca sahibi veya sistem yöneticisi değiştirebilir.')
    }

    const raw = fs.readFileSync(skill.filePath, 'utf8')
    let body = skill.content || ''
    let frontmatter: any = {
      name: skill.name || id,
      description: skill.description || '',
      version: '1.0.0',
      owner_id: skill.ownerId || userId,
      allowed_user_ids: allowedUserIds,
      is_public: isPublic,
      is_global: skill.isGlobal
    }

    const trimmed = raw.trim()
    if (trimmed.startsWith('---')) {
      const parts = trimmed.split('---')
      if (parts.length >= 3) {
        try {
          const parsed = YAML.parse(parts[1])
          if (parsed && typeof parsed === 'object') {
            frontmatter = {
              ...parsed,
              owner_id: skill.ownerId || userId,
              allowed_user_ids: allowedUserIds,
              is_public: isPublic
            }
          }
        } catch {}
        body = parts.slice(2).join('---').trim()
      }
    }

    const newRaw = `---\n${YAML.stringify(frontmatter).trim()}\n---\n\n${body}\n`
    fs.writeFileSync(skill.filePath, newRaw, 'utf8')
    this.discover(undefined, userId, isAdmin)

    return this.getSkill(id) || skill
  }

  public getSkill(idOrName: string): SkillItem | undefined {
    if (!idOrName) return undefined
    const cleanQuery = idOrName.trim().toLowerCase()
    const slugQuery = cleanQuery.replace(/[^a-z0-9]/g, '')

    // 1. Exact ID or Map key
    if (this.skills.has(idOrName)) return this.skills.get(idOrName)
    if (this.skills.has(cleanQuery)) return this.skills.get(cleanQuery)

    const list = Array.from(this.skills.values())

    // 2. Exact Name Match (case-insensitive)
    const exactName = list.find(s => s.name?.toLowerCase() === cleanQuery || s.id?.toLowerCase() === cleanQuery)
    if (exactName) return exactName

    // 3. Normalized slug comparison (e.g. 'far-trans-demo-db' vs 'Far Trans Demo DB SQL')
    const slugMatch = list.find(s => {
      const sNameSlug = (s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const sIdSlug = (s.id || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      return sNameSlug === slugQuery || sIdSlug === slugQuery || (slugQuery.length > 3 && (sNameSlug.includes(slugQuery) || slugQuery.includes(sNameSlug)))
    })
    if (slugMatch) return slugMatch

    // 4. Substring Match
    const subMatch = list.find(s => 
      (s.name && s.name.toLowerCase().includes(cleanQuery)) || 
      (s.id && s.id.toLowerCase().includes(cleanQuery)) ||
      (cleanQuery.length > 3 && (cleanQuery.includes(s.name?.toLowerCase() || '') || cleanQuery.includes(s.id?.toLowerCase() || '')))
    )
    if (subMatch) return subMatch

    return undefined
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
    userId?: string
    isAdmin?: boolean
    enabled?: boolean
  }): SkillItem {
    let skillName = params.name?.trim() || ''
    let skillDescription = params.description?.trim() || ''

    if (params.rawContent && params.rawContent.startsWith('---')) {
      const matchName = params.rawContent.match(/^name:\s*(.+)$/m)
      if (matchName && matchName[1]) skillName = matchName[1].trim().replace(/^['"]|['"]$/g, '')
      const matchDesc = params.rawContent.match(/^description:\s*(.+)$/m)
      if (matchDesc && matchDesc[1]) skillDescription = matchDesc[1].trim().replace(/^['"]|['"]$/g, '')
    }

    const rawId = (params.id && params.id !== 'yeni-uzmanlik' && params.id !== 'custom-skill') 
      ? params.id 
      : (skillName || params.id || 'custom-skill')

    const skillId = rawId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    if (!skillId) throw new Error('Geçerli bir beceri ID/adı belirtilmelidir.')

    let baseDir: string
    const uid = params.userId || 'user_admin'
    const isGlobal = Boolean(params.isGlobal && params.isAdmin)

    if (isGlobal) {
      baseDir = path.join(this.getHarnessRoot(), '.agents', 'skills')
    } else {
      baseDir = this.getTenantSkillsDir(uid)
    }

    const skillDir = path.join(baseDir, skillId)
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true })
    }

    const filePath = path.join(skillDir, 'SKILL.md')
    const isEnabled = params.enabled !== false
    const finalContent = params.rawContent || `---
name: ${skillName || skillId}
description: ${skillDescription || ''}
version: 1.0.0
enabled: ${isEnabled}
---

${params.content || this.getDefaultTemplate(skillName || skillId, skillDescription)}`

    fs.writeFileSync(filePath, finalContent, 'utf8')
    this.discover(undefined, uid, Boolean(params.isAdmin))

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
    userId?: string
    isAdmin?: boolean
    enabled?: boolean
  }): SkillItem {
    const uid = params.userId || 'user_admin'
    this.discover(undefined, uid, Boolean(params.isAdmin))
    let skill = this.skills.get(id) || Array.from(this.skills.values()).find(s => s.name === id || s.id === id)
    
    if (!skill || !skill.filePath) {
      throw new Error(`Güncellenecek beceri bulunamadı: ${id}`)
    }

    if (!params.isAdmin && skill.ownerId && skill.ownerId !== 'system' && skill.ownerId !== uid) {
      throw new Error('Bu beceriyi düzenleme yetkiniz bulunmuyor.')
    }

    if (skill.isGlobal && !params.isAdmin) {
      throw new Error('Global sistem becerilerini yalnızca yönetici güncelleyebilir.')
    }

    let finalContent = ''
    if (params.rawContent) {
      finalContent = params.rawContent
    } else {
      const name = params.name || skill.name || id
      const description = params.description !== undefined ? params.description : (skill.description || '')
      const body = params.content !== undefined ? params.content : skill.content
      const enabled = params.enabled !== undefined ? params.enabled : (skill.enabled !== false)
      finalContent = `---
name: ${name}
description: ${description}
enabled: ${enabled}
---

${body}`
    }

    fs.writeFileSync(skill.filePath, finalContent, 'utf8')
    this.discover(undefined, uid, Boolean(params.isAdmin))

    return this.getSkill(id) || skill
  }

  public deleteSkill(id: string, userId?: string, isAdmin = false): boolean {
    this.discover(undefined, userId, isAdmin)
    let skill = this.skills.get(id) || Array.from(this.skills.values()).find(s => s.name === id || s.id === id)
    
    if (!skill || !skill.filePath) {
      throw new Error(`Silinecek beceri bulunamadı: ${id}`)
    }

    if (!isAdmin && skill.ownerId && skill.ownerId !== 'system' && skill.ownerId !== userId) {
      throw new Error('Bu beceriyi silme yetkiniz bulunmuyor.')
    }

    if (skill.isGlobal && !isAdmin) {
      throw new Error('Global sistem becerilerini yalnızca yönetici silebilir.')
    }

    const skillDir = path.dirname(skill.filePath)
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true })
    }

    this.skills.delete(id)
    this.discover(undefined, userId, isAdmin)
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
            description: "'list' aktif becerileri listeler, 'read' seçilen becerinin talimatlarını okur."
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
          const activeList = service.listActiveSkills()
          if (activeList.length === 0) return 'Şu anda sistemde etkinleştirilmiş (açık) bir uzmanlık becerisi bulunmuyor.'
          return activeList.map(s => `- **${s.name}**: ${s.description}`).join('\n')
        }

        if (action === 'read' && skillName) {
          const skill = service.getSkill(skillName) || service.listSkills().find(s => s.name === skillName)
          if (!skill) return `Beceri bulunamadı: ${skillName}`
          if (skill.enabled === false) {
            return `[DEVRE DIŞI / OFF]: '${skill.name}' becerisi kullanıcı tarafından devre dışı bırakılmıştır. Bu beceriye ait talimatlar yüklenemez.`
          }
          return `### Beceri Talimatları (${skill.name}):\n\n${skill.content}`
        }

        return 'Geçersiz parametre.'
      }
    })
  )
}
