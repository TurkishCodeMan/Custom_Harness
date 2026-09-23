import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'
import { requireSession } from '../middleware/auth.js'
import fs from 'node:fs'
import path from 'node:path'

export function createWorkspaceRouter(ctx: Context): Router {
  const router = Router()

  // 1. GET Current Workspace
  router.get('/workspace', (req, res) => {
    const user = req.user || { id: 'user_admin', role: 'admin' }
    const cwd = ctx.settings?.getWorkspaceForUser ? ctx.settings.getWorkspaceForUser(user.id) : (ctx.settings.getWorkspace() || process.cwd())
    let files: { name: string; isDir: boolean }[] = []
    try {
      if (fs.existsSync(cwd)) {
        files = fs.readdirSync(cwd, { withFileTypes: true }).map(f => ({
          name: f.name,
          isDir: f.isDirectory()
        }))
      }
    } catch (e) {}
    res.json({ cwd, files, skills: ctx.skills?.listSkills ? ctx.skills.listSkills() : [] })
  })

  // 2. POST Browse Workspace Directory
  router.post('/workspace/browse', (req, res) => {
    try {
      const user = req.user || { id: 'user_admin', role: 'admin' }
      const userWs = ctx.settings?.getWorkspaceForUser ? ctx.settings.getWorkspaceForUser(user.id) : ctx.settings.getWorkspace()
      let targetPath = req.body?.path || userWs || process.cwd()
      if (!fs.existsSync(targetPath)) {
        targetPath = process.cwd()
      }
      targetPath = path.resolve(targetPath)

      // If targetPath is a file, use its dirname for browsing
      const stat = fs.statSync(targetPath)
      const dirToRead = stat.isFile() ? path.dirname(targetPath) : targetPath

      const entries = fs.readdirSync(dirToRead, { withFileTypes: true })
      const directories = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => e.name)
        .sort()

      const files = entries
        .filter(e => e.isFile() && !e.name.startsWith('.'))
        .map(e => e.name)
        .sort()

      let allFiles: Array<{
        name: string
        relativePath: string
        fullPath: string
        size: number
        extension: string
      }> | undefined

      if (req.body?.recursive === true) {
        allFiles = []
        const rootDir = dirToRead
        const scan = (curDir: string) => {
          try {
            const list = fs.readdirSync(curDir, { withFileTypes: true })
            for (const item of list) {
              if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist' || item.name === 'dist-web') continue
              const full = path.join(curDir, item.name)
              if (item.isDirectory()) {
                scan(full)
              } else if (item.isFile()) {
                try {
                  const s = fs.statSync(full)
                  allFiles!.push({
                    name: item.name,
                    relativePath: path.relative(rootDir, full),
                    fullPath: full,
                    size: s.size,
                    extension: path.extname(item.name).toLowerCase()
                  })
                } catch {}
              }
            }
          } catch {}
        }
        scan(rootDir)
        allFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      }

      res.json({
        current: dirToRead,
        parent: path.dirname(dirToRead),
        directories,
        files,
        allFiles
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 3. POST Set Workspace
  router.post('/workspace', requireSession(ctx, 'sessionId', { optional: true }), (req, res) => {
    const user = req.user || { id: 'user_admin', role: 'admin' }
    const { path: wsPath, sessionId, global: isGlobal } = req.body
    if (wsPath && fs.existsSync(wsPath)) {
      const resolved = path.resolve(wsPath)
      
      // Save for user's tenant settings (isolated per user)
      if (ctx.settings?.setWorkspaceForUser) {
        ctx.settings.setWorkspaceForUser(user.id, resolved, user.role === 'admin' && isGlobal === true)
      } else if (ctx.settings?.saveTenantSettings) {
        ctx.settings.saveTenantSettings(user.id, { workspace: resolved })
      }

      // If sessionId is provided, save workspace for the specific session
      if (sessionId && ctx.session?.setSessionWorkspace) {
        ctx.session.setSessionWorkspace(sessionId, resolved)
      }

      ctx.skills?.discover?.(resolved)
      return res.json({ success: true, workspace: resolved, skills: ctx.skills?.listSkills ? ctx.skills.listSkills() : [] })
    }
    res.status(400).json({ error: 'Geçersiz dizin yolu' })
  })

  return router
}
