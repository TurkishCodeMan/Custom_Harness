import type { Context } from '@custom-harness/core-context'
import { WorkflowEngine, type WorkflowRunOptions, type WorkflowRunResult, type WorkflowStepResult } from '@custom-harness/workflow'

export const name = 'workflow-worker-thread'
export const inject = ['agent', 'session']

export class LocalWorkflowEngine extends WorkflowEngine {
  declare ctx: Context
  constructor(ctx: Context) {
    super(ctx)
  }

  public async execute(options: WorkflowRunOptions): Promise<WorkflowRunResult> {
    const id = options.id || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const startTime = Date.now()
    const stepResults: WorkflowStepResult[] = []

    console.log(`[WorkflowEngine] Starting workflow [${id}]: "${options.name}" with ${options.steps.length} steps`)

    for (let i = 0; i < options.steps.length; i++) {
      if (options.signal?.aborted) {
        return {
          id,
          name: options.name,
          status: 'cancelled',
          stepResults,
          totalElapsedMs: Date.now() - startTime
        }
      }

      const step = options.steps[i]
      const stepStart = Date.now()

      try {
        const session = this.ctx.session.createSession(`Workflow Step: ${step.name}`, step.cwd || options.cwd)
        const output = await this.ctx.agent.run({
          sessionId: session.id,
          prompt: `[WORKFLOW STEP ${i + 1}/${options.steps.length}]: "${step.name}"\n\n${step.prompt}`,
          signal: options.signal
        })

        stepResults.push({
          stepName: step.name,
          status: 'completed',
          output: output.trim(),
          elapsedMs: Date.now() - stepStart
        })
      } catch (err: any) {
        stepResults.push({
          stepName: step.name,
          status: 'failed',
          output: `Adım yürütme hatası: ${err.message}`,
          elapsedMs: Date.now() - stepStart
        })
        return {
          id,
          name: options.name,
          status: 'failed',
          stepResults,
          totalElapsedMs: Date.now() - startTime
        }
      }
    }

    return {
      id,
      name: options.name,
      status: 'completed',
      stepResults,
      totalElapsedMs: Date.now() - startTime
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('workflowEngine', new LocalWorkflowEngine(ctx))
}
