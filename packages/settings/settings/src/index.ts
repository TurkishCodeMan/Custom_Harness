import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { SettingsDoc, ProviderConfig, ModelConfig, PluginConfig, AgentPreset } from '@custom-harness/core-types'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import YAML from 'yaml'

const DSH_DIR = path.join(os.homedir(), '.dsh')
const SETTINGS_FILE = path.join(DSH_DIR, 'settings.yaml')

export const DEFAULT_PRESETS: Record<string, AgentPreset> = {
  'full-stack': {
    id: 'full-stack',
    name: 'Full-Stack Developer',
    description: 'Tam yetkili kıdemli yazılım mühendisi. Projeleri baştan sona analiz eder, geliştirir ve test eder.',
    icon: '🚀',
    systemPrompt: 'You are an elite full-stack software engineer with deep expertise in architecture, testing, and modern frameworks.'
  },
  'fast-coder': {
    id: 'fast-coder',
    name: 'Quick Script Runner',
    description: 'Hızlı prototipleme ve betik odaklı ajan. Kısa, öz ve pratik çözümler üretir.',
    icon: '⚡',
    systemPrompt: 'You are a fast, pragmatic developer focused on quick scripts, direct command execution, and rapid problem-solving.'
  },
  'code-reviewer': {
    id: 'code-reviewer',
    name: 'Architect & Reviewer',
    description: 'Kod inceleme, güvenlik ve mimari analiz profili. Temiz kod ve en iyi pratikleri gözetir.',
    icon: '🔍',
    systemPrompt: 'You are a principal software architect. Review code meticulously for performance, security, maintainability, and clean architecture.'
  }
}

const DEFAULT_SETTINGS: SettingsDoc = {
  defaultProvider: 'gemma-local',
  defaultModel: 'gemma-4-abliterated',
  defaultPreset: 'full-stack',
  workspace: process.cwd(),
  providers: {
    'gemma-local': {
      id: 'gemma-local',
      name: 'Local Gemma 4 26B (vLLM / llama.cpp)',
      api: 'openai-completions',
      baseURL: 'http://localhost:8888/v1',
      models: [
        {
          id: 'gemma-4-abliterated',
          name: 'Gemma 4 Abliterated (26B)',
          contextWindow: 24576,
          maxTokens: 8192,
          reasoningFormat: 'deepseek'
        }
      ]
    },
    'qwen-local': {
      id: 'qwen-local',
      name: 'Local Qwen 3.8 27B (vLLM)',
      api: 'openai-completions',
      baseURL: 'http://localhost:7272/v1',
      models: [
        {
          id: '/gpfs/scratch/ehpc540/models/Qwen3.8-27B',
          name: 'Qwen 3.8 (27B)',
          contextWindow: 32768,
          maxTokens: 8192,
          reasoningFormat: 'deepseek'
        }
      ]
    },
    'deepseek': {
      id: 'deepseek',
      name: 'DeepSeek Official API',
      api: 'openai-completions',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      models: [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek V3 (Chat)',
          contextWindow: 64000,
          maxTokens: 8192
        },
        {
          id: 'deepseek-reasoner',
          name: 'DeepSeek R1 (Reasoner)',
          contextWindow: 64000,
          maxTokens: 8192,
          reasoningFormat: 'deepseek'
        }
      ]
    }
  },
  plugins: {},
  presets: DEFAULT_PRESETS
}

export const name = 'settings'

export class SettingsService extends Service {
  declare ctx: Context
  private doc: SettingsDoc

  constructor(ctx: Context) {
    super(ctx, 'settings')
    this.doc = this.load()
    // Discover live packages dynamically on startup
    this.discoverPlugins()
  }

  /**
   * Dynamically scans packages directory and registers all workspace plugins
   */
  public discoverPlugins(): Record<string, PluginConfig> {
    const discovered: Record<string, PluginConfig> = {}

    // Find packages root directory
    const possiblePackagesDirs = [
      path.resolve(process.cwd(), 'packages'),
      path.resolve(process.cwd(), '../../packages'),
      path.resolve(process.cwd(), '../packages'),
      '/home/huseyina/code_mode/custom-harness/packages'
    ]

    const packagesRoot = possiblePackagesDirs.find(d => fs.existsSync(d))
    if (packagesRoot) {
      try {
        const groups = fs.readdirSync(packagesRoot, { withFileTypes: true })
        for (const group of groups) {
          if (!group.isDirectory()) continue
          const groupPath = path.join(packagesRoot, group.name)
          const pkgs = fs.readdirSync(groupPath, { withFileTypes: true })

          for (const pkg of pkgs) {
            if (!pkg.isDirectory()) continue
            const pkgPath = path.join(groupPath, pkg.name)
            const pkgJsonPath = path.join(pkgPath, 'package.json')

            if (fs.existsSync(pkgJsonPath)) {
              try {
                const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
                const id = pkg.name // e.g. 'tool-bash', 'tool-skill', 'token-meter'
                const moduleName = pkgJson.name || `@custom-harness/${pkg.name}`
                
                // Categorize
                let category: PluginConfig['category'] = 'core'
                if (group.name === 'shell' || group.name === 'skill' || id.startsWith('tool-')) {
                  category = 'tool'
                } else if (group.name === 'llm' || id.includes('token') || id.includes('llm')) {
                  category = 'llm'
                } else if (group.name === 'client') {
                  category = 'extension'
                }

                // Descriptions mapping fallback if not in package.json
                let description = pkgJson.description || ''
                if (!description) {
                  if (id === 'tool-bash') description = 'Ajanın çalışma alanında güvenli bash komutları ve terminal işlemleri yürütmesini sağlar.'
                  else if (id === 'tool-skill') description = '.agents/skills/ altındaki özel becerileri ve talimatları dinamik olarak modele yükler.'
                  else if (id === 'token-meter') description = 'Sistem istemleri, araçlar ve geçmişin kapladığı bütçeyi ve anlık context doluluğunu ölçer.'
                  else if (id === 'core-agent') description = 'Otonom döngü ve çok turlu akıl yürütme motoru.'
                  else if (id === 'core-tools') description = 'Fonksiyon ve araç kayıt ve yürütme merkezi.'
                  else if (id === 'session') description = 'Sohbet geçmişi ve durum kalıcılığı servisi.'
                  else description = `${moduleName} eklenti paketi.`
                }

                // Check saved enabled state from settings.yaml
                const savedState = this.doc.plugins?.[id]?.enabled
                const isEnabled = savedState !== undefined ? savedState : true

                discovered[id] = {
                  id,
                  name: this.formatPluginTitle(id, pkgJson.name),
                  module: moduleName,
                  description,
                  enabled: isEnabled,
                  category,
                  version: pkgJson.version || '0.1.0'
                }
              } catch (err) {
                console.warn(`[Settings] Failed to parse package.json for ${pkgPath}:`, err)
              }
            }
          }
        }
      } catch (err) {
        console.error('[Settings] Error discovering packages:', err)
      }
    }

    // Merge discovered plugins with existing doc
    this.doc.plugins = {
      ...discovered,
      ...(this.doc.plugins || {})
    }

    // Ensure all discovered entries exist
    for (const [k, v] of Object.entries(discovered)) {
      if (this.doc.plugins[k]) {
        this.doc.plugins[k] = { ...v, enabled: this.doc.plugins[k].enabled }
      } else {
        this.doc.plugins[k] = v
      }
    }

    return this.doc.plugins
  }

  private formatPluginTitle(id: string, moduleName?: string): string {
    if (id === 'fs') return 'Filesystem Seam (ctx.fs)'
    if (id === 'fs-local') return 'Local Filesystem Provider'
    if (id === 'subprocess') return 'Process Execution Seam (ctx.subprocess)'
    if (id === 'subprocess-local') return 'Local Subprocess Provider'
    if (id === 'spill' || id === 'spillStore') return 'Output Spill Store (ctx.spillStore)'
    if (id === 'spill-local') return 'Local Spill Provider'
    if (id === 'user-approval' || id === 'approval') return 'User Approval Seam (ctx.approval)'
    if (id === 'bundle-base') return 'Core Base Bundle'
    if (id === 'bundle-web-app') return 'Web Application Bundle'
    if (id === 'bundle-headless') return 'Headless CLI Bundle'
    if (id === 'tool-bash') return 'Bash Shell & Terminal'
    if (id === 'tool-bash-persistent') return 'Persistent Stateful Terminal'
    if (id === 'tool-fs') return 'Filesystem & String Editor'
    if (id === 'tool-todo') return 'Task Checklist & Todo Planner'
    if (id === 'tool-skill') return 'Skills & Workflows'
    if (id === 'token-meter') return 'Token & Context Meter'
    if (id === 'agent-presets' || id === 'preset-agent-presets') return 'Agent Presets Manager'
    if (id === 'persona' || id === 'preset-persona') return 'Agent Persona & Prompts'
    if (id === 'core-system-prompt' || id === 'system-prompt') return 'System Prompt Layers'
    if (id === 'guard-repeat-tool-reminder' || id === 'repeat-tool-reminder') return 'Repeat Tool Loop Guard'
    if (id === 'compaction-tool-result-pruner' || id === 'tool-result-pruner') return 'Tool Result Pruner'
    if (id === 'compaction-basic' || id === 'compactor') return 'History Compactor'
    if (id === 'core-agent' || id === 'agent') return 'Agent Reasoning Engine'
    if (id === 'core-tools' || id === 'tools') return 'Tools Registry Service'
    if (id === 'session') return 'Session Management'
    if (id === 'settings') return 'Configuration Plane'
    if (id === 'server') return 'Web & WebSocket Server'
    if (id === 'user-questions') return 'User Questions Seam'
    if (id === 'tool-ask-user') return 'Ask User Question Tool'
    if (id === 'lsp') return 'LSP Language Server Seam'
    if (id === 'tool-lsp') return 'LSP Code Intelligence Tool'
    if (id === 'plan-mode') return 'Implementation Plan Mode'
    if (id === 'subagent') return 'Subagent Orchestration'
    if (id === 'tool-subagent') return 'Subagent Delegation Tool'
    if (id === 'mcp-client') return 'Model Context Protocol (MCP) Client'
    if (id === 'tool-goal') return 'Autonomous Goal Driver'
    if (id === 'tool-session-query') return 'Session History Query'
    if (id === 'tool-fs-search') return 'Fast Workspace Search'
    return id.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
  }

  private load(): SettingsDoc {
    try {
      if (!fs.existsSync(DSH_DIR)) {
        fs.mkdirSync(DSH_DIR, { recursive: true })
      }
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8')
        const parsed = YAML.parse(raw)
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            providers: { ...DEFAULT_SETTINGS.providers, ...(parsed.providers || {}) },
            plugins: { ...(parsed.plugins || {}) },
            presets: { ...DEFAULT_PRESETS, ...(parsed.presets || {}) }
          }
        }
      }
    } catch (e) {
      console.warn('[Settings] Failed to read settings file, using defaults:', e)
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  }

  public getSettings(): SettingsDoc {
    return this.doc
  }

  public getActiveProvider(): ProviderConfig | undefined {
    return this.doc.providers[this.doc.defaultProvider]
  }

  public getActiveModel(): ModelConfig | undefined {
    const provider = this.getActiveProvider()
    return provider?.models.find(m => m.id === this.doc.defaultModel) || provider?.models[0]
  }

  public getActivePreset(): AgentPreset {
    if (this.ctx?.agentPresets) {
      return this.ctx.agentPresets.getActive()
    }
    const key = this.doc.defaultPreset || 'full-stack'
    return {
      id: key,
      name: key,
      description: '',
      icon: '🚀'
    }
  }

  public setDefaultPreset(presetId: string): void {
    this.doc.defaultPreset = presetId
    this.save()
  }

  // --- Dynamic Plugins Management ---
  public getPlugins(): PluginConfig[] {
    this.discoverPlugins()
    return Object.values(this.doc.plugins || {})
  }

  public getPlugin(id: string): PluginConfig | undefined {
    return this.doc.plugins?.[id]
  }

  public togglePlugin(id: string, enabled: boolean): PluginConfig {
    this.discoverPlugins()
    if (this.doc.plugins && this.doc.plugins[id]) {
      this.doc.plugins[id].enabled = enabled
      this.save()
      console.log(`[Settings] Plugin '${id}' toggled: ${enabled ? 'ENABLED' : 'DISABLED'}`)
      return this.doc.plugins[id]
    }
    throw new Error(`Eklenti bulunamadı: ${id}`)
  }

  public updatePluginConfig(id: string, config: Record<string, any>): PluginConfig {
    this.discoverPlugins()
    if (this.doc.plugins && this.doc.plugins[id]) {
      this.doc.plugins[id].config = { ...(this.doc.plugins[id].config || {}), ...config }
      this.save()
      return this.doc.plugins[id]
    }
    throw new Error(`Eklenti bulunamadı: ${id}`)
  }

  /**
   * Live check whether a specific tool is enabled by its owning plugin AND active agent preset
   */
  public isToolEnabled(toolName: string): boolean {
    const plugins = this.doc.plugins || {}
    
    // Map tool names to plugin IDs
    if (toolName === 'bash') {
      const plugin = plugins['tool-bash']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'persistent_bash') {
      const plugin = plugins['tool-bash-persistent']
      if (plugin && plugin.enabled === false) return false
    } else if (['read_file', 'write_file', 'list_dir', 'str_replace_editor'].includes(toolName)) {
      const plugin = plugins['tool-fs']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'manage_todo') {
      const plugin = plugins['tool-todo']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'skill') {
      const plugin = plugins['tool-skill']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'ask_user_question') {
      const plugin = plugins['tool-ask-user']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'lsp') {
      const plugin = plugins['tool-lsp']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'exit_plan_mode') {
      const plugin = plugins['plan-mode']
      if (plugin && plugin.enabled === false) return false
    } else if (['invoke_subagent', 'check_subagent'].includes(toolName)) {
      const plugin = plugins['tool-subagent']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'mcp') {
      const plugin = plugins['mcp-client']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'manage_goal') {
      const plugin = plugins['tool-goal']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'query_session_history') {
      const plugin = plugins['tool-session-query']
      if (plugin && plugin.enabled === false) return false
    } else if (toolName === 'search_files') {
      const plugin = plugins['tool-fs-search']
      if (plugin && plugin.enabled === false) return false
    }

    return true
  }

  // --- Agent Presets Management (Delegates to @custom-harness/preset-agent-presets) ---
  public getPresets(): AgentPreset[] {
    if (this.ctx?.agentPresets) {
      return this.ctx.agentPresets.list()
    }
    return Object.values(DEFAULT_PRESETS)
  }

  public getPreset(id: string): AgentPreset | undefined {
    if (this.ctx?.agentPresets) {
      return this.ctx.agentPresets.get(id)
    }
    return DEFAULT_PRESETS[id]
  }

  public savePreset(preset: AgentPreset): AgentPreset {
    if (this.ctx?.agentPresets) {
      return this.ctx.agentPresets.save(preset)
    }
    return preset
  }

  public deletePreset(id: string): { success: boolean; reset?: boolean } {
    if (this.ctx?.agentPresets) {
      return this.ctx.agentPresets.delete(id)
    }
    return { success: false }
  }

  public updateSettings(partial: Partial<SettingsDoc>): SettingsDoc {
    this.doc = {
      ...this.doc,
      ...partial,
      providers: { ...this.doc.providers, ...(partial.providers || {}) },
      plugins: { ...(this.doc.plugins || {}), ...(partial.plugins || {}) }
    }
    if (partial.defaultPreset) {
      this.doc.defaultPreset = partial.defaultPreset
      if (this.ctx?.agentPresets) {
        try {
          this.ctx.agentPresets.select(partial.defaultPreset)
        } catch {}
      }
    }
    this.save()
    return this.doc
  }

  public getWorkspace(): string {
    return this.doc.workspace || process.cwd()
  }

  public setWorkspace(workspacePath: string) {
    if (fs.existsSync(workspacePath)) {
      this.doc.workspace = path.resolve(workspacePath)
      this.save()
    }
  }

  public async discoverModels(baseURL: string, apiKey?: string): Promise<ModelConfig[]> {
    const cleanUrl = baseURL.replace(/\/+$/, '')
    const url = cleanUrl.endsWith('/models') ? cleanUrl : `${cleanUrl}/models`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    const data = await res.json() as { data?: { id: string; object?: string }[] }
    if (!data.data || !Array.isArray(data.data)) {
      return []
    }

    return data.data.map((m: { id: string }) => ({
      id: m.id,
      name: m.id,
      contextWindow: 24576,
      maxTokens: 8192
    }))
  }

  private save() {
    try {
      if (!fs.existsSync(DSH_DIR)) {
        fs.mkdirSync(DSH_DIR, { recursive: true })
      }
      fs.writeFileSync(SETTINGS_FILE, YAML.stringify(this.doc), 'utf8')
    } catch (e) {
      console.error('[Settings] Failed to write settings file:', e)
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('settings', new SettingsService(ctx))
}
