import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-workflow'
export const inject = ['tools', 'workflowEngine']

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'execute_workflow',
      description: 'Executes a multi-step orchestrated workflow where each step runs in a clean focused agent execution.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the workflow (e.g. "Full Stack Refactor", "Multi-file Migration").'
          },
          steps: {
            type: 'array',
            description: 'Ordered list of steps to execute.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Step name' },
                prompt: { type: 'string', description: 'Step instruction prompt' }
              },
              required: ['name', 'prompt']
            }
          }
        },
        required: ['name', 'steps']
      },
      async execute({ name, steps }: { name: string; steps: { name: string; prompt: string }[] }, exec?: { cwd?: string }) {
        try {
          const res = await ctx.workflowEngine.execute({
            name,
            steps,
            cwd: exec?.cwd
          })

          let formatted = `### 🔄 İş Akışı Tamamlandı: "${res.name}" (Durum: ${res.status.toUpperCase()})\n`
          formatted += `*Toplam Süre:* ${(res.totalElapsedMs / 1000).toFixed(1)}s\n\n`

          res.stepResults.forEach((step, idx) => {
            formatted += `#### [Adım ${idx + 1}] ${step.stepName} (${(step.elapsedMs / 1000).toFixed(1)}s - ${step.status})\n`
            formatted += `${step.output}\n\n---\n\n`
          })

          return formatted.trim()
        } catch (err: any) {
          return `[Hata]: İş akışı çalıştırılamadı: ${err.message}`
        }
      }
    })
  )
}
