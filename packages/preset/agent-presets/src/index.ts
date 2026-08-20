import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { AgentPreset } from '@custom-harness/core-types'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

export const name = 'agentPresets'
export const inject = ['settings']

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))
const GLOBAL_PRESETS_DIR = path.join(os.homedir(), '.dsh', 'agent-presets')

export class AgentPresetsService extends Service {
  declare ctx: Context
  private presetsCache: Map<string, AgentPreset> = new Map()

  constructor(ctx: Context) {
    super(ctx, 'agentPresets')
    this.discover()
  }

  private getTenantPresetsDir(userId: string): string {
    return path.join(os.homedir(), '.dsh', 'tenants', userId, 'presets')
  }

  /**
   * Discovers all presets dynamically:
   * 1. Shipped built-in presets (packages/preset/agent-presets/presets)
   * 2. Global presets (~/.dsh/agent-presets)
   * 3. Tenant-isolated presets (~/.dsh/tenants/<userId>/presets)
   */
  public discover(userId?: string, isAdmin = false): AgentPreset[] {
    const list: Map<string, AgentPreset> = new Map()

    // 1. Shipped Built-in Presets
    const possibleShippedDirs = [
      path.resolve(CURRENT_DIR, '../presets'),
      path.resolve(CURRENT_DIR, '../../presets'),
      path.resolve(process.cwd(), 'packages/preset/agent-presets/presets'),
      path.resolve(process.cwd(), '../../packages/preset/agent-presets/presets'),
      '/home/huseyina/code_mode/custom-harness/packages/preset/agent-presets/presets'
    ]

    const shippedDir = possibleShippedDirs.find(d => fs.existsSync(d))
    if (shippedDir) {
      try {
        const files = fs.readdirSync(shippedDir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(shippedDir, file)
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AgentPreset
            if (content && content.id) {
              list.set(content.id, { ...content, isGlobal: true })
            }
          }
        }
      } catch (err) {
        console.warn('[AgentPresets] Error scanning shipped presets:', err)
      }
    }

    // 2. Global Presets in ~/.dsh/agent-presets
    if (!fs.existsSync(GLOBAL_PRESETS_DIR)) {
      try {
        fs.mkdirSync(GLOBAL_PRESETS_DIR, { recursive: true })
      } catch {}
    } else {
      try {
        const globalFiles = fs.readdirSync(GLOBAL_PRESETS_DIR)
        for (const file of globalFiles) {
          if (file.endsWith('.json')) {
            const filePath = path.join(GLOBAL_PRESETS_DIR, file)
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AgentPreset
            if (content && content.id) {
              list.set(content.id, { ...content, isGlobal: true })
            }
          }
        }
      } catch (err) {
        console.warn('[AgentPresets] Error scanning global presets:', err)
      }
    }

    // 3. Scan all tenant presets across ~/.dsh/tenants/*/presets
    const tenantsRoot = path.join(os.homedir(), '.dsh', 'tenants')
    if (fs.existsSync(tenantsRoot)) {
      try {
        const tenantFolders = fs.readdirSync(tenantsRoot)
        for (const t of tenantFolders) {
          if (userId && t === userId) continue
          const tDir = path.join(tenantsRoot, t, 'presets')
          if (fs.existsSync(tDir)) {
            const files = fs.readdirSync(tDir)
            for (const file of files) {
              if (file.endsWith('.json')) {
                try {
                  const filePath = path.join(tDir, file)
                  const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AgentPreset
                  if (content && content.id && !list.has(content.id)) {
                    list.set(content.id, { ...content, ownerId: t, isGlobal: false })
                  }
                } catch {}
              }
            }
          }
        }
      } catch {}
    }

    // 4. Load specific tenant's presets with highest precedence
    if (userId) {
      const tenantDir = this.getTenantPresetsDir(userId)
      if (fs.existsSync(tenantDir)) {
        try {
          const tenantFiles = fs.readdirSync(tenantDir)
          for (const file of tenantFiles) {
            if (file.endsWith('.json')) {
              try {
                const filePath = path.join(tenantDir, file)
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AgentPreset
                if (content && content.id) {
                  list.set(content.id, { ...content, ownerId: userId, isGlobal: false })
                }
              } catch {}
            }
          }
        } catch (err) {
          console.warn(`[AgentPresets] Error scanning tenant presets for ${userId}:`, err)
        }
      }
    }

    this.presetsCache = list
    return Array.from(list.values())
  }

  public list(userId?: string, isAdmin = false): AgentPreset[] {
    return this.discover(userId, isAdmin)
  }

  public get(idOrName: string, userId?: string, isAdmin = false): AgentPreset | undefined {
    const all = this.discover(userId, isAdmin)
    return all.find(p =>
      p.id === idOrName ||
      p.name === idOrName ||
      p.id?.toLowerCase() === idOrName?.toLowerCase() ||
      p.name?.toLowerCase() === idOrName?.toLowerCase()
    )
  }

  public getActive(userId?: string): AgentPreset {
    let defaultId = 'full-stack'
    if (userId && this.ctx.settings?.getSettingsForUser) {
      const userSettings = this.ctx.settings.getSettingsForUser(userId)
      defaultId = userSettings?.defaultPreset || 'full-stack'
    } else if (this.ctx.settings?.getSettings) {
      const settings = this.ctx.settings.getSettings()
      defaultId = settings?.defaultPreset || 'full-stack'
    }

    const preset = this.get(defaultId, userId)
    if (preset) return preset

    const all = this.list(userId)
    return all[0] || {
      id: 'full-stack',
      name: 'Full-Stack Developer',
      icon: '🚀',
      description: 'Tam yetkili kıdemli yazılım mühendisi.',
      systemPrompt: 'You are an elite full-stack software engineer with deep expertise in modern web, backend, and system architecture. When given a technical task, use tools proactively. For general questions, explanations, or greetings, respond helpfully and clearly.'
    }
  }

  public save(preset: AgentPreset, userId?: string, isAdmin = false): AgentPreset {
    if (!preset.id || !preset.name) {
      throw new Error('Preset id and name are required')
    }

    const isGlobal = Boolean(isAdmin && preset.isGlobal)
    const targetDir = isGlobal
      ? GLOBAL_PRESETS_DIR
      : this.getTenantPresetsDir(userId || 'user_admin')

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const savedPreset: AgentPreset = {
      ...preset,
      ownerId: isGlobal ? undefined : (userId || 'user_admin'),
      isGlobal
    }

    const filePath = path.join(targetDir, `${preset.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(savedPreset, null, 2), 'utf8')
    this.presetsCache.set(preset.id, savedPreset)

    return savedPreset
  }

  public delete(id: string, userId?: string, isAdmin = false): { success: boolean; reset?: boolean } {
    let deleted = false

    // Check user tenant dir
    if (userId) {
      const userFile = path.join(this.getTenantPresetsDir(userId), `${id}.json`)
      if (fs.existsSync(userFile)) {
        fs.unlinkSync(userFile)
        deleted = true
      }
    }

    // If admin or not found in tenant dir, check global dir
    if (isAdmin || !deleted) {
      const globalFile = path.join(GLOBAL_PRESETS_DIR, `${id}.json`)
      if (fs.existsSync(globalFile)) {
        if (isAdmin) {
          fs.unlinkSync(globalFile)
          deleted = true
        } else {
          throw new Error('Sistem genelindeki hazır profilleri yalnızca yönetici silebilir.')
        }
      }
    }

    this.discover(userId, isAdmin)
    const remaining = this.get(id, userId, isAdmin)
    return {
      success: deleted,
      reset: !!remaining
    }
  }

  public select(id: string, userId?: string): AgentPreset {
    const preset = this.get(id, userId)
    if (!preset) {
      throw new Error(`Preset "${id}" bulunamadı`)
    }
    if (userId && this.ctx.settings?.updateSettingsForUser) {
      this.ctx.settings.updateSettingsForUser(userId, { defaultPreset: id }, false)
    } else if (this.ctx.settings?.setDefaultPreset) {
      this.ctx.settings.setDefaultPreset(id)
    }
    return preset
  }
}

export function apply(ctx: Context) {
  ctx.set('agentPresets', new AgentPresetsService(ctx))
}
