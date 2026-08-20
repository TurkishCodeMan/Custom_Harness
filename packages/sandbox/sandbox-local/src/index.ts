import fs from 'node:fs'
import path from 'node:path'
import type { Context } from '@custom-harness/core-context'
import {
  SandboxService,
  type SandboxPolicy,
  type ConfinedArgv
} from '@custom-harness/sandbox'

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

export function bwrapProfileArgs(policy: SandboxPolicy): string[] {
  const args = [
    '--ro-bind', '/', '/',
    '--dev', '/dev',
    '--proc', '/proc',
    '--die-with-parent',
    '--unshare-all',
    '--share-net'
  ]

  if (policy.mode === 'workspace-write') {
    args.push('--tmpfs', '/tmp')
    const ws = path.resolve(policy.workspaceRoot || process.cwd())
    if (!fs.existsSync(ws)) {
      try { fs.mkdirSync(ws, { recursive: true }) } catch {}
    }
    args.push('--bind', ws, ws)
    args.push('--chdir', ws)
  } else if (policy.mode === 'read-only') {
    const ws = path.resolve(policy.workspaceRoot || process.cwd())
    args.push('--chdir', ws)
  }

  return args
}

export class LocalSandboxService extends SandboxService {
  constructor(ctx: Context) {
    super(ctx)
  }

  public getAvailableRunners(): string[] {
    const runners: string[] = []
    if (isBwrapAvailable()) runners.push('bwrap')
    return runners
  }

  public confine(command: string, policy: SandboxPolicy): ConfinedArgv {
    if (policy.mode === 'danger-full-access' || !isBwrapAvailable()) {
      return {
        binary: 'bash',
        args: ['-c', command],
        useSandbox: false,
        mode: policy.mode,
        enforcement: policy.mode === 'danger-full-access' ? 'none' : 'partial',
        denialSignatures: ['permission denied', 'operation not permitted', 'read-only file system']
      }
    }

    const bwrapArgs = bwrapProfileArgs(policy)
    bwrapArgs.push('bash', '-c', command)

    return {
      binary: 'bwrap',
      args: bwrapArgs,
      useSandbox: true,
      mode: policy.mode,
      enforcement: 'full',
      denialSignatures: ['read-only file system', 'erofs', 'permission denied']
    }
  }

  public confineInteractive(policy: SandboxPolicy): ConfinedArgv {
    if (policy.mode === 'danger-full-access' || !isBwrapAvailable()) {
      return {
        binary: 'bash',
        args: ['-i'],
        useSandbox: false,
        mode: policy.mode,
        enforcement: policy.mode === 'danger-full-access' ? 'none' : 'partial',
        denialSignatures: ['permission denied', 'operation not permitted', 'read-only file system']
      }
    }

    const bwrapArgs = bwrapProfileArgs(policy)
    bwrapArgs.push('bash', '-i')

    return {
      binary: 'bwrap',
      args: bwrapArgs,
      useSandbox: true,
      mode: policy.mode,
      enforcement: 'full',
      denialSignatures: ['read-only file system', 'erofs', 'permission denied']
    }
  }
}

export const name = 'sandbox-local'
export const inject = []

export function apply(ctx: Context) {
  ctx.set('sandbox', new LocalSandboxService(ctx))
}

export default LocalSandboxService
