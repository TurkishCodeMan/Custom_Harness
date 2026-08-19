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
const USER_PRESETS_DIR = path.join(os.homedir(), '.dsh', 'agent-presets')

export class AgentPresetsService extends Service {
  declare ctx: Context
  private presetsCache: Map<string, AgentPreset> = new Map()

  constructor(ctx: Context) {
    super(ctx, 'agentPresets')
    this.discover()
  }

  /**
   * Discovers all presets dynamically from the packages/preset/agent-presets/presets
   * directory and the user-level ~/.dsh/agent-presets directory.
   */
  public discover(): AgentPreset[] {
    this.presetsCache.clear()

    // 1. Discover Shipped Built-in Presets
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
              this.presetsCache.set(content.id, content)
            }
          }
        }
      } catch (err) {
        console.warn('[AgentPresets] Error scanning shipped presets:', err)
      }
    }

    // 2. Discover User Presets in ~/.dsh/agent-presets
    if (!fs.existsSync(USER_PRESETS_DIR)) {
      try {
        fs.mkdirSync(USER_PRESETS_DIR, { recursive: true })
      } catch {}
    } else {
      try {
        const userFiles = fs.readdirSync(USER_PRESETS_DIR)
        for (const file of userFiles) {
          if (file.endsWith('.json')) {
            const filePath = path.join(USER_PRESETS_DIR, file)
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AgentPreset
            if (content && content.id) {
              this.presetsCache.set(content.id, content)
            }
          }
        }
      } catch (err) {
        console.warn('[AgentPresets] Error scanning user presets:', err)
      }
    }

    return Array.from(this.presetsCache.values())
  }

  public list(): AgentPreset[] {
    return this.discover()
  }

  public get(id: string): AgentPreset | undefined {
    if (this.presetsCache.size === 0) this.discover()
    return this.presetsCache.get(id)
  }

  public getActive(): AgentPreset {
    const settings = this.ctx.settings?.getSettings()
    const defaultId = settings?.defaultPreset || 'full-stack'
    const preset = this.get(defaultId)
    if (preset) return preset

    const all = this.list()
    return all[0] || {
      id: 'full-stack',
      name: 'Full-Stack Developer',
      icon: '🚀',
      description: 'Tam yetkili kıdemli yazılım mühendisi.',
      systemPrompt: 'You are an elite full-stack developer.'
    }
  }

  public save(preset: AgentPreset): AgentPreset {
    if (!preset.id || !preset.name) {
      throw new Error('Preset id and name are required')
    }

    if (!fs.existsSync(USER_PRESETS_DIR)) {
      fs.mkdirSync(USER_PRESETS_DIR, { recursive: true })
    }

    const filePath = path.join(USER_PRESETS_DIR, `${preset.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(preset, null, 2), 'utf8')
    this.presetsCache.set(preset.id, preset)

    return preset
  }

  public delete(id: string): { success: boolean; reset?: boolean } {
    // If it exists in user presets dir, delete file
    const userFilePath = path.join(USER_PRESETS_DIR, `${id}.json`)
    let fileDeleted = false
    if (fs.existsSync(userFilePath)) {
      fs.unlinkSync(userFilePath)
      fileDeleted = true
    }

    this.discover()

    // If it was a shipped preset overridden in user dir, discover restored original
    const isStillPresent = this.presetsCache.has(id)
    return {
      success: true,
      reset: isStillPresent && fileDeleted
    }
  }

  public select(id: string): AgentPreset {
    const preset = this.get(id)
    if (!preset) {
      throw new Error(`Preset "${id}" not found`)
    }
    if (this.ctx.settings?.setDefaultPreset) {
      this.ctx.settings.setDefaultPreset(id)
    }
    return preset
  }
}

export function apply(ctx: Context) {
  ctx.set('agentPresets', new AgentPresetsService(ctx))
}
