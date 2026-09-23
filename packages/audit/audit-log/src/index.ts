import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export type AuditActionType =
  | 'tool_call'
  | 'report_generated'
  | 'directive_issued'
  | 'approval_requested'
  | 'approval_resolved'
  | 'subagent_spawn'
  | 'subagent_completed'
  | 'system'

export interface AuditEntry {
  id: string
  timestamp: number
  positionId?: string
  positionTitle?: string
  sessionId?: string
  traceId?: string
  actionType: AuditActionType
  summary: string
  details?: any
}

export interface AuditFilter {
  positionId?: string
  actionType?: string
  traceId?: string
  sessionId?: string
  from?: number
  to?: number
  limit?: number
}

export const name = 'auditLog'
export const inject = []

export class AuditLogService extends Service {
  private logDir: string
  private memoryCache: AuditEntry[] = []
  private maxCacheSize = 2000

  constructor(ctx: Context) {
    super(ctx, 'auditLog')
    this.logDir = path.join(os.homedir(), '.dsh', 'audit')
    this.ensureLogDir()
    this.loadRecentEntries()
  }

  private ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
    } catch (e) {
      console.error('[AuditLog] Failed to create audit log directory:', e)
    }
  }

  private getCurrentLogFile(): string {
    const dateStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    return path.join(this.logDir, `audit_${dateStr}.jsonl`)
  }

  private loadRecentEntries() {
    try {
      if (!fs.existsSync(this.logDir)) return
      const files = fs
        .readdirSync(this.logDir)
        .filter((f) => f.startsWith('audit_') && f.endsWith('.jsonl'))
        .sort()
        .slice(-3) // Last 3 days

      const loaded: AuditEntry[] = []
      for (const file of files) {
        const fullPath = path.join(this.logDir, file)
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            loaded.push(JSON.parse(line))
          } catch {}
        }
      }
      this.memoryCache = loaded.slice(-this.maxCacheSize)
    } catch (e) {
      console.error('[AuditLog] Error loading recent audit logs:', e)
    }
  }

  public write(entryInput: Omit<AuditEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): AuditEntry {
    const entry: AuditEntry = {
      id: entryInput.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entryInput.timestamp || Date.now(),
      positionId: entryInput.positionId,
      positionTitle: entryInput.positionTitle,
      sessionId: entryInput.sessionId,
      traceId: entryInput.traceId,
      actionType: entryInput.actionType,
      summary: entryInput.summary,
      details: entryInput.details
    }

    this.memoryCache.push(entry)
    if (this.memoryCache.length > this.maxCacheSize) {
      this.memoryCache.shift()
    }

    // Persist asynchronously / safely to disk
    try {
      this.ensureLogDir()
      const logFile = this.getCurrentLogFile()
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8')
    } catch (e) {
      console.error('[AuditLog] Failed to write entry to disk:', e)
    }

    try {
      ;(this.ctx as any).emit?.('audit/entry', entry)
    } catch {}

    return entry
  }

  public query(filter?: AuditFilter): AuditEntry[] {
    let result = [...this.memoryCache]

    if (!filter) {
      return result.slice(-100).reverse()
    }

    if (filter.positionId) {
      result = result.filter((e) => e.positionId === filter.positionId)
    }
    if (filter.actionType) {
      result = result.filter((e) => e.actionType === filter.actionType)
    }
    if (filter.traceId) {
      result = result.filter((e) => e.traceId === filter.traceId)
    }
    if (filter.sessionId) {
      result = result.filter((e) => e.sessionId === filter.sessionId)
    }
    if (filter.from) {
      result = result.filter((e) => e.timestamp >= filter.from!)
    }
    if (filter.to) {
      result = result.filter((e) => e.timestamp <= filter.to!)
    }

    const limit = filter.limit && filter.limit > 0 ? filter.limit : 100
    return result.slice(-limit).reverse()
  }

  public exportCsv(filter?: AuditFilter): string {
    const entries = this.query(filter)
    const headers = ['ID', 'Tarih', 'Pozisyon ID', 'Pozisyon Adı', 'Oturum ID', 'Trace ID', 'İşlem Tipi', 'Özet', 'Detaylar']
    
    const rows = entries.map((e) => {
      const dateStr = new Date(e.timestamp).toISOString()
      const detailsStr = e.details ? JSON.stringify(e.details).replace(/"/g, '""') : ''
      return [
        `"${e.id}"`,
        `"${dateStr}"`,
        `"${e.positionId || ''}"`,
        `"${(e.positionTitle || '').replace(/"/g, '""')}"`,
        `"${e.sessionId || ''}"`,
        `"${e.traceId || ''}"`,
        `"${e.actionType}"`,
        `"${(e.summary || '').replace(/"/g, '""')}"`,
        `"${detailsStr}"`
      ].join(',')
    })

    return [headers.join(','), ...rows].join('\n')
  }
}

export function apply(ctx: Context) {
  ctx.set('auditLog', new AuditLogService(ctx))
}

export default AuditLogService
