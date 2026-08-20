import type { Context } from '@custom-harness/core-context'
import { TerminalService, type TerminalSessionInfo, type TerminalSendResult } from '@custom-harness/terminal'
import { spawn, type ChildProcess } from 'node:child_process'
import { buildBwrapInteractiveArgs } from '@custom-harness/subprocess-local'

export const name = 'terminal-bash'
export const inject = ['settings']

class InteractiveBashSession {
  public proc?: ChildProcess
  public info: TerminalSessionInfo
  public buffer = ''

  constructor(public id: string, name: string, cwd: string) {
    this.info = {
      id,
      name,
      cwd,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      alive: true
    }
    this.startProcess()
  }

  private startProcess() {
    const { binary, args } = buildBwrapInteractiveArgs(this.info.cwd)
    this.proc = spawn(binary, args, {
      cwd: this.info.cwd,
      env: { ...process.env, PAGER: 'cat', TERM: 'dumb', PS1: '' }
    })

    this.proc.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString('utf8')
      if (this.buffer.length > 500000) {
        this.buffer = this.buffer.slice(-350000)
      }
    })

    this.proc.stderr?.on('data', (data: Buffer) => {
      this.buffer += data.toString('utf8')
      if (this.buffer.length > 500000) {
        this.buffer = this.buffer.slice(-350000)
      }
    })

    this.proc.on('close', () => {
      this.info.alive = false
    })

    this.proc.on('error', () => {
      this.info.alive = false
    })
  }

  public async send(text: string, submit = true, timeoutMs = 30000): Promise<TerminalSendResult> {
    if (!this.proc || !this.info.alive) {
      this.startProcess()
    }

    this.info.lastActiveAt = Date.now()
    const delim = `__DSH_TERM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}__`
    const startIndex = this.buffer.length

    return new Promise((resolve) => {
      let settled = false

      const checkOutput = () => {
        if (settled) return
        const newOutput = this.buffer.slice(startIndex)
        if (newOutput.includes(delim)) {
          settled = true
          clearTimeout(timeoutTimer)
          clearInterval(pollInterval)
          const parts = newOutput.split(delim)
          const clean = parts[0].trim()
          resolve({
            sessionId: this.id,
            output: clean,
            completed: true
          })
        }
      }

      const pollInterval = setInterval(checkOutput, 50)

      const timeoutTimer = setTimeout(() => {
        if (!settled) {
          settled = true
          clearInterval(pollInterval)
          const partial = this.buffer.slice(startIndex).trim()
          resolve({
            sessionId: this.id,
            output: partial || '[Komut arka planda çalışmaya devam ediyor...]',
            completed: false
          })
        }
      }, timeoutMs)

      const commandToSend = submit ? `${text}\necho "${delim}"\n` : text
      this.proc?.stdin?.write(commandToSend)
    })
  }

  public read(tailBytes = 32768): string {
    if (this.buffer.length <= tailBytes) return this.buffer
    return this.buffer.slice(-tailBytes)
  }

  public kill(): boolean {
    if (this.proc && this.info.alive) {
      this.proc.kill('SIGTERM')
      this.info.alive = false
      return true
    }
    return false
  }
}

export class BashTerminalManager extends TerminalService {
  declare ctx: Context
  private sessions = new Map<string, InteractiveBashSession>()

  constructor(ctx: Context) {
    super(ctx)
  }

  public async spawn(name?: string, cwd?: string): Promise<TerminalSessionInfo> {
    const id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const targetCwd = cwd || (this.ctx.settings?.getWorkspace ? this.ctx.settings.getWorkspace() : process.cwd())
    const sessionName = name || `Terminal #${this.sessions.size + 1}`

    const session = new InteractiveBashSession(id, sessionName, targetCwd)
    this.sessions.set(id, session)
    return session.info
  }

  public async send(sessionId: string, text: string, submit = true, timeoutMs = 30000): Promise<TerminalSendResult> {
    let session = this.sessions.get(sessionId)
    if (!session) {
      // Auto spawn if missing
      await this.spawn(`Terminal (${sessionId})`)
      session = this.sessions.get(sessionId)
    }

    if (!session) {
      throw new Error(`Terminal oturumu bulunamadı: ${sessionId}`)
    }

    return session.send(text, submit, timeoutMs)
  }

  public read(sessionId: string, tailBytes = 32768): string {
    const session = this.sessions.get(sessionId)
    if (!session) return `Terminal "${sessionId}" bulunamadı.`
    return session.read(tailBytes)
  }

  public list(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values()).map(s => s.info)
  }

  public async kill(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    return session.kill()
  }
}

export function apply(ctx: Context) {
  ctx.set('terminals', new BashTerminalManager(ctx))
}
