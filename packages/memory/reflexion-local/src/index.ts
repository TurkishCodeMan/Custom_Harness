import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import {
  ReflexionService,
  type ReflexionEntry,
  type ReflexionQueryOptions
} from '@custom-harness/reflexion'

function getReflectionsFilePath(userId?: string): string {
  const baseDir = process.env.DSH_DIR || path.join(os.homedir(), '.dsh')
  if (userId) {
    return path.join(baseDir, 'tenants', userId, 'reflections.json')
  }
  return path.join(baseDir, 'reflections.json')
}

export class LocalReflexionService extends ReflexionService {
  declare ctx: Context
  private defaultStoragePath: string

  constructor(ctx: Context, customStoragePath?: string) {
    super(ctx)
    this.defaultStoragePath = customStoragePath || getReflectionsFilePath()
    this.ensureStorageDir(this.defaultStoragePath)
    this.registerSystemPromptHook()
    this.registerTool()
  }

  private ensureStorageDir(filePath: string) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch {}
    }
  }

  private loadEntries(userId?: string): ReflexionEntry[] {
    const filePath = getReflectionsFilePath(userId)
    if (!fs.existsSync(filePath)) {
      // If tenant file doesn't exist, start empty (prevent cross-tenant leakage)
      if (userId) return []
      return []
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(raw) as ReflexionEntry[]
    } catch {
      return []
    }
  }

  private saveEntries(entries: ReflexionEntry[], userId?: string) {
    const filePath = getReflectionsFilePath(userId)
    this.ensureStorageDir(filePath)
    try {
      fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf8')
    } catch (err: any) {
      console.warn(`[LocalReflexionService] Failed to persist reflections for user ${userId || 'default'}: ${err.message}`)
    }
  }

  public async recordReflection(
    entry: Omit<ReflexionEntry, 'id' | 'timestamp'>,
    userId?: string
  ): Promise<ReflexionEntry> {
    const effectiveUserId = userId || entry.userId
    const entries = this.loadEntries(effectiveUserId)

    const newEntry: ReflexionEntry = {
      id: `refl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      task: entry.task,
      workspace: entry.workspace,
      presetId: entry.presetId,
      userId: effectiveUserId,
      sessionId: entry.sessionId,
      error: entry.error,
      reflection: entry.reflection,
      tags: entry.tags || []
    }

    entries.unshift(newEntry)
    // Keep maximum 100 most recent reflections per tenant to prevent memory bloating
    if (entries.length > 100) {
      entries.length = 100
    }

    this.saveEntries(entries, effectiveUserId)
    return newEntry
  }

  public async getReflections(
    options: ReflexionQueryOptions = {}
  ): Promise<ReflexionEntry[]> {
    const { query, workspace, userId, limit = 5 } = options
    const entries = this.loadEntries(userId)

    if (!query && !workspace) {
      return entries.slice(0, limit)
    }

    const queryTokens = query ? query.toLowerCase().split(/\s+/).filter(Boolean) : []

    const scored = entries.map((entry) => {
      let score = 0

      // Match workspace
      if (workspace && entry.workspace && entry.workspace === workspace) {
        score += 5
      }

      // Match query tokens
      if (queryTokens.length > 0) {
        const text = `${entry.task} ${entry.reflection} ${(entry.tags || []).join(' ')} ${entry.error || ''}`.toLowerCase()
        for (const token of queryTokens) {
          if (token.length > 2 && text.includes(token)) {
            score += 2
          }
        }
      }

      return { entry, score }
    })

    return scored
      .filter((s) => s.score > 0 || (!query && !workspace))
      .sort((a, b) => b.score - a.score || b.entry.timestamp - a.entry.timestamp)
      .slice(0, limit)
      .map((s) => s.entry)
  }

  public async clearReflections(userId?: string): Promise<void> {
    this.saveEntries([], userId)
  }

  public async renderPromptSection(task?: string, workspace?: string, userId?: string): Promise<string> {
    const relevant = await this.getReflections({ query: task, workspace, userId, limit: 3 })
    if (relevant.length === 0) return ''

    const lines = relevant.map((r, i) => {
      const taskBrief = r.task.slice(0, 60)
      return `${i + 1}. [Hedef / Senaryo]: "${taskBrief}"\n   [Çıkarılan Ders]: ${r.reflection}`
    })

    return `\n[REFLEXION MEMORY — LESSONS LEARNED FROM PAST FAILURES]:\nWhen attempting similar tasks, apply these proven corrections:\n${lines.join('\n')}\n`
  }

  private registerSystemPromptHook() {
    if ((this.ctx as any).systemPrompt?.section) {
      (this.ctx as any).systemPrompt.section({
        name: 'reflexion',
        order: 85,
        text: (context?: any) => {
          const ws = context?.cwd || (this.ctx as any).systemPrompt?.currentSessionWorkspace || process.cwd()
          const userId = context?.userId || (this.ctx as any).systemPrompt?.currentSessionUserId
          const presetId = context?.activePreset?.id || context?.preset?.id || (this.ctx as any).systemPrompt?.currentSessionPresetId
          const entries = this.loadEntries(userId)

          const relevant = entries.filter(e => {
            // Must strictly match current workspace (no leaking cross-workspace lessons)
            if (e.workspace && ws && e.workspace !== ws) return false
            // Must strictly match presetId if specified
            if ((e as any).presetId && presetId && (e as any).presetId !== presetId) return false
            // If entry has no workspace, do not inject into specific workspaces
            if (!e.workspace && ws) return false
            return true
          }).slice(0, 3)

          if (relevant.length === 0) return ''

          const lines = relevant.map((r, i) => {
            return `${i + 1}. [Önceki Görev]: "${r.task.slice(0, 70)}"\n   [Ders / Düzeltme]: ${r.reflection}`
          })

          return `\n[REFLEXION MEMORY — LESSONS FROM PAST FAILURES]:\nApply these lessons to avoid repeating known mistakes:\n${lines.join('\n')}\n`
        }
      })
    }
  }

  public registerTool() {
    if (this.ctx.tools?.register) {
      try {
        this.ctx.tools.register(
          defineTool({
            name: 'record_reflection',
            description: 'Kalıcı hafızaya geçmiş hatalardan çıkarılan dersleri ve özeleştirileri kaydeder (Roitman [224] Reflexion).',
            parameters: {
              type: 'object',
              properties: {
                task: { type: 'string', description: 'Ne tür bir görev veya işlem yapılıyordu' },
                mistake_or_error: { type: 'string', description: 'Karşılaşılan hata veya yapılan yanlış adım' },
                lesson_learned: { type: 'string', description: 'Bir dahaki sefere bu hatayı önlemek için ne yapılmalı' },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'İlgili etiketler (örn: ["vite", "three", "spill"])'
                }
              },
              required: ['task', 'lesson_learned']
            },
            execute: async (args: any, context?: any) => {
              const userId = context?.userId || context?.activePreset?.userId
              const entry = await this.recordReflection({
                task: args.task,
                error: args.mistake_or_error,
                reflection: args.lesson_learned,
                tags: args.tags || [],
                workspace: context?.cwd,
                presetId: context?.activePreset?.id || context?.preset?.id,
                userId,
                sessionId: context?.sessionId
              }, userId)
              return `✅ [Reflexion Kaydedildi]: Ders kalıcı hafızaya alındı (ID: ${entry.id}). Gelecekteki benzer görevlerde hatırlanacak.`
            }
          })
        )
      } catch {}
    }
  }
}

export const name = 'reflexion-local'
export const inject = ['settings', 'tools', 'systemPrompt']

export function apply(ctx: Context) {
  const service = new LocalReflexionService(ctx)
  ctx.set('reflexion', service)
}

export default LocalReflexionService
