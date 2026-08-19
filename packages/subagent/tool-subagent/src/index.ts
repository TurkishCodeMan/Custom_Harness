import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-subagent'
export const inject = ['tools', 'subagent']

export function apply(ctx: Context) {
  // 1. invoke_subagent tool
  ctx.tools.register(
    defineTool({
      name: 'invoke_subagent',
      description:
        'Spawns a focused background subagent to execute an autonomous subtask (e.g. extensive research, documentation inspection, testing). Returns a task ID.',
      parameters: {
        type: 'object',
        properties: {
          taskName: {
            type: 'string',
            description: 'Short title for the task.'
          },
          taskDescription: {
            type: 'string',
            description: 'Comprehensive, actionable instructions and context for the subagent.'
          }
        },
        required: ['taskName', 'taskDescription']
      },
      async execute({ taskName, taskDescription }: { taskName: string; taskDescription: string }, exec?: { cwd?: string }) {
        const task = await ctx.subagent.spawn(taskName, taskDescription, exec?.cwd)
        return JSON.stringify({
          status: 'spawned',
          taskId: task.id,
          message: `Subagent '${taskName}' launched in background. Use check_subagent to retrieve progress and results.`
        })
      }
    })
  )

  // 2. check_subagent tool
  ctx.tools.register(
    defineTool({
      name: 'check_subagent',
      description: 'Checks the status and result of a previously spawned subagent task.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The task ID returned by invoke_subagent.'
          }
        },
        required: ['taskId']
      },
      async execute({ taskId }: { taskId: string }) {
        const task = ctx.subagent.getTask(taskId)
        if (!task) {
          return `Subagent task not found: ${taskId}`
        }

        return JSON.stringify({
          taskId: task.id,
          taskName: task.taskName,
          status: task.status,
          result: task.result || 'Task is still running...'
        }, null, 2)
      }
    })
  )
}
