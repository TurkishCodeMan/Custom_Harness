import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-jobs'
export const inject = ['tools', 'jobs']

export function apply(ctx: Context) {
  // 1. start_job
  ctx.tools.register(
    defineTool({
      name: 'start_job',
      description: 'Launches a long-running background command (e.g. dev server, build, test suite, file watcher) without blocking the conversation.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Short descriptive label for this job (e.g. "vite dev server", "pytest test suite").'
          },
          command: {
            type: 'string',
            description: 'Shell command line string to execute in the background.'
          },
          cwd: {
            type: 'string',
            description: 'Working directory for the job (defaults to current workspace).'
          }
        },
        required: ['name', 'command']
      },
      async execute({ name, command, cwd }: { name: string; command: string; cwd?: string }, exec?: { cwd?: string }) {
        try {
          const snapshot = await ctx.jobs.start({
            name,
            command,
            cwd: cwd || exec?.cwd
          })
          return `### ⏱️ Arka Plan İşi Başlatıldı (Background Job)
- **Job ID:** \`${snapshot.id}\`
- **İsim:** ${snapshot.name}
- **Komut:** \`${snapshot.command}\`
- **Durum:** ${snapshot.status.toUpperCase()}

İşi takip etmek için \`job_logs\` veya listelemek için \`list_jobs\` aracını kullanabilirsiniz.`
        } catch (err: any) {
          return `[Hata]: Arka plan işi başlatılamadı: ${err.message}`
        }
      }
    })
  )

  // 2. list_jobs
  ctx.tools.register(
    defineTool({
      name: 'list_jobs',
      description: 'Lists all background jobs with their IDs, execution status, elapsed time, and exit codes.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      async execute() {
        try {
          const list = ctx.jobs.list()
          if (list.length === 0) {
            return 'Şu anda kayıtlı veya çalışan hiçbir arka plan işi bulunmuyor.'
          }

          let formatted = `### 📋 Arka Plan İşleri Listesi (${list.length} İş):\n\n`
          list.forEach((job, idx) => {
            const elapsed = job.completedAt ? `${((job.completedAt - job.startedAt) / 1000).toFixed(1)}s` : `${((Date.now() - job.startedAt) / 1000).toFixed(1)}s (çalışıyor)`
            formatted += `**[${idx + 1}] \`${job.id}\` - ${job.name}**\n`
            formatted += `- **Durum:** \`${job.status.toUpperCase()}\` | **Süre:** ${elapsed}\n`
            formatted += `- **Komut:** \`${job.command}\`\n\n`
          })

          return formatted.trim()
        } catch (err: any) {
          return `[Hata]: İş listesi alınamadı: ${err.message}`
        }
      }
    })
  )

  // 3. job_logs
  ctx.tools.register(
    defineTool({
      name: 'job_logs',
      description: 'Retrieves terminal stdout/stderr logs for a running or completed background job by its Job ID.',
      parameters: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The unique ID of the background job.'
          },
          tailLines: {
            type: 'integer',
            description: 'Number of recent lines to retrieve (default: 80).'
          }
        },
        required: ['jobId']
      },
      async execute({ jobId, tailLines }: { jobId: string; tailLines?: number }) {
        try {
          const logs = ctx.jobs.getLogs(jobId, tailLines || 80)
          return `### 📜 Job Günlüğü (\`${jobId}\`):\n\`\`\`\n${logs}\n\`\`\``
        } catch (err: any) {
          return `[Hata]: Loglar alınamadı: ${err.message}`
        }
      }
    })
  )

  // 4. kill_job
  ctx.tools.register(
    defineTool({
      name: 'kill_job',
      description: 'Terminates and cancels a running background job by its Job ID.',
      parameters: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The unique ID of the background job to kill.'
          }
        },
        required: ['jobId']
      },
      async execute({ jobId }: { jobId: string }) {
        try {
          const success = await ctx.jobs.kill(jobId)
          if (success) {
            return `✅ Arka plan işi (\`${jobId}\`) başarıyla sonlandırıldı (Killed).`
          }
          return `⚠️ Arka plan işi (\`${jobId}\`) sonlandırılamadı veya zaten durmuş durumda.`
        } catch (err: any) {
          return `[Hata]: İş sonlandırılamadı: ${err.message}`
        }
      }
    })
  )
}
