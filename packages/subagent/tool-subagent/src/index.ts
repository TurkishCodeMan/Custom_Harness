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
        'Delegates an autonomous subtask to a focused subagent with a specific role/preset. Executes to completion and directly returns the subagent findings/report.',
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
          },
          preset: {
            type: 'string',
            description: 'Optional preset to run as subagent (e.g. "novatrend-tedarik", "novatrend-kalite", "Full-Stack Developer").'
          },
          traceId: {
            type: 'string',
            description: 'Optional trace ID for A2A chain tracing and DAG tracking. Propagated through the delegation tree.'
          },
          parentSessionId: {
            type: 'string',
            description: 'Optional parent session ID delegating this task.'
          },
          runInBackground: {
            type: 'boolean',
            description: 'If true, spawns in background and returns taskId immediately. Defaults to false (synchronous execution).'
          }
        },
        required: ['taskName', 'taskDescription']
      },
      async execute(
        {
          taskName,
          taskDescription,
          preset,
          traceId,
          parentSessionId,
          runInBackground
        }: {
          taskName: string
          taskDescription: string
          preset?: string
          traceId?: string
          parentSessionId?: string
          runInBackground?: boolean
        },
        exec?: { cwd?: string; sessionId?: string }
      ) {
        const effectiveParentSessionId = parentSessionId || exec?.sessionId
        const options = { parentSessionId: effectiveParentSessionId, traceId }

        if (runInBackground) {
          const task = ctx.subagent.spawn(taskName, taskDescription, exec?.cwd, preset, options)
          return JSON.stringify({
            status: 'spawned',
            taskId: task.id,
            traceId: task.traceId,
            sessionId: task.sessionId,
            preset: preset || 'default',
            message: `Subagent '${taskName}' launched in background with preset '${preset || 'default'}'. Use check_subagent to retrieve progress and results.`
          })
        }

        // Synchronous Atlantic-style execution
        const completedTask = await ctx.subagent.execute(taskName, taskDescription, exec?.cwd, preset, options)
        const durationSeconds = completedTask.completedAt ? Math.round((completedTask.completedAt - completedTask.startedAt) / 100) / 10 : undefined

        return JSON.stringify({
          status: completedTask.status,
          taskId: completedTask.id,
          traceId: completedTask.traceId,
          sessionId: completedTask.sessionId,
          taskName: completedTask.taskName,
          preset: preset || 'default',
          toolCallsCount: completedTask.toolCalls?.length || 0,
          durationSeconds,
          result: completedTask.result
        }, null, 2)
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
