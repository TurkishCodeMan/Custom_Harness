import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import type { ScheduleService } from './runtime.js'

export function registerScheduleTools(ctx: Context, service: ScheduleService): Array<() => void> {
  const disposers: Array<() => void> = []

  // 1. schedule_create
  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'schedule_create',
        description: 'Belirli bir süre sonra (after_seconds), belirli bir tarihte (at), periyodik aralıkla (every_seconds) veya cron ifadesiyle (cron) proaktif ajan görevi planlar.',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Zamanı geldiğinde ajana verilecek görev talimatı.'
            },
            after_seconds: {
              type: 'number',
              description: 'Kaç saniye sonra çalışacağı (Örn: 60, 3600, 172800 = 48 saat).'
            },
            at: {
              type: 'string',
              description: 'Belirli bir çalışma tarihi/saati (ISO 8601 formatı, örn: "2026-09-20T09:00:00Z").'
            },
            every_seconds: {
              type: 'number',
              description: 'Kaç saniyede bir tekrarlanacağı (Örn: 21600 = 6 saatte bir).'
            },
            cron: {
              type: 'string',
              description: 'Cron zamanlama ifadesi (Örn: "0 9 * * 1-5" - Hafta içi her sabah 09:00, "0 9 * * *" - Her sabah 09:00).'
            },
            preset: {
              type: 'string',
              description: 'Görevi yürütecek ajan koltuğu / rolü (Örn: "novatrend-cfo", "novatrend-tedarik", "novatrend-kalite").'
            },
            workspace: {
              type: 'string',
              description: 'Görevin çalıştırılacağı çalışma dizini (varsayılan: aktif çalışma alanı).'
            },
            reuse_session: {
              type: 'boolean',
              description: 'Görevin mevcut sohbet oturumunda mı çalıştırılacağı (varsayılan: false - her görev için izole, bağımsız bir oturum açılır).'
            }
          },
          required: ['prompt']
        },
        execute: async (params: any, context?: any) => {
          try {
            const currentWorkspace = context?.cwd || ctx.session?.getActiveSession?.()?.workspace || process.cwd()
            const currentPreset = context?.activePreset || (ctx.session?.getActiveSession?.() as any)?.preset || (ctx.settings?.getSettings?.() as any)?.activePreset
            const shouldReuse = params.reuse_session === true
            const record = service.create({
              prompt: params.prompt,
              after_seconds: params.after_seconds,
              at: params.at,
              every_seconds: params.every_seconds,
              cron: params.cron,
              preset: params.preset || currentPreset,
              workspace: params.workspace || currentWorkspace,
              sessionId: shouldReuse ? (context?.sessionId || ctx.session?.getActiveSession?.()?.id) : undefined,
              reuseSession: shouldReuse,
              userId: context?.userId || 'system'
            })

            const targetDateStr = new Date(record.targetTime).toLocaleString('tr-TR', { timeZoneName: 'short' })
            return `✅ Zamanlanmış Görev Başarıyla Oluşturuldu:
- ID: \`${record.id}\`
- Tür: **${record.type.toUpperCase()}** ${record.cronExpression ? `(\`${record.cronExpression}\`)` : ''}
- İlk Çalışma Zamanı: **${targetDateStr}**
- Görevli Koltuk: **${record.preset || 'Genel Asistan'}**
- Talimat: "${record.prompt}"`
          } catch (e: any) {
            return `❌ Plan oluşturulamadı: ${e.message}`
          }
        }
      })
    )
  )

  // 2. schedule_list
  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'schedule_list',
        description: 'Sistemde kayıtlı aktif ve geçmiş zamanlanmış görevleri listeler.',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'triggered', 'cancelled'],
              description: 'Filtrelenecek durum (varsayılan: tümü).'
            }
          }
        },
        execute: async (params: any) => {
          const list = service.list({ status: params.status })
          if (list.length === 0) {
            return 'Kayıtlı bir zamanlanmış görev bulunmuyor.'
          }

          const now = Date.now()
          const rows = list.map(r => {
            const nextDate = new Date(r.targetTime).toLocaleString('tr-TR')
            const diffSec = Math.round((r.targetTime - now) / 1000)
            const remaining = diffSec > 0 ? `${diffSec} sn sonra` : 'Zamanı geldi / Geçti'
            return `- **[${r.id}]** (${r.status.toUpperCase()} | ${r.type.toUpperCase()})
  - Hedef: ${nextDate} (${remaining})
  - Koltuk: \`${r.preset || 'varsayılan'}\`
  - Tetiklenme Sayısı: ${r.triggerCount}
  - Görev: "${r.prompt}"`
          }).join('\n\n')

          return `### 📅 Kayıtlı Zamanlanmış Görevler (${list.length}):\n\n${rows}`
        }
      })
    )
  )

  // 3. schedule_delete
  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'schedule_delete',
        description: 'Belirtilen ID\'ye sahip zamanlanmış görevi iptal eder ve siler.',
        parameters: {
          type: 'object',
          properties: {
            schedule_id: {
              type: 'string',
              description: 'Silinecek görevin ID\'si (Örn: "sch-xxxx-xxxx").'
            }
          },
          required: ['schedule_id']
        },
        execute: async ({ schedule_id }: { schedule_id: string }) => {
          const success = service.delete(schedule_id.trim())
          if (success) {
            return `✅ [${schedule_id}] ID'li zamanlanmış görev başarıyla iptal edildi ve silindi.`
          }
          return `⚠️ [${schedule_id}] ID'li zamanlanmış görev bulunamadı.`
        }
      })
    )
  )

  return disposers
}
