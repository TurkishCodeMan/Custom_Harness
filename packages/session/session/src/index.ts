import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { SessionData, ChatMessage } from '@custom-harness/core-types'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const SESSIONS_DIR = path.join(os.homedir(), '.dsh', 'sessions')

export const name = 'session'
export const inject = ['settings']

export class SessionService extends Service {
  static inject = ['settings']
  private sessions = new Map<string, SessionData>()

  constructor(ctx: Context) {
    super(ctx, 'session')
    this.ensureDir()
  }

  private ensureDir() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    }
  }

  public createSession(title: string = 'Yeni Sohbet', workspace?: string): SessionData {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const session: SessionData = {
      id,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workspace: workspace || this.ctx.settings.getSettings().workspace || process.cwd(),
      messages: []
    }
    this.sessions.set(id, session)
    this.saveSession(session)
    return session
  }

  public getSession(id: string): SessionData | undefined {
    if (this.sessions.has(id)) {
      return this.sessions.get(id)
    }
    const filePath = path.join(SESSIONS_DIR, `${id}.json`)
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8')
        const data = JSON.parse(raw) as SessionData
        this.sessions.set(id, data)
        return data
      } catch (e) {
        console.error(`[Session] Failed to load session ${id}:`, e)
      }
    }
    return undefined
  }

  public listSessions(): { id: string; title: string; updatedAt: number; workspace: string }[] {
    this.ensureDir()
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))
    const list: { id: string; title: string; updatedAt: number; workspace: string }[] = []

    for (const f of files) {
      try {
        const id = f.replace('.json', '')
        const session = this.getSession(id)
        if (session) {
          list.push({
            id: session.id,
            title: session.title,
            updatedAt: session.updatedAt,
            workspace: session.workspace
          })
        }
      } catch (e) {}
    }

    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  public appendMessage(sessionId: string, message: ChatMessage) {
    const session = this.getSession(sessionId) || this.createSession()
    session.messages.push(message)
    session.updatedAt = Date.now()

    if (session.messages.length === 1 && message.role === 'user') {
      session.title = message.content?.slice(0, 30) || 'Yeni Sohbet'
    }

    this.saveSession(session)
  }

  public setMessages(sessionId: string, messages: ChatMessage[]) {
    const session = this.getSession(sessionId) || this.createSession()
    session.messages = messages
    session.updatedAt = Date.now()
    this.saveSession(session)
  }

  public deleteSession(id: string) {
    this.sessions.delete(id)
    const filePath = path.join(SESSIONS_DIR, `${id}.json`)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }

  public setSessionWorkspace(sessionId: string, workspace: string) {
    const session = this.getSession(sessionId)
    if (session) {
      session.workspace = workspace
      this.saveSession(session)
    }
  }

  public saveSession(session: SessionData) {
    try {
      this.ensureDir()
      const filePath = path.join(SESSIONS_DIR, `${session.id}.json`)
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8')
    } catch (e) {
      console.error(`[Session] Failed to save session ${session.id}:`, e)
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('session', new SessionService(ctx))
}
