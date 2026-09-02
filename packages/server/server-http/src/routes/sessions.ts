import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'

export function createSessionsRouter(ctx: Context): Router {
  const router = Router()

  // 1. List Sessions (Tenant-Isolated & Client-Filtered)
  router.get('/sessions', (req, res) => {
    const user = req.user!
    const isAdmin = user.role === 'admin'
    const clientType = (req.query.clientType as string) || 'web'
    res.json(ctx.session.listSessions(user.id, isAdmin, clientType))
  })

  // 2. Get Single Session
  router.get('/sessions/:id', (req, res) => {
    const session = ctx.session.getSession(req.params.id)
    if (!session) {
      return res.status(404).json({ error: 'Oturum bulunamadı' })
    }
    res.json(session)
  })

  // 3. Delete Single Session
  router.delete('/sessions/:id', (req, res) => {
    try {
      const user = req.user!
      ctx.session.deleteSession(req.params.id, user.id, user.role === 'admin')
      res.json({ success: true })
    } catch (e: any) {
      res.status(403).json({ error: e.message })
    }
  })

  // 4. Clear All Sessions
  const handleClearSessions = (req: any, res: any) => {
    const user = req.user!
    ctx.session.clearAllSessions(user.id, user.role === 'admin')
    res.json({ success: true })
  }

  router.delete('/sessions', handleClearSessions)
  router.post('/sessions/clear', handleClearSessions)

  // 5. Compact Session
  router.post('/sessions/:id/compact', (req, res) => {
    try {
      const user = req.user!
      const session = ctx.session.getSession(req.params.id)
      if (!session) {
        return res.status(404).json({ error: 'Oturum bulunamadı' })
      }
      if (session.messages.length <= 2) {
        return res.json({ success: true, compacted: false, message: 'Özetlenecek yeterli mesaj bulunmuyor.', messages: session.messages })
      }

      if (ctx.compactor) {
        const resComp = ctx.compactor.compact(session.messages, 6, true)
        if (resComp.compacted) {
          session.messages = resComp.messages
          ctx.session.saveSession(session)
          const measurement = ctx.tokenMeter?.measureSession(session.id)
          return res.json({
            success: true,
            compacted: true,
            prunedCount: resComp.prunedCount || 0,
            summary: resComp.summary,
            messages: session.messages,
            measurement
          })
        }
      }

      res.json({ success: true, compacted: false, messages: session.messages })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 6. Session Context Measurement
  router.get('/sessions/:id/context', (req, res) => {
    const measurement = ctx.tokenMeter.measureSession(req.params.id)
    res.json(measurement)
  })

  return router
}
