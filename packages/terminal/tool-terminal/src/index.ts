import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-terminal'
export const inject = ['tools', 'terminals']

export function apply(ctx: Context) {
  // 1. terminal_spawn
  ctx.tools.register(
    defineTool({
      name: 'terminal_spawn',
      description: 'Creates a new persistent interactive terminal session that keeps state across multiple commands.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Optional friendly name for the terminal session (e.g. "Dev Server", "Database CLI").'
          },
          cwd: {
            type: 'string',
            description: 'Starting working directory for the terminal.'
          }
        },
        required: []
      },
      async execute({ name, cwd }: { name?: string; cwd?: string }) {
        try {
          const info = await ctx.terminals.spawn(name, cwd)
          return `### 💻 Yeni İnteraktif Terminal Açıldı
- **Terminal ID:** \`${info.id}\`
- **İsim:** ${info.name}
- **Dizin:** \`${info.cwd}\`

Bu terminale komut göndermek için \`terminal_send\` aracını kullanabilirsiniz.`
        } catch (err: any) {
          return `[Hata]: Terminal başlatılamadı: ${err.message}`
        }
      }
    })
  )

  // 2. terminal_send
  ctx.tools.register(
    defineTool({
      name: 'terminal_send',
      description: 'Sends command text to an active persistent terminal session and waits for output.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The Terminal Session ID to send the command to.'
          },
          text: {
            type: 'string',
            description: 'Command line text to run in the terminal.'
          },
          submit: {
            type: 'boolean',
            description: 'Whether to append newline and submit the command (default: true).'
          },
          timeoutMs: {
            type: 'integer',
            description: 'Timeout in milliseconds to wait for command output (default: 30000).'
          }
        },
        required: ['sessionId', 'text']
      },
      async execute({ sessionId, text, submit, timeoutMs }: { sessionId: string; text: string; submit?: boolean; timeoutMs?: number }) {
        try {
          const res = await ctx.terminals.send(sessionId, text, submit !== false, timeoutMs || 30000)
          return `### 🖥️ Terminal Çıktısı (\`${sessionId}\`):\n\`\`\`bash\n${res.output || '(Çıktı üretilmedi)'}\n\`\`\``
        } catch (err: any) {
          return `[Hata]: Terminal komutu çalıştırılamadı: ${err.message}`
        }
      }
    })
  )

  // 3. terminal_read
  ctx.tools.register(
    defineTool({
      name: 'terminal_read',
      description: 'Reads recent screen output from an active terminal session without sending input.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'The Terminal Session ID to read.'
          },
          tailBytes: {
            type: 'integer',
            description: 'Maximum bytes to read from buffer (default: 16384).'
          }
        },
        required: ['sessionId']
      },
      async execute({ sessionId, tailBytes }: { sessionId: string; tailBytes?: number }) {
        try {
          const text = ctx.terminals.read(sessionId, tailBytes || 16384)
          return `### 📜 Terminal Ekranı (\`${sessionId}\`):\n\`\`\`\n${text || '(Boş ekran)'}\n\`\`\``
        } catch (err: any) {
          return `[Hata]: Terminal okunamadı: ${err.message}`
        }
      }
    })
  )

  // 4. terminal_list
  ctx.tools.register(
    defineTool({
      name: 'terminal_list',
      description: 'Lists all open persistent terminal sessions and their active status.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      async execute() {
        try {
          const list = ctx.terminals.list()
          if (list.length === 0) {
            return 'Açık hiçbir kalıcı terminal oturumu bulunmuyor.'
          }

          let formatted = `### 💻 Açık Terminaller (${list.length} Oturum):\n\n`
          list.forEach((t, idx) => {
            formatted += `**[${idx + 1}] \`${t.id}\` - ${t.name}**\n`
            formatted += `- **Dizin:** \`${t.cwd}\`\n`
            formatted += `- **Durum:** ${t.alive ? '🟢 Canlı / Aktif' : '🔴 Sonlandı'}\n\n`
          })

          return formatted.trim()
        } catch (err: any) {
          return `[Hata]: Terminal listesi alınamadı: ${err.message}`
        }
      }
    })
  )
}
