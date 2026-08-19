import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import { exec } from 'node:child_process'

export const name = 'plugin-bash'
export const inject = ['tools', 'subprocess']

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'bash',
      description: 'Run shell commands in the terminal (such as git diff, grep, find). Note: To read files use `read_file`, and to edit files use `edit_file`.',
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
            signal: context?.signal
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
