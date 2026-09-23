import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'
import { ScheduleService } from '@custom-harness/schedule'

export function createSchedulesRouter(ctx: Context): Router {
  const router = Router()

  const safeGetSchedule = () => {
    try {
      return (ctx as any).schedule || (ctx as any).get?.('schedule') || (ctx as any).root?.schedule || ScheduleService.getInstance(ctx) || null
    } catch {
      return ScheduleService.getInstance(ctx) || null
    }
  }

  // 1. GET /api/schedules
  router.get('/schedules', (req, res) => {
    try {
      const scheduleService = safeGetSchedule()
      if (!scheduleService) return res.status(503).json({ error: 'Schedule servisi aktif değil' })
      const status = req.query.status as any
      const list = scheduleService.list({ status })
      res.json({ schedules: list })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. POST /api/schedules
  router.post('/schedules', (req, res) => {
    try {
      const scheduleService = safeGetSchedule()
      if (!scheduleService) return res.status(503).json({ error: 'Schedule servisi aktif değil' })
      const { prompt, after_seconds, at, every_seconds, cron, preset, workspace } = req.body
      if (!prompt) return res.status(400).json({ error: 'prompt alanı zorunludur' })

      const record = scheduleService.create({
        prompt,
        after_seconds: typeof after_seconds === 'number' ? after_seconds : (after_seconds ? Number(after_seconds) : undefined),
        at,
        every_seconds: typeof every_seconds === 'number' ? every_seconds : (every_seconds ? Number(every_seconds) : undefined),
        cron,
        preset,
        workspace: workspace || process.cwd(),
        userId: (req as any).user?.id || 'system'
      })

      res.json({ success: true, schedule: record })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 3. DELETE /api/schedules/:id
  router.delete('/schedules/:id', (req, res) => {
    try {
      const scheduleService = safeGetSchedule()
      if (!scheduleService) return res.status(503).json({ error: 'Schedule servisi aktif değil' })
      const success = scheduleService.delete(req.params.id)
      res.json({ success })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 4. POST /api/schedules/:id/trigger
  router.post('/schedules/:id/trigger', async (req, res) => {
    try {
      const scheduleService = safeGetSchedule()
      if (!scheduleService) return res.status(503).json({ error: 'Schedule servisi aktif değil' })
      const id = req.params.id
      console.log(`⚡ [API] POST /api/schedules/${id}/trigger çağrıldı`)
      const success = await scheduleService.triggerNow(id)
      res.json({ success })
    } catch (e: any) {
      console.error(`❌ [API] POST /api/schedules/${req.params.id}/trigger hata:`, e)
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
