import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface SubagentTask {
  id: string
  taskName: string
  taskDescription: string
  status: 'running' | 'completed' | 'failed'
  result?: string
  startedAt: number
  completedAt?: number
}

export const name = 'subagent'
export const inject = ['agent', 'llm', 'session']

export class SubagentService extends Service {
  private tasks = new Map<string, SubagentTask>()

  constructor(ctx: Context) {
    super(ctx, 'subagent')
  }

  public async spawn(taskName: string, taskDescription: string, cwd?: string): Promise<SubagentTask> {
    const id = `subagent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const task: SubagentTask = {
      id,
      taskName,
      taskDescription,
      status: 'running',
      startedAt: Date.now()
    }
    this.tasks.set(id, task)

    console.log(`[Subagent] Spawning subagent task [${id}]: "${taskName}"`)

    // Asynchronously run the task using the agent loop
    ;(async () => {
      try {
        const session = this.ctx.session.createSession(`Subagent: ${taskName}`, cwd)
        const sessionId = session.id

        // Add subagent goal prompt
        const prompt = `You are an autonomous subagent executing a focused subtask.\nTask: ${taskName}\nDetails: ${taskDescription}\nFocus only on this objective and provide a clean, complete report of your findings/actions.`

        const resultText = await this.ctx.agent.run({
          sessionId,
          prompt
        })

        task.status = 'completed'
        task.result = resultText.trim()
        task.completedAt = Date.now()
        console.log(`[Subagent] Task [${id}] completed successfully in ${(task.completedAt - task.startedAt) / 1000}s`)
      } catch (e: any) {
        task.status = 'failed'
        task.result = `Subagent execution error: ${e.message}`
        task.completedAt = Date.now()
        console.error(`[Subagent] Task [${id}] failed:`, e)
      }
    })()

    return task
  }

  public getTask(id: string): SubagentTask | undefined {
    return this.tasks.get(id)
  }

  public listTasks(): SubagentTask[] {
    return Array.from(this.tasks.values())
  }
}

export function apply(ctx: Context) {
  ctx.set('subagent', new SubagentService(ctx))
}

export default SubagentService
