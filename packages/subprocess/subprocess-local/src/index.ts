import child_process from 'node:child_process'
import type { Context } from '@custom-harness/core-context'
import { SubprocessService, type ExecOptions, type ExecResult } from '@custom-harness/subprocess'

export class LocalSubprocessService extends SubprocessService {
  constructor(ctx: Context) {
    super(ctx)
  }

  public async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    return new Promise((resolve) => {
      const child = child_process.spawn(command, {
        shell: true,
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        signal: options.signal
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false
      let timer: NodeJS.Timeout | undefined

      if (options.timeoutMs) {
        timer = setTimeout(() => {
          timedOut = true
          child.kill('SIGKILL')
        }, options.timeoutMs)
      }

      child.stdout?.on('data', (data) => {
        const text = data.toString()
        stdout += text
        options.onChunk?.({ stdout: text })
      })

      child.stderr?.on('data', (data) => {
        const text = data.toString()
        stderr += text
        options.onChunk?.({ stderr: text })
      })

      child.on('close', (code) => {
        if (timer) clearTimeout(timer)
        resolve({
          stdout,
          stderr,
          exitCode: code,
          timedOut
        })
      })

      child.on('error', (err) => {
        if (timer) clearTimeout(timer)
        resolve({
          stdout,
          stderr: stderr + '\n' + err.message,
          exitCode: 1,
          timedOut
        })
      })
    })
  }

  public async spawn(command: string, args: string[], options: ExecOptions = {}): Promise<child_process.ChildProcess> {
    return child_process.spawn(command, args, {
      shell: false,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      signal: options.signal
    })
  }
}

export const name = 'subprocess-local'

export function apply(ctx: Context) {
  ctx.set('subprocess', new LocalSubprocessService(ctx))
}

export default LocalSubprocessService
