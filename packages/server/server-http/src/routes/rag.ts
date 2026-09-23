import { Router, type RequestHandler } from 'express'
import type { Context } from '@custom-harness/core-context'
import { requireAdmin } from '../middleware/auth.js'

export function createRagRouter(ctx: Context): Router {
  const router = Router()

  // Middleware: Ensures RAG service is loaded and preloads onto req.rag
  const requireRagService: RequestHandler = (req: any, res, next) => {
    const rag = (ctx.root as any)?.rag || (ctx as any)?.rag || (ctx as any)?.get?.('rag')
    if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
    req.rag = rag
    next()
  }

  router.use(requireRagService)

  // 1. RAG Status
  router.get('/rag/status', async (req: any, res) => {
    try {
      const caller = req.user!
      const status = await req.rag.getStatus(caller.id, caller.role === 'admin')
      res.json(status)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. Index Folder
  router.post('/rag/index', async (req: any, res) => {
    try {
      const caller = req.user!
      const { path: folderPath, config } = req.body
      if (!folderPath) return res.status(400).json({ error: 'folderPath is required' })
      const source = await req.rag.addAndIndexFolder(folderPath, config, caller.id)
      res.json({ success: true, source })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 3. Update Permissions (Admin Only)
  router.post('/rag/permissions', requireAdmin(ctx), async (req: any, res) => {
    try {
      const { sourceId, allowedUserIds, isPublic } = req.body
      if (!sourceId) return res.status(400).json({ error: 'sourceId is required' })
      await req.rag.updateSourcePermissions(sourceId, allowedUserIds || ['*'], isPublic !== false)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 4. Search
  router.post('/rag/search', async (req: any, res) => {
    try {
      const caller = req.user!
      const { query, topK, filePathPrefix } = req.body
      if (!query) return res.status(400).json({ error: 'query is required' })
      const results = await req.rag.search({ query, topK, filePathPrefix }, caller.id, caller.role === 'admin')
      res.json({ results })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 5. Search Images
  router.post('/rag/search-images', async (req: any, res) => {
    try {
      const caller = req.user!
      const { textQuery, imagePath, topK } = req.body
      if (!textQuery && !imagePath) return res.status(400).json({ error: 'textQuery or imagePath is required' })
      const results = await req.rag.searchImages({ textQuery, imagePath, topK }, caller.id, caller.role === 'admin')
      res.json({ results })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 6. Remove Folder (Tenant Ownership Enforced)
  router.post('/rag/remove', async (req: any, res) => {
    try {
      const caller = req.user!
      const { id, path: folderPath } = req.body
      const target = id || folderPath
      if (!target) return res.status(400).json({ error: 'id or path is required' })

      if (caller.role !== 'admin') {
        const status = await req.rag.getStatus(caller.id, false)
        const isOwner = status.sources?.some((s: any) => (s.id === target || s.path === target) && s.ownerId === caller.id)
        if (!isOwner) {
          return res.status(403).json({ error: 'Bu RAG kaynağını silme yetkiniz bulunmuyor.' })
        }
      }

      await req.rag.removeFolder(target)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 7. Clear All (Admin Only)
  router.post('/rag/clear', requireAdmin(ctx), async (req: any, res) => {
    try {
      await req.rag.clearAll()
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 8. RAG Mode Toggle
  router.post('/rag/mode', (req: any, res) => {
    try {
      const { enabled } = req.body
      req.rag.setRagMode(Boolean(enabled))
      res.json({ success: true, ragMode: req.rag.isRagMode() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 9. Resource Config
  router.post('/rag/config', (req: any, res) => {
    try {
      req.rag.setResourceConfig(req.body || {})
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 10. Progress & Indexing Controls
  router.get('/rag/progress', (req: any, res) => {
    try {
      res.json(req.rag.getProgress ? req.rag.getProgress() : { status: 'idle', percent: 0 })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.post('/rag/pause', async (req: any, res) => {
    try {
      if (req.rag.pauseIndexing) await req.rag.pauseIndexing()
      res.json({ success: true, progress: req.rag.getProgress?.() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.post('/rag/resume', async (req: any, res) => {
    try {
      if (req.rag.resumeIndexing) await req.rag.resumeIndexing()
      res.json({ success: true, progress: req.rag.getProgress?.() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.post('/rag/cancel', async (req: any, res) => {
    try {
      if (req.rag.cancelIndexing) await req.rag.cancelIndexing()
      res.json({ success: true, progress: req.rag.getProgress?.() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
