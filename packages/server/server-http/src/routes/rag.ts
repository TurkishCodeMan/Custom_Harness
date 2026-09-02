import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'
import { requireAdmin } from '../middleware/auth.js'

export function createRagRouter(ctx: Context): Router {
  const router = Router()
  const getRagService = () => (ctx.root as any)?.rag || (ctx as any)?.rag || (ctx as any)?.get?.('rag')

  // 1. RAG Status
  router.get('/rag/status', async (req, res) => {
    try {
      const caller = req.user!
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      const status = await rag.getStatus(caller.id, caller.role === 'admin')
      res.json(status)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. Index Folder
  router.post('/rag/index', async (req, res) => {
    try {
      const caller = req.user!
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      const { path: folderPath, config } = req.body
      if (!folderPath) return res.status(400).json({ error: 'folderPath is required' })
      const source = await rag.addAndIndexFolder(folderPath, config, caller.id)
      res.json({ success: true, source })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 3. Update Permissions (Admin Only)
  router.post('/rag/permissions', requireAdmin(ctx), async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      const { sourceId, allowedUserIds, isPublic } = req.body
      if (!sourceId) return res.status(400).json({ error: 'sourceId is required' })
      await rag.updateSourcePermissions(sourceId, allowedUserIds || ['*'], isPublic !== false)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 4. Search
  router.post('/rag/search', async (req, res) => {
    try {
      const caller = req.user!
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      const { query, topK, filePathPrefix } = req.body
      if (!query) return res.status(400).json({ error: 'query is required' })
      const results = await rag.search({ query, topK, filePathPrefix }, caller.id, caller.role === 'admin')
      res.json({ results })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 5. Search Images
  router.post('/rag/search-images', async (req, res) => {
    try {
      const caller = req.user!
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      const { textQuery, imagePath, topK } = req.body
      if (!textQuery && !imagePath) return res.status(400).json({ error: 'textQuery or imagePath is required' })
      const results = await rag.searchImages({ textQuery, imagePath, topK }, caller.id, caller.role === 'admin')
      res.json({ results })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 6. Remove Folder
  router.post('/rag/remove', async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      const { id, path: folderPath } = req.body
      await rag.removeFolder(id || folderPath)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 7. Clear All (Admin Only)
  router.post('/rag/clear', requireAdmin(ctx), async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      await rag.clearAll()
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 8. RAG Mode Toggle
  router.post('/rag/mode', (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      const { enabled } = req.body
      rag.setRagMode(Boolean(enabled))
      res.json({ success: true, ragMode: rag.isRagMode() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 9. Resource Config
  router.post('/rag/config', (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      rag.setResourceConfig(req.body || {})
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 10. Progress & Indexing Controls
  router.get('/rag/progress', (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      res.json(rag.getProgress ? rag.getProgress() : { status: 'idle', percent: 0 })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.post('/rag/pause', async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      if (rag.pauseIndexing) await rag.pauseIndexing()
      res.json({ success: true, progress: rag.getProgress?.() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.post('/rag/resume', async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      if (rag.resumeIndexing) await rag.resumeIndexing()
      res.json({ success: true, progress: rag.getProgress?.() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.post('/rag/cancel', async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      if (rag.cancelIndexing) await rag.cancelIndexing()
      res.json({ success: true, progress: rag.getProgress?.() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
