import child_process from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Context } from '@custom-harness/core-context'
import { SubprocessService, type ExecOptions, type ExecResult } from '@custom-harness/subprocess'

let hasBwrapCache: boolean | null = null

export function isBwrapAvailable(): boolean {
  if (hasBwrapCache !== null) return hasBwrapCache
  try {
    hasBwrapCache = process.platform === 'linux' && (fs.existsSync('/usr/bin/bwrap') || fs.existsSync('/bin/bwrap'))
  } catch {
    hasBwrapCache = false
  }
  return hasBwrapCache
}

export function buildBwrapArgs(targetCwd: string, command: string): { binary: string; args: string[]; useBwrap: boolean } {
  if (!isBwrapAvailable()) {
    return { binary: 'bash', args: ['-c', command], useBwrap: false }
  }

  const workspaceRoot = path.resolve(targetCwd || process.cwd())
  if (!fs.existsSync(workspaceRoot)) {
    try { fs.mkdirSync(workspaceRoot, { recursive: true }) } catch {}
  }

  const args: string[] = [
    // 1. Root filesystem is strictly READ-ONLY (matches DeepSeek Harness bwrapProfileArgs)
    '--ro-bind', '/', '/',
    // 2. Device and process virtual trees
    '--dev', '/dev',
    '--proc', '/proc',
    // 3. Ephemeral in-memory tmpfs
    '--tmpfs', '/tmp',
    // 4. ONLY the workspace directory is mounted as READ-WRITE
    '--bind', workspaceRoot, workspaceRoot,
    '--chdir', workspaceRoot,
    // 5. Unshare all namespaces (user, pid, ipc, uts) and allow networking
    '--unshare-all',
    '--share-net',
    '--die-with-parent',
    // Command to execute
    'bash', '-c', command
  ]

  return { binary: 'bwrap', args, useBwrap: true }
}

export function buildBwrapInteractiveArgs(targetCwd: string): { binary: string; args: string[]; useBwrap: boolean } {
  if (!isBwrapAvailable()) {
    return { binary: 'bash', args: ['-i'], useBwrap: false }
  }

  const workspaceRoot = path.resolve(targetCwd || process.cwd())
  if (!fs.existsSync(workspaceRoot)) {
    try { fs.mkdirSync(workspaceRoot, { recursive: true }) } catch {}
  }

  const args: string[] = [
    '--ro-bind', '/', '/',
    '--dev', '/dev',
    '--proc', '/proc',
    '--tmpfs', '/tmp',
    '--bind', workspaceRoot, workspaceRoot,
    '--chdir', workspaceRoot,
    '--unshare-all',
    '--share-net',
    '--die-with-parent',
    'bash', '-i'
  ]

  return { binary: 'bwrap', args, useBwrap: true }
}

export class LocalSubprocessService extends SubprocessService {
  declare ctx: Context

  constructor(ctx: Context) {
    super(ctx)
  }

  public async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    return new Promise((resolve) => {
      const targetCwd = options.cwd || process.cwd()
      let binary = 'bash'
      let args = ['-c', command]

      if (this.ctx.sandbox) {
        const mode = this.ctx.settings?.getSandboxMode ? this.ctx.settings.getSandboxMode() : 'workspace-write'
        const confined = this.ctx.sandbox.confine(command, {
          mode,
          workspaceRoot: targetCwd
        })
        binary = confined.binary
        args = confined.args
      } else {
        const fallback = buildBwrapArgs(targetCwd, command)
        binary = fallback.binary
        args = fallback.args
      }

      const child = child_process.spawn(binary, args, {
        shell: false,
        cwd: targetCwd,
        env: {
          ...process.env,
          ...options.env,
          PAGER: 'cat',
          TERM: 'dumb',
          DEBIAN_FRONTEND: 'noninteractive',
          GIT_TERMINAL_PROMPT: '0',
          SUDO_ASKPASS: '/bin/false',
          SSH_ASKPASS: '/bin/false',
          PYTHONUNBUFFERED: '1'
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        signal: options.signal
      })

      // Close stdin immediately so subprocess cannot block waiting for interactive password entry
      try {
        child.stdin?.end()
      } catch {}

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
export const inject = ['sandbox', 'settings']

export function apply(ctx: Context) {
  ctx.set('subprocess', new LocalSubprocessService(ctx))
}

export default LocalSubprocessService

