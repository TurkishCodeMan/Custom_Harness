import type { Context } from '@custom-harness/core-context'
import { JobRegistry, type JobSnapshot, type JobStartRequest, type JobStatus } from '@custom-harness/jobs'
import { spawn, type ChildProcess } from 'node:child_process'

export const name = 'jobs-local'
export const inject = ['settings']

interface RunningJob {
  snapshot: JobSnapshot
  process?: ChildProcess
}

export class LocalJobRegistry extends JobRegistry {
  declare ctx: Context
  private jobs = new Map<string, RunningJob>()

  constructor(ctx: Context) {
    super(ctx)
  }

  public async start(spec: JobStartRequest): Promise<JobSnapshot> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const cwd = spec.cwd || (this.ctx.settings?.getWorkspace ? this.ctx.settings.getWorkspace() : process.cwd())

    const snapshot: JobSnapshot = {
      id,
      name: spec.name,
      command: spec.command,
      status: 'running',
      startedAt: Date.now(),
      logs: `[Job Started]: ${spec.command}\n[Working Dir]: ${cwd}\n\n`,
      sessionId: spec.sessionId,
      userId: spec.userId
    }

    try {
      const proc = spawn('bash', ['-c', spec.command], {
        cwd,
        env: { ...process.env, ...spec.env, PAGER: 'cat' }
      })

      const running: RunningJob = {
        snapshot,
        process: proc
      }
      this.jobs.set(id, running)

      proc.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8')
        snapshot.logs += text
        // Keep logs bounded to 500k chars
        if (snapshot.logs.length > 500000) {
          snapshot.logs = snapshot.logs.slice(-350000)
        }
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8')
        snapshot.logs += text
        if (snapshot.logs.length > 500000) {
          snapshot.logs = snapshot.logs.slice(-350000)
        }
      })

      proc.on('close', (code: number | null) => {
        snapshot.completedAt = Date.now()
        snapshot.exitCode = code ?? 0
        snapshot.status = code === 0 ? 'completed' : 'failed'
        snapshot.logs += `\n[Job Exited]: Status: ${snapshot.status} (Exit Code: ${code})\n`
        running.process = undefined
        console.log(`[Job] Background job [${id}] "${spec.name}" finished with code ${code}`)
      })

      proc.on('error', (err: Error) => {
        snapshot.completedAt = Date.now()
        snapshot.status = 'failed'
        snapshot.logs += `\n[Job Process Error]: ${err.message}\n`
        running.process = undefined
      })

      return snapshot
    } catch (err: any) {
      snapshot.status = 'failed'
      snapshot.completedAt = Date.now()
      snapshot.logs += `\n[Job Launch Failed]: ${err.message}\n`
      this.jobs.set(id, { snapshot })
      return snapshot
    }
  }

  public list(sessionId?: string, userId?: string): JobSnapshot[] {
    const list: JobSnapshot[] = []
    for (const j of this.jobs.values()) {
      if (sessionId && j.snapshot.sessionId && j.snapshot.sessionId !== sessionId) continue
      if (userId && j.snapshot.userId && j.snapshot.userId !== userId) continue
      list.push(j.snapshot)
    }
    return list.sort((a, b) => b.startedAt - a.startedAt)
  }

  public get(id: string): JobSnapshot | undefined {
    return this.jobs.get(id)?.snapshot
  }

  public async kill(id: string): Promise<boolean> {
    const running = this.jobs.get(id)
    if (!running) return false

    if (running.process && running.snapshot.status === 'running') {
      try {
        running.process.kill('SIGTERM')
        setTimeout(() => {
          if (running.process) {
            running.process.kill('SIGKILL')
          }
        }, 3000)
        running.snapshot.status = 'cancelled'
        running.snapshot.completedAt = Date.now()
        running.snapshot.logs += '\n[Job Terminated by User/Agent Request]\n'
        return true
      } catch (e) {
        return false
      }
    }
    return false
  }

  public getLogs(id: string, tailLines = 100): string {
    const job = this.get(id)
    if (!job) return `Job with ID "${id}" not found.`

    const lines = job.logs.split('\n')
    if (lines.length <= tailLines) return job.logs
    return `... [Showing last ${tailLines} lines of ${lines.length} total lines]\n` + lines.slice(-tailLines).join('\n')
  }
}

export function apply(ctx: Context) {
  ctx.set('jobs', new LocalJobRegistry(ctx))
}
