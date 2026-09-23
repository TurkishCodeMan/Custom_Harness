import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { ToolCallTrace } from './a2a-protocol.js'

export * from './a2a-protocol.js'

export interface SubagentTask {
  id: string
  traceId: string
  parentSessionId?: string
  taskName: string
  taskDescription: string
  preset?: string
  status: 'running' | 'completed' | 'failed'
  result?: string
  toolCalls: ToolCallTrace[]
  startedAt: number
  completedAt?: number
  sessionId?: string
  promise?: Promise<SubagentTask>
}

export const name = 'subagent'
export const inject = ['agent', 'llm', 'session']

export class SubagentService extends Service {
  private tasks = new Map<string, SubagentTask>()

  constructor(ctx: Context) {
    super(ctx, 'subagent')
  }

  public spawn(
    taskName: string,
    taskDescription: string,
    cwd?: string,
    presetId?: string,
    options?: { parentSessionId?: string; traceId?: string }
  ): SubagentTask {
    const id = `subagent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const traceId = options?.traceId || `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const parentSessionId = options?.parentSessionId

    let resolvePromise!: (task: SubagentTask) => void
    const promise = new Promise<SubagentTask>((resolve) => {
      resolvePromise = resolve
    })

    const task: SubagentTask = {
      id,
      traceId,
      parentSessionId,
      taskName,
      taskDescription,
      preset: presetId,
      status: 'running',
      toolCalls: [],
      startedAt: Date.now(),
      promise
    }
    this.tasks.set(id, task)

    console.log(`[Subagent] Spawning subagent task [${id}] (Trace: ${traceId}): "${taskName}" (Preset: ${presetId || 'default'})`)
    ;(this.ctx as any).emit?.('subagent/spawn', task)

    // Asynchronously run the task using the agent loop
    ;(async () => {
      let sessionId: string | undefined
      try {
        // Create session - keep for replay/trace, marked as subagent trace
        const session = this.ctx.session.createSession(`[Trace] ${taskName}`, cwd, undefined, 'web', false, false)
        sessionId = session.id
        task.sessionId = sessionId
        ;(session as any).isSubagentTrace = true
        ;(session as any).traceId = traceId
        ;(session as any).parentSessionId = parentSessionId
        ;(session as any).subagentTaskId = id
        if (this.ctx.session?.saveSession) {
          this.ctx.session.saveSession(session)
        }

        // Add subagent goal prompt
        const prompt = `You are an autonomous subagent executing a focused subtask.\nTask: ${taskName}\nDetails: ${taskDescription}\nTrace ID: ${traceId}\nFocus only on this objective and provide a clean, complete report of your findings/actions.`

        let resultText = await this.ctx.agent.run({
          sessionId,
          prompt,
          presetId,
          onToolStart: (call) => {
            const toolTrace: ToolCallTrace = {
              toolName: call.name,
              args: call.args,
              timestamp: Date.now(),
              status: 'running'
            }
            task.toolCalls.push(toolTrace)
            ;(this.ctx as any).emit?.('subagent/tool_start', { taskId: id, traceId, toolCall: toolTrace })
          },
          onToolResult: (res) => {
            const toolTrace = task.toolCalls.find(t => t.toolName === res.name && t.status === 'running')
            if (toolTrace) {
              toolTrace.result = typeof res.output === 'string' ? res.output : JSON.stringify(res.output)
              toolTrace.status = 'completed'
            }
            ;(this.ctx as any).emit?.('subagent/tool_result', { taskId: id, traceId, result: res })
          }
        })

        if (!resultText || !resultText.trim()) {
          const session = this.ctx.session.getSession(sessionId)
          const lastMsg = session?.messages?.[session.messages.length - 1]
          if (lastMsg?.content?.trim()) {
            resultText = lastMsg.content.trim()
          } else if (lastMsg?.reasoning_content?.trim()) {
            resultText = lastMsg.reasoning_content.trim()
          }
        }

        task.status = 'completed'
        task.result = resultText?.trim() || 'Subagent execution finished without output.'
        task.completedAt = Date.now()
        console.log(`[Subagent] Task [${id}] completed successfully in ${(task.completedAt - task.startedAt) / 1000}s`)
        ;(this.ctx as any).emit?.('subagent/completed', task)
      } catch (e: any) {
        task.status = 'failed'
        task.result = `Subagent execution error: ${e.message}`
        task.completedAt = Date.now()
        console.error(`[Subagent] Task [${id}] failed:`, e)
        ;(this.ctx as any).emit?.('subagent/completed', task)
      } finally {
        // Retain session for audit & replay, update status in title
        if (sessionId) {
          try {
            const s = this.ctx.session.getSession(sessionId)
            if (s) {
              s.title = `[Trace ${task.status === 'completed' ? '✓' : '✗'}] ${taskName}`
              ;(s as any).subagentStatus = task.status
              ;(s as any).subagentCompletedAt = task.completedAt
              if (this.ctx.session?.saveSession) {
                this.ctx.session.saveSession(s)
              }
            }
          } catch {}
        }
        resolvePromise(task)
      }
    })()

    return task
  }

  public async execute(
    taskName: string,
    taskDescription: string,
    cwd?: string,
    presetId?: string,
    options?: { parentSessionId?: string; traceId?: string }
  ): Promise<SubagentTask> {
    const task = this.spawn(taskName, taskDescription, cwd, presetId, options)
    return task.promise!
  }

  public getTask(id: string): SubagentTask | undefined {
    return this.tasks.get(id)
  }

  public getTasksByTraceId(traceId: string): SubagentTask[] {
    return Array.from(this.tasks.values()).filter(t => t.traceId === traceId)
  }

  public listTasks(): SubagentTask[] {
    return Array.from(this.tasks.values())
  }
}

export function apply(ctx: Context) {
  ctx.set('subagent', new SubagentService(ctx))
}

export default SubagentService
