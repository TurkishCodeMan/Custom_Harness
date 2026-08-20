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
  private activeSessionId?: string

  constructor(ctx: Context) {
    super(ctx, 'session')
    this.ensureDir()
  }

  public setActiveSession(id: string) {
    this.activeSessionId = id
  }

  public getActiveSession(): SessionData | undefined {
    if (this.activeSessionId) {
      return this.getSession(this.activeSessionId)
    }
    return undefined
  }

  private ensureDir() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    }
  }

  public createSession(title: string = 'Yeni Sohbet', workspace?: string, userId?: string): SessionData {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const session: SessionData = {
      id,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workspace: workspace || this.ctx.settings.getSettings().workspace || process.cwd(),
      userId: userId || 'user_admin',
      messages: []
    }
    this.activeSessionId = id
    this.sessions.set(id, session)
    this.saveSession(session)
    return session
  }

  public getTenantSessionsDir(userId: string): string {
    const dir = path.join(os.homedir(), '.dsh', 'tenants', userId, 'sessions')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  public getSession(id: string, userId?: string): SessionData | undefined {
    if (this.sessions.has(id)) {
      return this.sessions.get(id)
    }

    // 1. Check tenant specific path if userId is provided
    if (userId) {
      const tenantFile = path.join(this.getTenantSessionsDir(userId), `${id}.json`)
      if (fs.existsSync(tenantFile)) {
        try {
          const raw = fs.readFileSync(tenantFile, 'utf8')
          const data = JSON.parse(raw) as SessionData
          this.sessions.set(id, data)
          return data
        } catch (e) {}
      }
    }

    // 2. Scan all tenant dirs if not found
    const tenantsBase = path.join(os.homedir(), '.dsh', 'tenants')
    if (fs.existsSync(tenantsBase)) {
      try {
        const tenantFolders = fs.readdirSync(tenantsBase, { withFileTypes: true })
        for (const tf of tenantFolders) {
          if (tf.isDirectory()) {
            const candidate = path.join(tenantsBase, tf.name, 'sessions', `${id}.json`)
            if (fs.existsSync(candidate)) {
              const raw = fs.readFileSync(candidate, 'utf8')
              const data = JSON.parse(raw) as SessionData
              this.sessions.set(id, data)
              return data
            }
          }
        }
      } catch (e) {}
    }

    // 3. Check legacy SESSIONS_DIR
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

  public listSessions(userId?: string, isAdmin?: boolean): { id: string; title: string; updatedAt: number; workspace: string; userId?: string }[] {
    const list: { id: string; title: string; updatedAt: number; workspace: string; userId?: string }[] = []
    const seenIds = new Set<string>()

    const addSessionFromPath = (filePath: string) => {
      try {
        const id = path.basename(filePath, '.json')
        if (seenIds.has(id)) return
        const session = this.getSession(id, userId)
        if (session) {
          if (isAdmin || !userId || !session.userId || session.userId === userId) {
            seenIds.add(id)
            list.push({
              id: session.id,
              title: session.title,
              updatedAt: session.updatedAt,
              workspace: session.workspace,
              userId: session.userId || 'user_admin'
            })
          }
        }
      } catch (e) {}
    }

    // 1. Scan tenant sessions
    const tenantsBase = path.join(os.homedir(), '.dsh', 'tenants')
    if (fs.existsSync(tenantsBase)) {
      try {
        const tenantFolders = fs.readdirSync(tenantsBase, { withFileTypes: true })
        for (const tf of tenantFolders) {
          if (tf.isDirectory()) {
            if (!isAdmin && userId && tf.name !== userId) continue
            const tSessionsDir = path.join(tenantsBase, tf.name, 'sessions')
            if (fs.existsSync(tSessionsDir)) {
              const files = fs.readdirSync(tSessionsDir).filter(f => f.endsWith('.json'))
              for (const f of files) {
                addSessionFromPath(path.join(tSessionsDir, f))
              }
            }
          }
        }
      } catch (e) {}
    }

    // 2. Scan legacy sessions
    this.ensureDir()
    const legacyFiles = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))
    for (const f of legacyFiles) {
      addSessionFromPath(path.join(SESSIONS_DIR, f))
    }

    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  public appendMessage(sessionId: string, message: ChatMessage, userId?: string) {
    const session = this.getSession(sessionId) || this.createSession(undefined, undefined, userId)
    if (userId && !session.userId) {
      session.userId = userId
    }
    session.messages.push(message)
    session.updatedAt = Date.now()

    if (session.messages.length === 1 && message.role === 'user') {
      session.title = message.content?.slice(0, 30) || 'Yeni Sohbet'
    }

    this.saveSession(session)
  }

  public renameSession(sessionId: string, title: string, userId?: string): SessionData | undefined {
    const session = this.getSession(sessionId, userId)
    if (session) {
      session.title = title
      session.updatedAt = Date.now()
      this.saveSession(session)
      return session
    }
    return undefined
  }

  public setMessages(sessionId: string, messages: ChatMessage[]) {
    const session = this.getSession(sessionId) || this.createSession()
    session.messages = messages
    session.updatedAt = Date.now()
    this.saveSession(session)
  }

  public getUploadsDir(sessionId?: string, userId?: string): string {
    let base = path.join(os.homedir(), '.dsh', 'uploads')
    if (userId) {
      base = path.join(os.homedir(), '.dsh', 'tenants', userId, 'uploads')
    }
    const dir = sessionId ? path.join(base, sessionId) : base
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  public deleteSession(id: string, userId?: string, isAdmin?: boolean) {
    const session = this.getSession(id, userId)
    if (session && !isAdmin && userId && session.userId && session.userId !== userId) {
      throw new Error('Bu oturumu silme yetkiniz bulunmuyor.')
    }
    this.sessions.delete(id)
    
    // Delete from tenant sessions dir
    const uid = session?.userId || userId
    if (uid) {
      const tenantFile = path.join(this.getTenantSessionsDir(uid), `${id}.json`)
      if (fs.existsSync(tenantFile)) {
        try { fs.unlinkSync(tenantFile) } catch (e) {}
      }
    }

    // Delete from legacy SESSIONS_DIR
    const filePath = path.join(SESSIONS_DIR, `${id}.json`)
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath) } catch (e) {}
    }

    // Clean up session uploads across tenant and legacy paths
    const pathsToClean = [
      path.join(os.homedir(), '.dsh', 'uploads', id)
    ]
    if (uid) {
      pathsToClean.push(path.join(os.homedir(), '.dsh', 'tenants', uid, 'uploads', id))
    }
    for (const p of pathsToClean) {
      if (fs.existsSync(p)) {
        try { fs.rmSync(p, { recursive: true, force: true }) } catch (e) {}
      }
    }
  }

  public clearAllSessions(userId?: string, isAdmin?: boolean) {
    this.ensureDir()
    // 1. Clear tenant sessions
    if (userId) {
      const tenantDir = this.getTenantSessionsDir(userId)
      if (fs.existsSync(tenantDir)) {
        try {
          const files = fs.readdirSync(tenantDir).filter(f => f.endsWith('.json'))
          for (const f of files) {
            const id = f.replace('.json', '')
            this.sessions.delete(id)
            try { fs.unlinkSync(path.join(tenantDir, f)) } catch (e) {}
          }
        } catch (e) {}
      }
    }

    // 2. Clear legacy sessions
    try {
      const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))
      for (const f of files) {
        const id = f.replace('.json', '')
        const session = this.getSession(id, userId)
        if (isAdmin || !userId || !session?.userId || session.userId === userId) {
          this.sessions.delete(id)
          try {
            fs.unlinkSync(path.join(SESSIONS_DIR, f))
          } catch (e) {}
        }
      }
    } catch (e) {}

    // Clean up uploads
    if (isAdmin || !userId) {
      const uploadsBase = path.join(os.homedir(), '.dsh', 'uploads')
      if (fs.existsSync(uploadsBase)) {
        try { fs.rmSync(uploadsBase, { recursive: true, force: true }) } catch (e) {}
      }
    } else if (userId) {
      const tenantUploads = path.join(os.homedir(), '.dsh', 'tenants', userId, 'uploads')
      if (fs.existsSync(tenantUploads)) {
        try { fs.rmSync(tenantUploads, { recursive: true, force: true }) } catch (e) {}
      }
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
      const uid = session.userId || 'user_admin'
      const tenantDir = this.getTenantSessionsDir(uid)
      const tenantFilePath = path.join(tenantDir, `${session.id}.json`)
      fs.writeFileSync(tenantFilePath, JSON.stringify(session, null, 2), 'utf8')

      // Also mirror to legacy SESSIONS_DIR
      this.ensureDir()
      const legacyFilePath = path.join(SESSIONS_DIR, `${session.id}.json`)
      fs.writeFileSync(legacyFilePath, JSON.stringify(session, null, 2), 'utf8')
    } catch (e) {
      console.error(`[Session] Failed to save session ${session.id}:`, e)
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('session', new SessionService(ctx))
}
