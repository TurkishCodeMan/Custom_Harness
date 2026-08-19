import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import { spawn, ChildProcess } from 'node:child_process'

export const name = 'tool-bash-persistent'
export const inject = ['tools']

class PersistentSession {
  private child: ChildProcess | null = null
  public currentCwd: string

  constructor(initialCwd: string) {
    this.currentCwd = initialCwd
    this.initProcess()
  }

  private initProcess() {
    this.child = spawn('bash', ['-i'], {
      cwd: this.currentCwd,
      env: { ...process.env, PAGER: 'cat', TERM: 'dumb' }
    })
  }

  public async run(command: string, timeoutMs = 60000): Promise<{ output: string; exitCode: number }> {
    if (!this.child || this.child.killed) {
      this.initProcess()
    }

    const delim = `__DSH_DONE_${Date.now()}_${Math.random().toString(36).slice(2, 7)}__`
    const proc = this.child!

    return new Promise((resolve, reject) => {
      let output = ''
      const timeout = setTimeout(() => {
        cleanup()
        resolve({ output: output + '\n[Komut zaman aşımına uğradı]', exitCode: 124 })
      }, timeoutMs)

      function onData(chunk: Buffer) {
        const str = chunk.toString()
        output += str
        if (output.includes(delim)) {
          cleanup()
          const parts = output.split(delim)
          const cleanOutput = parts[0].trim()
          // Extract exit code if present
          const exitMatch = parts[1]?.match(/EXIT:(\d+)/)
          const exitCode = exitMatch ? parseInt(exitMatch[1]) : 0
          resolve({ output: cleanOutput, exitCode })
        }
      }

      function cleanup() {
        clearTimeout(timeout)
        proc.stdout?.removeListener('data', onData)
        proc.stderr?.removeListener('data', onData)
      }

      proc.stdout?.on('data', onData)
      proc.stderr?.on('data', onData)

      // Send command with delimiter and exit code tracker
      proc.stdin?.write(`${command}\necho "${delim}EXIT:$?"\n`)
    })
  }

  public kill() {
    if (this.child && !this.child.killed) {
      this.child.kill()
    }
  }
}

export function apply(ctx: Context) {
  const sessions = new Map<string, PersistentSession>()

  ctx.tools.register(defineTool({
    name: 'persistent_bash',
    description: 'Execute commands in a stateful persistent bash terminal. Working directory changes (cd), exported variables, and shell state persist across calls.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash shell command string to execute.' },
        restart: { type: 'boolean', description: 'Set true to restart and reset the terminal session.' }
      },
      required: ['command']
    },
    execute: async (args: { command: string; restart?: boolean }, context) => {
      const sessionId = 'default'
      let session = sessions.get(sessionId)

      if (args.restart && session) {
        session.kill()
        sessions.delete(sessionId)
        session = undefined
      }

      if (!session) {
        const cwd = context?.cwd || process.cwd()
        session = new PersistentSession(cwd)
        sessions.set(sessionId, session)
      }

      const res = await session.run(args.command)
      return res.output || `(Komut tamamlandı, çıkış kodu: ${res.exitCode})`
    }
  }))
}
