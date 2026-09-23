import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'

export function createTraceRouter(ctx: Context): Router {
  const router = Router()

  const getSubagentService = () => {
    return (ctx as any).subagent || (ctx as any).get?.('subagent') || null
  }

  // 1. GET /api/trace/:traceId - Get all subagent tasks and sessions for a trace
  router.get('/trace/:traceId', (req, res) => {
    try {
      const subagentService = getSubagentService()
      const traceId = req.params.traceId

      if (!subagentService) {
        return res.status(503).json({ error: 'Subagent servisi aktif değil' })
      }

      const tasks = subagentService.getTasksByTraceId ? subagentService.getTasksByTraceId(traceId) : []
      const taskDetails = tasks.map((t: any) => {
        let sessionData: any = undefined
        if (t.sessionId && ctx.session?.getSession) {
          sessionData = ctx.session.getSession(t.sessionId)
        }
        return {
          id: t.id,
          traceId: t.traceId,
          parentSessionId: t.parentSessionId,
          taskName: t.taskName,
          taskDescription: t.taskDescription,
          preset: t.preset,
          status: t.status,
          result: t.result,
          toolCalls: t.toolCalls || [],
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          durationMs: t.completedAt ? t.completedAt - t.startedAt : undefined,
          sessionId: t.sessionId,
          session: sessionData
            ? {
                id: sessionData.id,
                title: sessionData.title,
                messageCount: sessionData.messages?.length || 0,
                workspace: sessionData.workspace
              }
            : undefined
        }
      })

      res.json({
        success: true,
        traceId,
        count: taskDetails.length,
        tasks: taskDetails
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. GET /api/trace/:traceId/graph - Format execution as DAG nodes and edges
  router.get('/trace/:traceId/graph', (req, res) => {
    try {
      const subagentService = getSubagentService()
      const traceId = req.params.traceId

      if (!subagentService) {
        return res.status(503).json({ error: 'Subagent servisi aktif değil' })
      }

      const tasks = subagentService.getTasksByTraceId ? subagentService.getTasksByTraceId(traceId) : []

      const nodes = tasks.map((t: any) => ({
        id: t.id,
        traceId: t.traceId,
        parentSessionId: t.parentSessionId,
        label: t.taskName,
        preset: t.preset || 'default',
        status: t.status,
        result: t.result,
        toolCalls: t.toolCalls || [],
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        sessionId: t.sessionId
      }))

      // Create edges based on parentSessionId or sequential execution
      const edges: { source: string; target: string; type: string }[] = []
      for (let i = 0; i < tasks.length; i++) {
        const current = tasks[i]
        if (current.parentSessionId) {
          // Find if another task created this parentSessionId
          const parentTask = tasks.find((p: any) => p.sessionId === current.parentSessionId)
          if (parentTask) {
            edges.push({
              source: parentTask.id,
              target: current.id,
              type: 'subagent_delegation'
            })
            continue
          }
        }
        // If no explicit parent task found and i > 0, link to previous task in same trace
        if (i > 0) {
          edges.push({
            source: tasks[i - 1].id,
            target: current.id,
            type: 'sequence'
          })
        }
      }

      res.json({
        success: true,
        traceId,
        nodes,
        edges
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
