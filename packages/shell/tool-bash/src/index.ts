import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import { exec } from 'node:child_process'
import path from 'node:path'

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

function globToRegex(glob: string): RegExp {
  let regexStr = '^'
  let i = 0
  while (i < glob.length) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        regexStr += '(?:.*/)?'
        i += 3
      } else {
        regexStr += '.*'
        i += 2
      }
    } else if (c === '*') {
      regexStr += '[^/]*'
      i++
    } else if (c === '?') {
      regexStr += '[^/]'
      i++
    } else if ('./+^$[](){}|'.includes(c)) {
      regexStr += '\\' + c
      i++
    } else {
      regexStr += c
      i++
    }
  }
  regexStr += '$'
  return new RegExp(regexStr, 'i')
}

function matchGlob(pattern: string, targetPath: string): boolean {
  const normTarget = targetPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const normPattern = pattern.replace(/\\/g, '/').replace(/^\/+/, '')

  if (normPattern.endsWith('/**')) {
    const prefix = normPattern.slice(0, -3)
    if (normTarget === prefix || normTarget.startsWith(prefix + '/')) return true
  }

  try {
    return globToRegex(normPattern).test(normTarget)
  } catch {
    return normTarget === normPattern || normTarget.startsWith(normPattern)
  }
}

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
      execute: async ({ command }: { command: string }, context?: { signal?: AbortSignal; cwd?: string; sessionId?: string; activePreset?: any }) => {
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

        // 3. Resolve active preset & enforce FileScope gatekeeper
        let activePreset = context?.activePreset
        const sessionId = context?.sessionId
        if (!activePreset && sessionId && (ctx as any).session?.getSession) {
          const session = (ctx as any).session.getSession(sessionId)
          if (session?.presetId) {
            activePreset = (ctx as any).agentPresets?.get?.(session.presetId) ||
                           (ctx as any).presets?.getPreset?.(session.presetId) ||
                           ctx.settings?.getPreset?.(session.presetId)
          }
        }

        if (activePreset?.fileScope) {
          const fileScope = activePreset.fileScope

          // 3a. Deny checks against command tokens
          if (fileScope.deny && Array.isArray(fileScope.deny) && fileScope.deny.length > 0) {
            for (const denyPattern of fileScope.deny) {
              const cleanPattern = denyPattern.replace(/\/\*\*?$/, '')
              // Check if pattern or base folder appears as a target word in the command
              const denyRegex = new RegExp(`\\b${cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
              if (denyRegex.test(command)) {
                return `[Güvenlik Engeli (DENY SCOPE)]: '${cleanPattern}' dosyasına/dizinine erişim '${activePreset.name || activePreset.id}' koltuğu için kesinlikle yasaklanmıştır.`
              }
            }
          }

          // 3b. Write checks
          const hasWriteScope = Array.isArray(fileScope.write) && fileScope.write.length > 0

          // If preset is completely READ-ONLY (no write scope)
          if (!hasWriteScope) {
            const WRITE_MUTATION_PATTERNS = [
              />\s*[^&|]/,           // Redirection: > or >>
              /\btouch\s+/i,
              /\bmkdir\s+/i,
              /\brm\s+/i,
              /\bmv\s+/i,
              /\bcp\s+/i,
              /\btee\s+/i,
              /\bsed\s+-i/i,
              /open\s*\([^)]*['"][wa]/i,
              /writeFileSync/i
            ]
            for (const pat of WRITE_MUTATION_PATTERNS) {
              if (pat.test(command)) {
                return `[Güvenlik Engeli (READ-ONLY FILE SCOPE)]: '${activePreset.name || activePreset.id}' koltuğunun dosya yazma yetkisi YOKTUR (Salt-Okunur). Terminal üzerinden dosya oluşturma, değiştirme veya silme işlemleri engellenmiştir.`
              }
            }
          } else {
            // Preset HAS a write scope: inspect redirection targets (e.g. `> path/file.txt`)
            const redirectMatch = command.match(/>>\s*([^\s;&|]+)|>\s*([^\s;&|]+)/)
            if (redirectMatch) {
              const targetRaw = redirectMatch[1] || redirectMatch[2]
              if (targetRaw && targetRaw !== '/dev/null') {
                const targetFull = path.resolve(cwd, targetRaw)
                const relTarget = path.relative(path.resolve(cwd), targetFull).replace(/\\/g, '/')
                const isAllowed = fileScope.write.some((pat: string) => matchGlob(pat, relTarget))
                if (!isAllowed) {
                  return `[Güvenlik Engeli (WRITE SCOPE)]: '${relTarget}' yoluna terminal üzerinden yazma yetkiniz YOKTUR. Yalnızca şu yollar altına yazabilirsiniz: ${fileScope.write.join(', ')}`
                }
              }
            }
          }
        }

        const TIMEOUT_MS = 120_000 // 120 saniye sınır

        if (ctx.subprocess) {
          const res = await ctx.subprocess.exec(command, {
            cwd,
            signal: context?.signal as any,
            timeoutMs: TIMEOUT_MS
          })
          if (res.timedOut) {
            return `[Zaman Aşımı / Timeout]: Komut 120 saniye sınırını aştı ve otomatik durduruldu.\n${res.stdout || res.stderr || ''}`
          }
          if (res.exitCode !== 0) {
            return `Komut Hata ile Çıktı (Kod ${res.exitCode}):\n${res.stdout || res.stderr}`
          }
          return res.stdout || res.stderr || 'Komut başarıyla tamamlandı (Çıktı yok).'
        }

        return new Promise((resolve) => {
          const child = exec(command, {
            cwd,
            timeout: TIMEOUT_MS,
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
              if ((err as any).killed && (err as any).signal === 'SIGTERM') {
                return resolve(`[Zaman Aşımı / Timeout]: Komut 120 saniye sınırını aştı ve otomatik durduruldu.`)
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
