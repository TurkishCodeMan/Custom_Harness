import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import { exec } from 'node:child_process'

export const name = 'plugin-bash'
export const inject = ['tools', 'subprocess']

const DANGEROUS_COMMANDS = [
  /\bsudo\b/i,
  /\bsu\s+/i,
  /\bchroot\b/i,
  /\bsystemctl\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\binit\s+\d/i,
  /\bmkfs\b/i
]

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'bash',
      description: 'Run shell commands strictly inside the workspace directory (such as git, pytest, python, npm). Note: sudo and root-level commands are blocked.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute.'
          }
        },
        required: ['command']
      },
      execute: async ({ command }: { command: string }, context?: { signal?: AbortSignal; cwd?: string }) => {
        const cwd = context?.cwd || process.cwd()

        // 1. Guard against sudo / root commands
        for (const pattern of DANGEROUS_COMMANDS) {
          if (pattern.test(command)) {
            return `[Güvenlik Engeli]: 'sudo' veya sistem seviyesi yetkili komutlar güvenlik nedeniyle engellenmiştir. Komutlarınızı yalnızca çalışma alanınız (${cwd}) içinde çalıştırabilirsiniz.`
          }
        }

        // 2. Prevent destructive recursive delete on root or home
        if (/\brm\s+-[rfRF]{1,4}\s+(\/|\/\*|~|\$HOME|\.\.\/)/.test(command)) {
          return `[Güvenlik Engeli]: Kök dizin veya çalışma alanı dışı silme komutları engellenmiştir.`
        }

        if (ctx.subprocess) {
          const res = await ctx.subprocess.exec(command, { cwd, signal: context?.signal as any })
          if (res.exitCode !== 0) {
            return `Komut Hata ile Çıktı (Kod ${res.exitCode}):\n${res.stdout || res.stderr}`
          }
          return res.stdout || res.stderr || 'Komut başarıyla tamamlandı (Çıktı yok).'
        }
        return new Promise((resolve) => {
          const child = exec(command, {
            cwd,
            timeout: 60000,
            maxBuffer: 1024 * 1024 * 10,
            signal: context?.signal,
            env: {
              ...process.env,
              PAGER: 'cat',
              DEBIAN_FRONTEND: 'noninteractive',
              GIT_TERMINAL_PROMPT: '0',
              PYTHONUNBUFFERED: '1'
            }
          }, (err, stdout, stderr) => {
            if (err) {
              if (context?.signal?.aborted) {
                return resolve('[Komut kullanıcı tarafından durduruldu]')
              }
              const output = (stdout ? stdout + '\n' : '') + (stderr ? stderr + '\n' : '')
              return resolve(`Komut Hata ile Çıktı (Kod ${err.code || 1}):\n${output || err.message}`)
            }
            const output = stdout || stderr || 'Komut başarıyla tamamlandı (Çıktı yok).'
            resolve(output)
          })
        })
      }
    })
  )
}
