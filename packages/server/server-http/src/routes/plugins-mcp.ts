import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'
import { requireAdmin } from '../middleware/auth.js'

export function createPluginsMcpRouter(ctx: Context): Router {
  const router = Router()

  // 1. MCP Management
  router.get('/mcp/servers', (req, res) => {
    try {
      const servers = (ctx as any).mcpClient?.listServers ? (ctx as any).mcpClient.listServers() : []
      res.json({ servers })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.post('/mcp/servers', async (req, res) => {
    try {
      const { id, name, command, args, url, type, headers, env } = req.body
      if (!id || (!command && !url)) {
        return res.status(400).json({ error: 'Sunucu ID ve Komut veya URL alanı zorunludur.' })
      }
      const mcpService = (ctx as any).mcpClient
      if (!mcpService) {
        return res.status(500).json({ error: 'MCP Client servisi aktif değil.' })
      }
      const cfg = {
        id,
        name: name || id,
        type: type || (url ? 'http' : 'stdio'),
        url,
        headers: headers || {},
        command,
        args: Array.isArray(args) ? args : (args ? args.split(' ').filter(Boolean) : []),
        env: env || {}
      }
      mcpService.registerServer(cfg)
      await mcpService.connectServer(cfg)
      mcpService.saveConfigFile()
      res.json({ ok: true, servers: mcpService.listServers() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.delete('/mcp/servers/:id', async (req, res) => {
    try {
      const mcpService = (ctx as any).mcpClient
      if (mcpService?.removeServer) {
        await mcpService.removeServer(req.params.id)
      }
      res.json({ ok: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.post('/mcp/servers/:id/toggle', async (req, res) => {
    try {
      const mcpService = (ctx as any).mcpClient
      if (!mcpService?.toggleServer) {
        return res.status(500).json({ error: 'MCP servisi bulunamadı.' })
      }
      const result = await mcpService.toggleServer(req.params.id)
      res.json({ ok: true, ...result })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. Token Measurement
  router.get('/context/measure', (req, res) => {
    try {
      const sessionId = typeof req.query.sessionId === 'string' && req.query.sessionId ? req.query.sessionId : undefined
      const measurement = ctx.tokenMeter.measureSession(sessionId)
      res.json(measurement)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 3. Plugins
  router.get('/plugins', (req, res) => {
    res.json(ctx.settings.getPlugins())
  })

  router.get('/tools', (req, res) => {
    try {
      const tools = ctx.tools ? ctx.tools.getActiveTools() : []
      res.json(tools.map(t => ({
        name: t.name,
        description: t.description
      })))
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  router.post('/plugins/:id/toggle', requireAdmin(ctx), (req, res) => {
    try {
      const { enabled } = req.body
      const updated = ctx.settings.togglePlugin(req.params.id, Boolean(enabled))
      res.json(updated)
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  router.post('/plugins/:id/config', requireAdmin(ctx), (req, res) => {
    try {
      const updated = ctx.settings.updatePluginConfig(req.params.id, req.body?.config || {})
      res.json(updated)
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  return router
}
