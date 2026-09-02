import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'
import { requireAdmin } from '../middleware/auth.js'
import fs from 'node:fs'
import path from 'node:path'

export function createAdminRouter(ctx: Context): Router {
  const router = Router()
  const getAuthService = () => (ctx as any).auth

  // 1. Admin Overview Stats
  router.get('/overview', requireAdmin(ctx), async (req, res) => {
    try {
      const auth = getAuthService()
      const users = auth ? await auth.listUsers() : []
      const allSessions = ctx.session.listSessions('*', true, '*')
      const activeSessionsCount = allSessions.length
      const messageCount = allSessions.reduce((acc: number, s: any) => acc + (s.messages?.length || 0), 0)

      res.json({
        totalUsers: users.length,
        totalSessions: activeSessionsCount,
        totalMessages: messageCount,
        usersSummary: users.map((u: any) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          lastActiveAt: u.lastActiveAt
        }))
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. Admin Sessions List
  router.get('/sessions', requireAdmin(ctx), async (req, res) => {
    try {
      const allSessions = ctx.session.listSessions('*', true, '*')
      res.json(allSessions)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 3. Admin Uploads List
  router.get('/uploads', requireAdmin(ctx), async (req, res) => {
    try {
      const auth = getAuthService()
      const users = auth ? await auth.listUsers() : []
      const allUploads: any[] = []

      for (const u of users) {
        if (auth?.ensureTenantDirs) {
          const tenant = auth.ensureTenantDirs(u.id)
          if (fs.existsSync(tenant.uploadsDir)) {
            const files = fs.readdirSync(tenant.uploadsDir)
            for (const f of files) {
              const fullPath = path.join(tenant.uploadsDir, f)
              const stat = fs.statSync(fullPath)
              allUploads.push({
                userId: u.id,
                username: u.username,
                fileName: f,
                fileSize: stat.size,
                uploadedAt: stat.mtimeMs
              })
            }
          }
        }
      }

      res.json(allUploads)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
