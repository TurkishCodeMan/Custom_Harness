import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type {
  AgentTurnSnapshot,
  InspectorFilter,
  ToolExecutionRecord,
  LlmResponseSnapshot
} from '@custom-harness/inspector'

export interface LocalInspectorConfig {
  maxInMemoryTurns?: number
  persistToDisk?: boolean
  logDir?: string
}

export class InspectorStorage {
  private turns: AgentTurnSnapshot[] = []
  private turnsById = new Map<string, AgentTurnSnapshot>()
  private turnsBySession = new Map<string, AgentTurnSnapshot[]>()
  private maxInMemoryTurns: number
  private persistToDisk: boolean
  private logDir: string

  constructor(config?: LocalInspectorConfig) {
    this.maxInMemoryTurns = config?.maxInMemoryTurns ?? 500
    this.persistToDisk = config?.persistToDisk ?? true
    this.logDir = config?.logDir
      ? path.resolve(config.logDir)
      : path.join(os.homedir(), '.dsh', 'inspector')

    if (this.persistToDisk) {
      this.ensureLogDir()
    }
  }

  private ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 })
      }
    } catch (e: any) {
      console.error('[InspectorStorage] Failed to create log directory:', e.message)
    }
  }

  private getDailyLogFile(): string {
    const dateStr = new Date().toISOString().slice(0, 10)
    return path.join(this.logDir, `inspector_${dateStr}.jsonl`)
  }

  private persistToFile(snapshot: AgentTurnSnapshot) {
    if (!this.persistToDisk) return
    try {
      this.ensureLogDir()
      const filePath = this.getDailyLogFile()
      // Write one JSON object per line
      fs.appendFileSync(filePath, JSON.stringify(snapshot) + '\n', 'utf8')
    } catch (e: any) {
      console.error('[InspectorStorage] Failed to append snapshot to disk:', e.message)
    }
  }

  public save(snapshot: AgentTurnSnapshot): void {
    // 1. Maintain in-memory list
    this.turns.push(snapshot)
    if (this.turns.length > this.maxInMemoryTurns) {
      const evicted = this.turns.shift()
      if (evicted) {
        this.turnsById.delete(evicted.id)
        const sessionList = this.turnsBySession.get(evicted.sessionId)
        if (sessionList) {
          const idx = sessionList.findIndex((t) => t.id === evicted.id)
          if (idx !== -1) sessionList.splice(idx, 1)
        }
      }
    }

    // 2. Map indices
    this.turnsById.set(snapshot.id, snapshot)

    let sessionTurns = this.turnsBySession.get(snapshot.sessionId)
    if (!sessionTurns) {
      sessionTurns = []
      this.turnsBySession.set(snapshot.sessionId, sessionTurns)
    }
    sessionTurns.push(snapshot)

    // 3. Persist
    this.persistToFile(snapshot)
  }

  public addToolExecution(sessionId: string, tool: ToolExecutionRecord): AgentTurnSnapshot | undefined {
    const latest = this.getLatest(sessionId)
    if (!latest) return undefined

    if (!latest.toolExecutions) {
      latest.toolExecutions = []
    }
    latest.toolExecutions.push(tool)
    return latest
  }

  public updateTurnEnd(sessionId: string, response: LlmResponseSnapshot): AgentTurnSnapshot | undefined {
    const latest = this.getLatest(sessionId)
    if (!latest) return undefined

    latest.llmResponse = {
      ...latest.llmResponse,
      ...response,
      completedAt: response.completedAt || Date.now()
    }
    latest.status = response.error ? 'error' : 'completed'
    return latest
  }

  public getLatest(sessionId: string): AgentTurnSnapshot | undefined {
    const sessionTurns = this.turnsBySession.get(sessionId)
    if (!sessionTurns || sessionTurns.length === 0) return undefined
    return sessionTurns[sessionTurns.length - 1]
  }

  public getSessionTurns(sessionId: string): AgentTurnSnapshot[] {
    return this.turnsBySession.get(sessionId) || []
  }

  public getTurn(id: string): AgentTurnSnapshot | undefined {
    return this.turnsById.get(id)
  }

  public query(filter?: InspectorFilter): AgentTurnSnapshot[] {
    let result = [...this.turns]

    if (!filter) {
      return result.slice(-50).reverse()
    }

    if (filter.sessionId) {
      result = result.filter((t) => t.sessionId === filter.sessionId)
    }
    if (filter.presetId) {
      result = result.filter((t) => t.input.presetId === filter.presetId)
    }
    if (filter.status) {
      result = result.filter((t) => t.status === filter.status)
    }
    if (filter.from) {
      result = result.filter((t) => t.timestamp >= filter.from!)
    }
    if (filter.to) {
      result = result.filter((t) => t.timestamp <= filter.to!)
    }

    const limit = filter.limit && filter.limit > 0 ? filter.limit : 50
    return result.slice(-limit).reverse()
  }

  public clear(sessionId?: string): void {
    if (sessionId) {
      const sessionTurns = this.turnsBySession.get(sessionId) || []
      for (const turn of sessionTurns) {
        this.turnsById.delete(turn.id)
      }
      this.turnsBySession.delete(sessionId)
      this.turns = this.turns.filter((t) => t.sessionId !== sessionId)
    } else {
      this.turns = []
      this.turnsById.clear()
      this.turnsBySession.clear()
    }
  }
}
