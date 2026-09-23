import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ScheduleRecord, ScheduleCreateOptions, ScheduleListFilter } from './types.js'
import { buildScheduleRecord, getNextCronOccurrence, renderScheduleReminderFraming } from './domain.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const getDshDir = () => process.env.DSH_DIR || path.join(os.homedir(), '.dsh')
const getSchedulesFilePath = () => path.join(getDshDir(), 'schedules.json')

export class ScheduleService extends Service {
  declare ctx: Context
  static inject = ['tools', 'settings', 'session', 'agent', 'agentPresets']
  public static instance?: ScheduleService
  private schedules = new Map<string, ScheduleRecord>()
  private activeRuns = new Map<string, number>()
  private activeControllers = new Map<string, AbortController>()
  private deletedIds = new Set<string>()
  private timer?: NodeJS.Timeout
  private isProcessing = false

  constructor(ctx: Context) {
    super(ctx, 'schedule')
    ScheduleService.instance = this
    this.loadPersistence(true)
    this.startTicker()
  }

  public static getInstance(ctx?: Context): ScheduleService | undefined {
    if (ScheduleService.instance) return ScheduleService.instance
    if (ctx) {
      ScheduleService.instance = new ScheduleService(ctx)
      return ScheduleService.instance
    }
    return undefined
  }

  private getTenantSchedulesPath(userId: string): string {
    const tenantDir = path.join(getDshDir(), 'tenants', userId)
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true })
    }
    return path.join(tenantDir, 'schedules.json')
  }

  private loadPersistence(isStartup = false): void {
    const now = Date.now()
    const filesToLoad: string[] = []

    // 1. Global schedules
    const globalPath = getSchedulesFilePath()
    if (fs.existsSync(globalPath)) filesToLoad.push(globalPath)

    // 2. Tenant schedules (~/.dsh/tenants/*/schedules.json)
    const tenantsDir = path.join(getDshDir(), 'tenants')
    if (fs.existsSync(tenantsDir)) {
      try {
        const tenantDirs = fs.readdirSync(tenantsDir, { withFileTypes: true })
        for (const t of tenantDirs) {
          if (t.isDirectory()) {
            const p = path.join(tenantsDir, t.name, 'schedules.json')
            if (fs.existsSync(p)) filesToLoad.push(p)
          }
        }
      } catch (e) {
        console.warn('[Schedule] Tenant dizinleri taranamadı:', e)
      }
    }

    for (const p of filesToLoad) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'))
        if (Array.isArray(data)) {
          for (const item of data as ScheduleRecord[]) {
            if (item && item.id) {
              if (this.deletedIds.has(item.id) || item.status === 'cancelled') {
                continue
              }
              if (isStartup && item.status === 'active' && item.targetTime <= now) {
                if (item.type === 'cron' && item.cronExpression) {
                  item.targetTime = getNextCronOccurrence(item.cronExpression, new Date(now))
                } else if (item.type === 'every' && item.everySeconds) {
                  item.targetTime = now + (item.everySeconds * 1000)
                }
              }
              // In periodic ticker sync, do not overwrite an in-memory active record's targetTime
              const memoryRecord = this.schedules.get(item.id)
              if (!isStartup && memoryRecord && memoryRecord.status === 'active') {
                continue
              }
              this.schedules.set(item.id, item)
            }
          }
        }
      } catch (e) {
        console.warn(`[Schedule] ${p} dosyası okunamadı:`, e)
      }
    }
  }

  private savePersistence(userId?: string): void {
    try {
      const all = Array.from(this.schedules.values()).filter(r => !this.deletedIds.has(r.id) && r.status !== 'cancelled')

      // Group by userId / tenant
      const byUser = new Map<string, ScheduleRecord[]>()
      const globalList: ScheduleRecord[] = []

      for (const item of all) {
        if (item.userId && item.userId !== 'system') {
          const list = byUser.get(item.userId) || []
          list.push(item)
          byUser.set(item.userId, list)
        } else {
          globalList.push(item)
        }
      }

      // Save global
      const dir = getDshDir()
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(getSchedulesFilePath(), JSON.stringify(globalList, null, 2), 'utf8')

      // Save each tenant directory (clear file with [] if tenant has 0 schedules)
      const tenantsDir = path.join(getDshDir(), 'tenants')
      if (fs.existsSync(tenantsDir)) {
        try {
          const tenantDirs = fs.readdirSync(tenantsDir, { withFileTypes: true })
          for (const t of tenantDirs) {
            if (t.isDirectory()) {
              const p = path.join(tenantsDir, t.name, 'schedules.json')
              const items = byUser.get(t.name) || []
              fs.writeFileSync(p, JSON.stringify(items, null, 2), 'utf8')
              byUser.delete(t.name)
            }
          }
        } catch (e) {
          console.warn('[Schedule] Tenant dizinleri güncellenemedi:', e)
        }
      }

      for (const [uid, items] of byUser.entries()) {
        const p = this.getTenantSchedulesPath(uid)
        fs.writeFileSync(p, JSON.stringify(items, null, 2), 'utf8')
      }
    } catch (e) {
      console.warn('[Schedule] Kalıcı plan kayıtları kaydedilemedi:', e)
    }
  }

  private startTicker(): void {
    if (this.timer) clearInterval(this.timer)
    // Check every 500ms for due schedules
    this.timer = setInterval(() => {
      this.checkDueSchedules().catch((err) => {
        console.error('[Schedule] Ticker hata verdi:', err)
      })
    }, 500)
    // Unref so it does not block node process exit in tests
    if (this.timer.unref) this.timer.unref()
  }

  private lastDiskCheck = 0

  public async checkDueSchedules(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      const now = Date.now()

      // Periodically sync with disk (every 2s) to discover schedules created by other processes/CLI
      if (now - this.lastDiskCheck > 2000) {
        this.lastDiskCheck = now
        this.loadPersistence()
      }

      const dueRecords: ScheduleRecord[] = []

      for (const record of this.schedules.values()) {
        if (record.status === 'active' && record.targetTime <= now) {
          dueRecords.push(record)
        }
      }

      for (const record of dueRecords) {
        await this.triggerRecord(record)
      }
    } finally {
      this.isProcessing = false
    }
  }

  private async triggerRecord(record: ScheduleRecord, force = false): Promise<void> {
    const now = Date.now()

    // If this routine is still executing, do not interrupt; let it complete its deep analysis naturally
    const isRunning = this.activeRuns.has(record.id)
    if (isRunning && !force) {
      console.log(`⏳ [Schedule] [${record.id}] önceki analiz hala devam ediyor, çakışmayı önlemek için bu periyot erteleniyor.`)
      // Advance targetTime to next interval so it doesn't queue up a backlog
      if (record.targetTime <= now) {
        if (record.type === 'cron' && record.cronExpression) {
          record.targetTime = getNextCronOccurrence(record.cronExpression, new Date(now))
        } else if (record.type === 'every' && record.everySeconds) {
          record.targetTime = now + (record.everySeconds * 1000)
        }
        this.savePersistence()
      }
      return
    }

    record.lastTriggeredAt = now
    record.triggerCount++

    // Advance or complete schedule
    if (record.type === 'after' || record.type === 'at') {
      record.status = 'triggered'
    } else if (record.type === 'every' && record.everySeconds) {
      record.targetTime = now + (record.everySeconds * 1000)
    } else if (record.type === 'cron' && record.cronExpression) {
      record.targetTime = getNextCronOccurrence(record.cronExpression, new Date(now))
    }

    this.savePersistence()

    console.log(`\n⏰ [Schedule] Görev tetiklendi: [${record.id}] (${record.type}) - "${record.prompt.slice(0, 50)}..."`)

    // Emit event for UI / WebSocket notifications
    try {
      ;(this.ctx as any).emit?.('schedule/triggered', { record, sessionId: record.sessionId })
    } catch {}

    // Dispatch execution to Agent with timestamp tracking
    this.activeRuns.set(record.id, now)
    try {
      await this.dispatchExecution(record)
    } catch (err) {
      this.activeRuns.delete(record.id)
      console.error(`[Schedule] Görev yürütülürken hata oluştu [${record.id}]:`, err)
    }
  }

  private async dispatchExecution(record: ScheduleRecord): Promise<void> {
    const root = (this.ctx as any).root || this.ctx
    const agentService = (this.ctx as any).agent || root?.agent || (this.ctx as any).get?.('agent')
    if (!agentService || typeof agentService.run !== 'function') {
      console.warn(`[Schedule] Agent servisi henüz hazır değil, [${record.id}] yürütülemedi.`)
      this.activeRuns.delete(record.id)
      return
    }

    const sessionService = this.ctx.session || root?.session
    let targetSessionId = record.sessionId

    let icon = ''
    let posName = record.preset || 'Zamanlanmış Rutin'

    try {
      const apService = (this.ctx as any).agentPresets || root?.agentPresets
      const preset = record.preset
        ? ((this.ctx.settings as any)?.getPreset?.(record.preset) || (apService?.get ? apService.get(record.preset) : undefined))
        : undefined
      if (preset?.icon) icon = `${preset.icon} `
      if (preset?.name) posName = preset.name
    } catch (err) {
      // Continue gracefully with default naming
    }

    const cleanTitle = `${icon}${posName} • Canlı Denetim Akışı`

    // Check if the existing session is still valid in session service
    let isSessionValid = false
    if (targetSessionId && sessionService) {
      try {
        const existing = typeof sessionService.getSession === 'function' ? sessionService.getSession(targetSessionId) : null
        if (existing) {
          isSessionValid = true
          if (existing.title && (existing.title.startsWith('[SCHEDULE') || existing.title.startsWith('Yeni Sohbet'))) {
            existing.title = cleanTitle
            sessionService.saveSession?.(existing)
            try {
              (this.ctx as any).emit?.('session_title', { sessionId: targetSessionId, title: cleanTitle })
            } catch {}
          }
        }
      } catch {}
    }

    // Single Continuous Thread Strategy for Routines:
    // Only create a dedicated session if none exists or the previous session was deleted.
    if (!isSessionValid && sessionService?.createSession) {
      const newSession = sessionService.createSession(
        cleanTitle,
        record.workspace || process.cwd(),
        record.userId || 'system',
        'web',
        false,
        false
      )
      targetSessionId = newSession.id
      record.sessionId = targetSessionId
      this.savePersistence()
    }

    const reminderContent = renderScheduleReminderFraming(record)

    // Emit triggered event so WebSocket gateway can notify clients
    try {
      (this.ctx as any).emit?.('schedule/triggered', { record, sessionId: targetSessionId })
    } catch {}

    // AbortController for user-initiated cancel or reset; no artificial timeout so agents can analyze large datasets fully
    const controller = new AbortController()
    this.activeControllers.set(record.id, controller)

    // Run agent asynchronously in background until completion
    agentService.run({
      sessionId: targetSessionId,
      userId: record.userId || 'system',
      presetId: record.preset,
      preset: record.preset,
      cwd: record.workspace || process.cwd(),
      prompt: reminderContent,
      signal: controller.signal
    }).then((result: any) => {
      this.activeControllers.delete(record.id)
      this.activeRuns.delete(record.id)
      console.log(`✅ [Schedule] [${record.id}] görevi başarıyla tamamlandı.`)
      try {
        (this.ctx as any).emit?.('schedule/completed', { record, sessionId: targetSessionId, result })
      } catch {}
    }).catch((err: any) => {
      this.activeControllers.delete(record.id)
      this.activeRuns.delete(record.id)
      console.error(`❌ [Schedule] [${record.id}] görevi çalışırken hata aldı:`, err)
      try {
        (this.ctx as any).emit?.('schedule/failed', { record, sessionId: targetSessionId, error: err })
      } catch {}
    })
  }

  public async triggerNow(id: string): Promise<boolean> {
    const record = this.schedules.get(id)
    if (!record) return false
    
    // If there is an active run, gracefully abort it before restarting
    const existingCtrl = this.activeControllers.get(id)
    if (existingCtrl) {
      try { existingCtrl.abort() } catch {}
      this.activeControllers.delete(id)
    }
    this.activeRuns.delete(id)

    await this.triggerRecord(record, true)
    return true
  }

  public create(opts: ScheduleCreateOptions): ScheduleRecord {
    const record = buildScheduleRecord(opts)
    this.schedules.set(record.id, record)
    this.savePersistence()
    console.log(`📅 [Schedule] Yeni plan oluşturuldu: [${record.id}] (${record.type}) -> Hedef: ${new Date(record.targetTime).toLocaleString('tr-TR')}`)
    return record
  }

  public list(filter?: ScheduleListFilter): ScheduleRecord[] {
    let list = Array.from(this.schedules.values())
    if (filter?.status) {
      list = list.filter(r => r.status === filter.status)
    }
    if (filter?.sessionId) {
      list = list.filter(r => r.sessionId === filter.sessionId)
    }
    if (filter?.preset) {
      list = list.filter(r => r.preset === filter.preset)
    }
    if (filter?.userId) {
      list = list.filter(r => r.userId === filter.userId || r.userId === 'system')
    }
    return list.sort((a, b) => a.targetTime - b.targetTime)
  }

  public delete(id: string): boolean {
    this.deletedIds.add(id)
    const ctrl = this.activeControllers.get(id)
    if (ctrl) {
      try { ctrl.abort() } catch {}
      this.activeControllers.delete(id)
    }
    this.activeRuns.delete(id)
    const record = this.schedules.get(id)
    if (record) {
      record.status = 'cancelled'
    }
    this.schedules.delete(id)
    this.savePersistence()
    console.log(`🗑️ [Schedule] Plan tamamen iptal edildi ve silindi: [${id}]`)
    return true
  }

  public get(id: string): ScheduleRecord | undefined {
    return this.schedules.get(id)
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }
}
