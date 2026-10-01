import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'

export function createInspectorRouter(ctx: Context): Router {
  const router = Router()

  const getInspectorService = () => {
    return ctx.inspector || (ctx as any).get?.('inspector') || null
  }

  // 1. GET /api/debug/inspector/latest/:sessionId - Get the active or most recent LLM turn payload & context
  router.get('/inspector/latest/:sessionId', async (req, res) => {
    try {
      const inspector = getInspectorService()
      if (!inspector) {
        return res.status(503).json({ error: 'Inspector servisi aktif değil' })
      }

      const sessionId = req.params.sessionId
      const snapshot = await inspector.getLatest(sessionId)

      if (!snapshot) {
        return res.status(404).json({
          success: false,
          error: `Oturum için (${sessionId}) henüz kaydedilmiş bir context veya LLM payload'ı bulunamadı.`
        })
      }

      res.json({
        success: true,
        sessionId,
        snapshot
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. GET /api/debug/inspector/turns/:sessionId - Get all turns for a session
  router.get('/inspector/turns/:sessionId', async (req, res) => {
    try {
      const inspector = getInspectorService()
      if (!inspector) {
        return res.status(503).json({ error: 'Inspector servisi aktif değil' })
      }

      const sessionId = req.params.sessionId
      const turns = (await inspector.getSessionTurns(sessionId)) || []

      res.json({
        success: true,
        sessionId,
        count: turns.length,
        turns
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 3. GET /api/debug/inspector/turn/:turnId - Get a specific snapshot by ID
  router.get('/inspector/turn/:turnId', async (req, res) => {
    try {
      const inspector = getInspectorService()
      if (!inspector) {
        return res.status(503).json({ error: 'Inspector servisi aktif değil' })
      }

      const turn = await inspector.getTurn(req.params.turnId)
      if (!turn) {
        return res.status(404).json({ error: 'Belirtilen turn ID bulunamadı' })
      }

      res.json({ success: true, turn })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 4. GET /api/debug/inspector/query - Search snapshots across sessions
  router.get('/inspector', async (req, res) => {
    try {
      const inspector = getInspectorService()
      if (!inspector) {
        return res.status(503).json({ error: 'Inspector servisi aktif değil' })
      }

      const { sessionId, presetId, status, from, to, limit } = req.query
      const turns = (await inspector.query({
        sessionId: sessionId as string,
        presetId: presetId as string,
        status: status as any,
        from: from ? Number(from) : undefined,
        to: to ? Number(to) : undefined,
        limit: limit ? Number(limit) : 50
      })) || []

      res.json({ success: true, count: turns.length, turns })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 5. DELETE /api/debug/inspector/:sessionId - Clear snapshots
  router.delete('/inspector/:sessionId', async (req, res) => {
    try {
      const inspector = getInspectorService()
      if (!inspector) {
        return res.status(503).json({ error: 'Inspector servisi aktif değil' })
      }

      await inspector.clear(req.params.sessionId)
      res.json({ success: true, message: `Oturum (${req.params.sessionId}) snapshotları temizlendi.` })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
