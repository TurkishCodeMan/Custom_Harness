import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'
import { protectFields, requireAdmin } from '../middleware/auth.js'

export function createSettingsRouter(ctx: Context): Router {
  const router = Router()

  // 1. GET Settings
  router.get('/settings', (req, res) => {
    const user = req.user
    const settings = ctx.settings.getSettingsForUser ? ctx.settings.getSettingsForUser(user?.id) : ctx.settings.getSettings()
    res.json(settings)
  })

  // 2. POST Settings (Update)
  router.post(
    '/settings',
    protectFields(ctx, ['providers', 'defaultProvider', 'defaultModel', 'plugins', 'sandboxMode']),
    (req, res) => {
      const user = req.user
      const isAdmin = user?.role === 'admin'
      const updated = ctx.settings.updateSettingsForUser
        ? ctx.settings.updateSettingsForUser(user?.id || 'user_admin', req.body, isAdmin)
        : ctx.settings.updateSettings(req.body)
      res.json(updated)
    }
  )

  // 3. POST Sandbox Mode
  router.post('/settings/sandbox-mode', (req, res) => {
    try {
      const { mode } = req.body
      if (!mode || !['read-only', 'workspace-write', 'danger-full-access'].includes(mode)) {
        return res.status(400).json({ error: 'Geçersiz sandbox modu' })
      }
      const updated = ctx.settings.setSandboxMode(mode)
      res.json({ success: true, sandboxMode: updated.sandboxMode })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 4. Model Discovery
  const handleModelDiscovery = async (req: any, res: any) => {
    try {
      const { baseURL, apiKey } = req.body
      if (!baseURL) {
        return res.status(400).json({ error: 'baseURL zorunludur' })
      }
      const models = await ctx.settings.discoverModels(baseURL, apiKey)
      res.json({ models })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  }

  router.post('/models/discover', requireAdmin(ctx), handleModelDiscovery)
  router.get('/models/discover', requireAdmin(ctx), handleModelDiscovery)

  return router
}
