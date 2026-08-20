import type { Context } from '@custom-harness/core-context'
import express from 'express'
import cors from 'cors'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { UploadParser, UploadedFileInfo } from './upload-parser.js'
import { resolveUser, attachUser, requireRole, requireAdmin, protectFields } from './middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const possibleUiDirs = [
  '/home/huseyina/code_mode/custom-harness/packages/client/web-react/src',
  path.resolve(__dirname, '../../../client/web-react/src'),
  path.resolve(__dirname, '../../../../packages/client/web-react/src'),
  path.resolve(process.cwd(), '../packages/client/web-react/src'),
  path.resolve(process.cwd(), 'packages/client/web-react/src'),
  path.resolve(process.cwd(), '../../packages/client/web-react/src'),
  path.resolve(__dirname, '../../../client/ui/src'),
  path.resolve(__dirname, '../../../../packages/client/ui/src')
]
const UI_DIR = possibleUiDirs.find((d: string) => fs.existsSync(path.join(d, 'index.html'))) || possibleUiDirs[0]

export const name = 'server'
export const inject = ['settings', 'tools', 'llm', 'agent', 'session', 'skills', 'tokenMeter', 'agentPresets', 'persona', 'userQuestions', 'approval', 'rag', 'auth']

export function apply(ctx: Context) {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '100mb' }))
  app.use(express.urlencoded({ extended: true, limit: '100mb' }))
  app.use(attachUser(ctx))

  console.log(`📁 Web UI Dizini: ${UI_DIR} (${fs.existsSync(path.join(UI_DIR, 'index.html')) ? 'Bulundu' : 'Bulunamadı'})`)

  // Dedicated no-cache style.css endpoint
  app.get('/style.css', (req, res) => {
    const cssPath = path.join(UI_DIR, 'style.css')
    if (fs.existsSync(cssPath)) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      return res.sendFile(cssPath)
    }
    res.status(404).send('style.css not found')
  })

  // Dynamic on-the-fly bundle endpoint for modular React packages
  app.get('/bundle.js', async (req, res) => {
    try {
      const esbuild: any = await import('esbuild')
      const candidates = [
        path.resolve(__dirname, '../../../client/web-react/src/index.tsx'),
        path.resolve(__dirname, '../../../../packages/client/web-react/src/index.tsx'),
        path.resolve(process.cwd(), 'packages/client/web-react/src/index.tsx'),
        path.resolve(process.cwd(), '../../packages/client/web-react/src/index.tsx')
      ]
      const entryFile = candidates.find(f => fs.existsSync(f)) || candidates[0]
      const clientDir = path.dirname(path.dirname(entryFile))
      const clientPackagesDir = path.dirname(clientDir)

      const result = await esbuild.build({
        entryPoints: [entryFile],
        bundle: true,
        write: false,
        format: 'esm',
        target: 'esnext',
        jsx: 'automatic',
        define: {
          'process.env.NODE_ENV': '"development"',
          'process': '{}'
        },
        external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
        alias: {
          '@custom-harness/client-ui-primitives': path.resolve(clientPackagesDir, 'ui-primitives/src/index.tsx'),
          '@custom-harness/client-ui-layout': path.resolve(clientPackagesDir, 'ui-layout/src/index.tsx'),
          '@custom-harness/client-ui-sidebar': path.resolve(clientPackagesDir, 'ui-sidebar/src/index.tsx'),
          '@custom-harness/client-ui-conversation': path.resolve(clientPackagesDir, 'ui-conversation/src/index.tsx'),
          '@custom-harness/client-ui-token-meter': path.resolve(clientPackagesDir, 'ui-token-meter/src/index.tsx'),
          '@custom-harness/client-ui-settings': path.resolve(clientPackagesDir, 'ui-settings/src/index.tsx'),
          '@custom-harness/client-ui-admin': path.resolve(clientPackagesDir, 'ui-admin/src/index.tsx'),
          '@custom-harness/client-ui-auth': path.resolve(clientPackagesDir, 'ui-auth/src/index.tsx'),
          '@custom-harness/client-web-react': path.resolve(clientPackagesDir, 'web-react/src/index.tsx')
        }
      })
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.send(result.outputFiles[0].text)
    } catch (err: any) {
      console.error('[Bundle Error]:', err)
      res.status(500).send(`console.error(${JSON.stringify(err.message)})`)
    }
  })

  // Serve static UI assets and ArtificaX brand logos
  const sidebarPublicDirs = [
    path.resolve(__dirname, '../../../client/ui-sidebar/public'),
    path.resolve(__dirname, '../../../../packages/client/ui-sidebar/public'),
    path.resolve(process.cwd(), 'packages/client/ui-sidebar/public'),
    path.resolve(process.cwd(), '../../packages/client/ui-sidebar/public')
  ]
  for (const dir of sidebarPublicDirs) {
    if (fs.existsSync(dir)) {
      app.use(express.static(dir))
    }
  }

  app.get('/logo.png', (req, res) => {
    for (const dir of sidebarPublicDirs) {
      const p = path.join(dir, 'logo.png')
      if (fs.existsSync(p)) return res.sendFile(p)
    }
    for (const dir of sidebarPublicDirs) {
      const p = path.join(dir, 'artificax-logo.png')
      if (fs.existsSync(p)) return res.sendFile(p)
    }
    res.status(404).send('Logo not found')
  })

  app.get('/artificax-logo.png', (req, res) => {
    for (const dir of sidebarPublicDirs) {
      const p = path.join(dir, 'artificax-logo.png')
      if (fs.existsSync(p)) return res.sendFile(p)
    }
    res.status(404).send('Logo not found')
  })

  if (fs.existsSync(UI_DIR)) {
    app.use(express.static(UI_DIR))
    app.get('/', (req, res) => {
      res.sendFile(path.join(UI_DIR, 'index.html'))
    })
  } else {
    app.get('/', (req, res) => {
      res.send(`<h1>Custom Harness Server Çalışıyor</h1><p>UI dizini bulunamadı (${UI_DIR}).</p>`)
    })
  }

  // 1. Settings & Provider Endpoints
  app.get('/api/settings', (req, res) => {
    const user = req.user
    if (ctx.settings.getSettingsForUser && user?.id) {
      return res.json(ctx.settings.getSettingsForUser(user.id))
    }
    res.json(ctx.settings.getSettings())
  })

  app.post(
    '/api/settings',
    protectFields(ctx, ['ui.defaultTitlePrompt', 'providers', 'workspace']),
    async (req, res) => {
      try {
        const user = req.user!
        const isAdmin = user.role === 'admin'
        if (ctx.settings.updateSettingsForUser) {
          const updated = ctx.settings.updateSettingsForUser(user.id, req.body, isAdmin)
          return res.json(updated)
        }
        const updated = ctx.settings.updateSettings(req.body)
        res.json(updated)
      } catch (e: any) {
        res.status(400).json({ error: e.message })
      }
    }
  )

  app.post('/api/settings/sandbox-mode', (req, res) => {
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

  app.post('/api/models/discover', requireAdmin(ctx), async (req, res) => {
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
  })

  // Auth helper
  const getAuthService = () => (ctx as any).auth

  // 1.5. Auth & Multi-Tenancy Endpoints
  app.post('/api/auth/login', async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      const result = await auth.login(req.body)
      if (!result.success) return res.status(401).json({ error: result.error || 'Geçersiz kimlik bilgileri' })
      res.json(result)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/auth/register', async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      const result = await auth.register(req.body)
      if (!result.success) return res.status(400).json({ error: result.error || 'Kayıt başarısız' })
      res.json(result)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true })
  })

  app.get('/api/auth/me', (req, res) => {
    res.json({ user: req.user })
  })

  app.get('/api/auth/users', async (req, res) => {
    try {
      const auth = getAuthService()
      const users = auth ? await auth.listUsers() : []
      res.json({ users })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/auth/switch', async (req, res) => {
    try {
      const { userId } = req.body
      if (!userId) return res.status(400).json({ error: 'userId zorunludur' })
      const auth = getAuthService()
      const user = auth ? await auth.getUser(userId) : null
      if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' })
      const token = auth ? auth.createToken(user) : undefined
      res.json({ success: true, user, token })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/auth/users', requireAdmin(ctx), async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      const newUser = await auth.createUser(req.body)
      res.json({ success: true, user: newUser })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.put('/api/auth/users/:id/role', requireAdmin(ctx), async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      const updated = await auth.updateUser(req.params.id, { role: req.body.role })
      res.json({ success: true, user: updated })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.delete('/api/auth/users/:id', requireAdmin(ctx), async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      const ok = await auth.deleteUser(req.params.id, true)
      res.json({ success: ok })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 1.6. Admin Overview & Multi-Tenant Management Endpoints
  app.get('/api/admin/overview', requireAdmin(ctx), async (req, res) => {
    try {
      const auth = getAuthService()
      const stats = auth ? await auth.getOverviewStats() : {
        totalUsers: 1,
        adminCount: 1,
        userCount: 0,
        totalSessions: ctx.session.listSessions().length,
        totalUploads: 0,
        totalStorageBytes: 0,
        activeUsers24h: 1
      }
      res.json(stats)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/admin/sessions', requireAdmin(ctx), async (req, res) => {
    try {
      const sessions = ctx.session.listSessions(undefined, true)
      res.json(sessions)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/admin/uploads', requireAdmin(ctx), async (req, res) => {
    try {
      const allUploads: any[] = []
      const dshDir = path.join(os.homedir(), '.dsh')
      const legacyUploads = path.join(dshDir, 'uploads')
      const tenantsDir = path.join(dshDir, 'tenants')

      const scanDir = (dir: string, userId: string, sessionId?: string) => {
        if (!fs.existsSync(dir)) return
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          const full = path.join(dir, e.name)
          if (e.isDirectory()) {
            scanDir(full, userId, e.name)
          } else if (!e.name.startsWith('.')) {
            try {
              const st = fs.statSync(full)
              const ext = path.extname(e.name).toLowerCase()
              let category = 'document'
              if (['.xlsx', '.xls', '.csv', '.parquet', '.json'].includes(ext)) category = 'spreadsheet'
              else if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'].includes(ext)) category = 'image'
              allUploads.push({
                fileName: e.name,
                filePath: full,
                fileSize: st.size,
                category,
                userId,
                sessionId: sessionId || '-'
              })
            } catch {}
          }
        }
      }

      scanDir(legacyUploads, 'user_admin')
      if (fs.existsSync(tenantsDir)) {
        const tenants = fs.readdirSync(tenantsDir)
        for (const t of tenants) {
          scanDir(path.join(tenantsDir, t, 'uploads'), t)
        }
      }

      res.json(allUploads)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. Session Endpoints (Tenant-Isolated)
  app.get('/api/sessions', (req, res) => {
    const user = req.user!
    const isAdmin = user.role === 'admin'
    res.json(ctx.session.listSessions(user.id, isAdmin))
  })

  app.get('/api/sessions/:id', (req, res) => {
    const session = ctx.session.getSession(req.params.id)
    if (!session) {
      return res.status(404).json({ error: 'Oturum bulunamadı' })
    }
    res.json(session)
  })

  app.delete('/api/sessions/:id', (req, res) => {
    try {
      const user = req.user!
      ctx.session.deleteSession(req.params.id, user.id, user.role === 'admin')
      res.json({ success: true })
    } catch (e: any) {
      res.status(403).json({ error: e.message })
    }
  })

  app.delete('/api/sessions', (req, res) => {
    const user = req.user!
    ctx.session.clearAllSessions(user.id, user.role === 'admin')
    res.json({ success: true })
  })

  app.post('/api/sessions/clear', (req, res) => {
    const user = req.user!
    ctx.session.clearAllSessions(user.id, user.role === 'admin')
    res.json({ success: true })
  })

  app.post('/api/sessions/:id/compact', (req, res) => {
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

  // 3. Workspace Endpoints
  app.get('/api/workspace', (req, res) => {
    const settings = ctx.settings.getSettings()
    const cwd = settings.workspace || process.cwd()
    let files: { name: string; isDir: boolean }[] = []
    try {
      if (fs.existsSync(cwd)) {
        files = fs.readdirSync(cwd, { withFileTypes: true }).map(f => ({
          name: f.name,
          isDir: f.isDirectory()
        }))
      }
    } catch (e) {}
    res.json({ cwd, files })
  })

  app.post('/api/workspace/browse', (req, res) => {
    try {
      const settings = ctx.settings.getSettings()
      let targetPath = req.body?.path || settings.workspace || process.cwd()
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

      res.json({
        current: dirToRead,
        parent: path.dirname(dirToRead),
        directories,
        files
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/workspace', requireAdmin(ctx), (req, res) => {
    const { path: wsPath, sessionId } = req.body
    if (wsPath && fs.existsSync(wsPath)) {
      const resolved = path.resolve(wsPath)
      ctx.settings.setWorkspace(resolved)
      if (sessionId) {
        ctx.session.setSessionWorkspace(sessionId, resolved)
      }
      ctx.skills.discover(resolved)
      return res.json({ success: true, workspace: resolved, skills: ctx.skills.listSkills() })
    }
    res.status(400).json({ error: 'Geçersiz dizin yolu' })
  })

  // 4. File Upload & Ingestion Endpoints
  const handleUpload = async (req: express.Request, res: express.Response) => {
    try {
      const user = req.user!
      const sessionId = req.params.sessionId || req.body?.sessionId || 'default'
      const uploadsDir = ctx.session?.getUploadsDir ? ctx.session.getUploadsDir(sessionId, user.id) : path.join(os.homedir(), '.dsh', 'tenants', user.id, 'uploads', sessionId)
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      const files = req.body?.files || (req.body?.fileName && req.body?.fileData ? [req.body] : [])
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Yüklenecek dosya verisi bulunamadı.' })
      }

      console.log(`[Upload] Gelen dosya sayısı: ${files.length} (Kullanıcı: ${user.username}, Oturum: ${sessionId})`)
      const parsedResults: (UploadedFileInfo & { userId: string })[] = []

      for (const item of files) {
        try {
          const rawFileName = item.fileName || item.name || `file_${Date.now()}`
          const safeName = path.basename(rawFileName).replace(/[^a-zA-Z0-9._-]/g, '_')
          const targetPath = path.join(uploadsDir, safeName)

          let buffer: Buffer
          if (item.fileData || item.data) {
            const rawData = item.fileData || item.data
            const base64Data = rawData.includes(';base64,') ? rawData.split(';base64,')[1] : rawData
            buffer = Buffer.from(base64Data, 'base64')
          } else if (item.content) {
            buffer = Buffer.from(item.content, 'utf-8')
          } else {
            continue
          }

          await fs.promises.writeFile(targetPath, buffer)
          const info = await UploadParser.parseFile(targetPath, rawFileName)
          parsedResults.push({ ...info, userId: user.id })
          console.log(`[Upload] Başarıyla kaydedildi ve analiz edildi: ${safeName} (${info.fileCategory})`)
        } catch (itemErr: any) {
          console.error(`[Upload Item Error]:`, itemErr.message)
        }
      }

      res.json({
        success: true,
        sessionId,
        userId: user.id,
        uploadsDir,
        files: parsedResults
      })
    } catch (e: any) {
      console.error('[Upload Error]:', e)
      res.status(500).json({ error: `Yükleme hatası: ${e.message}` })
    }
  }

  app.post('/api/upload', handleUpload)
  app.post('/api/upload/:sessionId', handleUpload)

  app.get('/api/uploads/:sessionId', async (req, res) => {
    try {
      const user = req.user!
      const sessionId = req.params.sessionId
      const uploadsDir = ctx.session?.getUploadsDir ? ctx.session.getUploadsDir(sessionId, user.id) : path.join(os.homedir(), '.dsh', 'tenants', user.id, 'uploads', sessionId)
      if (!fs.existsSync(uploadsDir)) {
        return res.json({ files: [] })
      }
      const fileNames = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.'))
      const list: UploadedFileInfo[] = []
      for (const name of fileNames) {
        const fullPath = path.join(uploadsDir, name)
        try {
          const info = await UploadParser.parseFile(fullPath, name)
          list.push(info)
        } catch {}
      }
      res.json({ files: list })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 4.5. Tenant File Management ("Dosyalarım")
  app.get('/api/files/my-files', async (req, res) => {
    try {
      const user = req.user!
      const list: any[] = []
      const seenPaths = new Set<string>()

      const scanUploads = async (baseDir: string, defaultSessionId = 'global') => {
        if (!fs.existsSync(baseDir)) return
        const entries = fs.readdirSync(baseDir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(baseDir, entry.name)
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await scanUploads(fullPath, entry.name)
          } else if (entry.isFile() && !entry.name.startsWith('.')) {
            if (seenPaths.has(fullPath)) continue
            seenPaths.add(fullPath)
            try {
              const stat = fs.statSync(fullPath)
              const info = await UploadParser.parseFile(fullPath, entry.name)
              list.push({
                ...info,
                sessionId: defaultSessionId,
                uploadedAt: stat.mtimeMs,
                userId: user.id
              })
            } catch (err: any) {
              const stat = fs.statSync(fullPath)
              list.push({
                id: `file_${stat.mtimeMs}_${Math.random().toString(36).slice(2, 6)}`,
                fileName: entry.name,
                filePath: fullPath,
                fileSize: stat.size,
                fileCategory: 'document',
                sessionId: defaultSessionId,
                uploadedAt: stat.mtimeMs,
                userId: user.id
              })
            }
          }
        }
      }

      // Scan tenant uploads
      const tenantUploadsDir = path.join(os.homedir(), '.dsh', 'tenants', user.id, 'uploads')
      await scanUploads(tenantUploadsDir)

      // If admin, or legacy files exist
      if (user.role === 'admin' || list.length === 0) {
        const legacyUploadsDir = path.join(os.homedir(), '.dsh', 'uploads')
        await scanUploads(legacyUploadsDir)
      }

      // Sort newest first
      list.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0))
      res.json({ success: true, files: list })
    } catch (e: any) {
      console.error('[MyFiles Error]:', e)
      res.status(500).json({ error: e.message })
    }
  })

  app.delete('/api/files/my-files', async (req, res) => {
    try {
      const user = req.user!
      const { filePath } = req.body
      if (!filePath) return res.status(400).json({ error: 'filePath is required' })

      // Security check: ensure path belongs to tenant or legacy uploads
      const safeTenantPrefix = path.join(os.homedir(), '.dsh', 'tenants', user.id, 'uploads')
      const safeLegacyPrefix = path.join(os.homedir(), '.dsh', 'uploads')
      const isAllowed = user.role === 'admin' || filePath.startsWith(safeTenantPrefix) || filePath.startsWith(safeLegacyPrefix)

      if (!isAllowed) {
        return res.status(403).json({ error: 'Bu dosyayı silme yetkiniz bulunmuyor' })
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 5. Token Meter & Context Endpoints
  app.get('/api/sessions/:id/context', (req, res) => {
    try {
      const measurement = ctx.tokenMeter.measureSession(req.params.id)
      res.json(measurement)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/context/measure', (req, res) => {
    try {
      const sessionId = typeof req.query.sessionId === 'string' && req.query.sessionId ? req.query.sessionId : undefined
      const measurement = ctx.tokenMeter.measureSession(sessionId)
      res.json(measurement)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 6. Plugins Endpoints
  app.get('/api/plugins', (req, res) => {
    res.json(ctx.settings.getPlugins())
  })

  app.get('/api/tools', (req, res) => {
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

  app.post('/api/plugins/:id/toggle', requireAdmin(ctx), (req, res) => {
    try {
      const { enabled } = req.body
      const updated = ctx.settings.togglePlugin(req.params.id, Boolean(enabled))
      res.json(updated)
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/plugins/:id/config', requireAdmin(ctx), (req, res) => {
    try {
      const updated = ctx.settings.updatePluginConfig(req.params.id, req.body?.config || {})
      res.json(updated)
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 6. Agent Presets API (Delegates to @custom-harness/preset-agent-presets)
  const safeGetAgentPresets = () => {
    try { return (ctx as any).agentPresets || null } catch { return null }
  }

  app.get('/api/presets', (req, res) => {
    try {
      const user = req.user
      const isAdmin = user?.role === 'admin'
      const ap = safeGetAgentPresets()
      const presets = ap ? ap.list(user?.id, isAdmin) : ctx.settings.getPresets()
      const activePreset = ap ? ap.getActive(user?.id) : ctx.settings.getActivePreset()
      res.json({ presets, activePreset })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/presets/select', (req, res) => {
    try {
      const user = req.user
      const { presetId } = req.body
      if (!presetId) return res.status(400).json({ error: 'presetId zorunludur' })
      const ap = safeGetAgentPresets()
      const activePreset = ap ? ap.select(presetId, user?.id) : (ctx.settings.setDefaultPreset(presetId), ctx.settings.getActivePreset())
      res.json({ success: true, activePreset })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/presets', (req, res) => {
    try {
      const user = req.user
      const isAdmin = user?.role === 'admin'
      const raw = req.body?.preset || req.body
      if (!raw || typeof raw !== 'object' || (!raw.name && !raw.id)) {
        return res.status(400).json({ error: 'Geçersiz önayar bilgileri: Profil adı zorunludur' })
      }
      const preset = {
        id: raw.id || raw.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || `preset_${Date.now()}`,
        name: raw.name || raw.id,
        description: raw.description || '',
        systemPrompt: raw.systemPrompt || raw.personaPrompt || '',
        tools: Array.isArray(raw.tools) ? raw.tools : [],
        enabledTools: Array.isArray(raw.enabledTools) ? raw.enabledTools : (Array.isArray(raw.tools) && raw.tools.length > 0 ? raw.tools : undefined),
        icon: raw.icon || '👤',
        isDefault: Boolean(raw.isDefault),
        isGlobal: Boolean(raw.isGlobal && isAdmin),
        ownerId: user?.id || 'user_admin'
      }
      const ap = safeGetAgentPresets()
      const saved = ap ? ap.save(preset, user?.id, isAdmin) : ctx.settings.savePreset(preset)
      res.json({ success: true, preset: saved || preset })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.delete('/api/presets/:id', (req, res) => {
    try {
      const user = req.user
      const isAdmin = user?.role === 'admin'
      const ap = safeGetAgentPresets()
      const result = ap ? ap.delete(req.params.id, user?.id, isAdmin) : ctx.settings.deletePreset(req.params.id)
      res.json(typeof result === 'object' ? result : { success: Boolean(result) })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/presets/default', (req, res) => {
    try {
      const user = req.user
      const { presetId } = req.body
      if (!presetId) return res.status(400).json({ error: 'presetId zorunludur' })
      const ap = safeGetAgentPresets()
      const activePreset = ap ? ap.select(presetId, user?.id) : (ctx.settings.setDefaultPreset(presetId), ctx.settings.getActivePreset())
      res.json({ success: true, activePreset })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })


  const getSkillsService = () => (ctx.root as any)?.skills || (ctx as any)?.skills || (ctx as any)?.get?.('skills')

  app.get('/api/skills', (req, res) => {
    try {
      const caller = req.user!
      const skills = getSkillsService()
      if (!skills) return res.status(503).json({ error: 'Skills service not loaded' })
      const list = skills.listSkills(caller.id, caller.role === 'admin').map((s: any) => {
        const rawInfo = skills.getSkillRaw(s.id)
        return {
          ...s,
          rawContent: rawInfo?.raw || `---
name: ${s.name}
description: ${s.description}
---

${s.content}`
        }
      })
      res.json({
        skills: list,
        template: skills.getDefaultTemplate()
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/skills/template', (req, res) => {
    try {
      const skills = getSkillsService()
      const name = (req.query.name as string) || 'yeni-beceri'
      const desc = (req.query.description as string) || 'Bu becerinin ne yaptığı ve ne zaman kullanılacağı'
      const tpl = skills ? skills.getDefaultTemplate(name, desc) : `---
name: ${name}
description: ${desc}
version: 1.0.0
---

# ${name.toUpperCase()} Uzmanlık Becerisi
`
      res.json({ template: tpl })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/skills', (req, res) => {
    try {
      const caller = req.user!
      const skills = getSkillsService()
      if (!skills) return res.status(503).json({ error: 'Skills service not loaded' })
      const { id, name, description, content, rawContent, isGlobal, enabled } = req.body

      let skillName = (name || '').trim()
      let skillDescription = (description || '').trim()

      if (rawContent && rawContent.startsWith('---')) {
        const matchName = rawContent.match(/^name:\s*(.+)$/m)
        if (matchName && matchName[1]) skillName = matchName[1].trim().replace(/^['"]|['"]$/g, '')
        const matchDesc = rawContent.match(/^description:\s*(.+)$/m)
        if (matchDesc && matchDesc[1]) skillDescription = matchDesc[1].trim().replace(/^['"]|['"]$/g, '')
      }

      const rawId = (id && id !== 'yeni-uzmanlik' && id !== 'custom-skill') 
        ? id 
        : (skillName || id || 'custom-skill')

      const skillId = rawId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
      if (!skillId) return res.status(400).json({ error: 'Geçerli bir beceri adı/ID zorunludur' })

      const ws = (req.query.workspace as string) || ctx.settings.getWorkspace()
      const created = skills.createSkill({
        id: skillId,
        name: skillName || skillId,
        description: skillDescription,
        content,
        rawContent,
        isGlobal: Boolean(isGlobal && caller.role === 'admin'),
        workspaceDir: ws,
        userId: caller.id,
        isAdmin: caller.role === 'admin',
        enabled: enabled !== undefined ? Boolean(enabled) : true
      })
      res.json({ success: true, skill: created })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.put('/api/skills/:id', (req, res) => {
    try {
      const caller = req.user!
      const skills = getSkillsService()
      if (!skills) return res.status(503).json({ error: 'Skills service not loaded' })
      const { name, description, content, rawContent, enabled } = req.body
      const ws = (req.query.workspace as string) || ctx.settings.getWorkspace()
      const updated = skills.updateSkill(req.params.id, {
        name,
        description,
        content,
        rawContent,
        workspaceDir: ws,
        userId: caller.id,
        isAdmin: caller.role === 'admin',
        enabled: enabled !== undefined ? Boolean(enabled) : undefined
      })
      res.json({ success: true, skill: updated })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/skills/:id/toggle', (req, res) => {
    try {
      const caller = req.user!
      const skills = getSkillsService()
      if (!skills) return res.status(503).json({ error: 'Skills service not loaded' })
      const { enabled } = req.body
      const isEnabled = enabled !== undefined ? Boolean(enabled) : true
      const updated = skills.toggleSkill(req.params.id, isEnabled, caller.id, caller.role === 'admin')
      res.json({ success: true, skill: updated })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.delete('/api/skills/:id', (req, res) => {
    try {
      const caller = req.user!
      const skills = getSkillsService()
      if (!skills) return res.status(503).json({ error: 'Skills service not loaded' })
      skills.deleteSkill(req.params.id, caller.id, caller.role === 'admin')
      res.json({ success: true })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/skills/permissions', (req, res) => {
    try {
      const caller = req.user!
      const skills = getSkillsService()
      if (!skills) return res.status(503).json({ error: 'Skills service not loaded' })
      const { skillId, allowedUserIds, isPublic } = req.body
      if (!skillId) return res.status(400).json({ error: 'Beceri ID (skillId) zorunludur' })
      const updated = skills.updateSkillPermissions(
        skillId,
        Array.isArray(allowedUserIds) ? allowedUserIds : ['*'],
        isPublic !== false,
        caller.id,
        caller.role === 'admin'
      )
      res.json({ success: true, skill: updated })
    } catch (e: any) {
      res.status(403).json({ error: e.message })
    }
  })

  let basePort = process.env.PORT ? parseInt(process.env.PORT) : 3080

  // 7. RAG Knowledge & pgvector Endpoints
  const getRagService = () => (ctx.root as any)?.rag || (ctx as any)?.rag || (ctx as any)?.get?.('rag')

  app.get('/api/rag/status', async (req, res) => {
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

  app.post('/api/rag/index', async (req, res) => {
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

  app.post('/api/rag/permissions', requireAdmin(ctx), async (req, res) => {
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

  app.post('/api/rag/search', async (req, res) => {
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

  app.post('/api/rag/search-images', async (req, res) => {
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

  app.post('/api/rag/remove', async (req, res) => {
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

  app.post('/api/rag/clear', requireAdmin(ctx), async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      await rag.clearAll()
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/rag/mode', (req, res) => {
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

  app.post('/api/rag/config', (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      rag.setResourceConfig(req.body || {})
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/rag/progress', (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      res.json(rag.getProgress ? rag.getProgress() : { status: 'idle', percent: 0 })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/rag/pause', async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      if (rag.pauseIndexing) await rag.pauseIndexing()
      res.json({ success: true, progress: rag.getProgress?.() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/rag/resume', async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      if (rag.resumeIndexing) await rag.resumeIndexing()
      res.json({ success: true, progress: rag.getProgress?.() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/rag/cancel', async (req, res) => {
    try {
      const rag = getRagService()
      if (!rag) return res.status(503).json({ error: 'RAG service not loaded' })
      if (rag.cancelIndexing) await rag.cancelIndexing()
      res.json({ success: true, progress: rag.getProgress?.() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  function startListening(targetPort: number) {
    const server = http.createServer(app)
    const wss = new WebSocketServer({ server })

    wss.on('error', () => {})

    const activeRuns = new Map<WebSocket, AbortController>()
    const pendingQuestions = new Map<string, (ans: any) => void>()

    if (ctx.userQuestions?.registerProvider) {
      ctx.userQuestions.registerProvider({
        ask: (request) => {
          const reqId = `uq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          return new Promise((resolve) => {
            pendingQuestions.set(reqId, resolve)

            let sent = false
            for (const client of wss.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    type: 'user_question_request',
                    id: reqId,
                    questions: request.questions
                  })
                )
                sent = true
              }
            }

            if (!sent) {
              pendingQuestions.delete(reqId)
              resolve({
                answers: request.questions.map(q => ({
                  id: q.id,
                  selected: q.options && q.options.length > 0 ? [q.options[0].label] : ['Confirmed']
                }))
              })
            }
          })
        }
      })
    }

    ctx.on('approval/asked', (request: any) => {
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'approval_request', request }))
        }
      }
    })

    ctx.on('rag/progress' as any, (progress: any) => {
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'rag_progress', progress }))
        }
      }
    })

    wss.on('connection', (ws) => {
      console.log('[WebSocket] İstemci başarıyla bağlandı!')
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'connected' }))
      }

      const generateSessionTitle = async (sessionId: string, userPrompt: string, clientWs: WebSocket) => {
        try {
          const settings = ctx.settings.getSettings()
          const ui = settings.ui || {}
          const titlePrompt = ui.defaultTitlePrompt || 'Sen profesyonel bir başlık üreticisisin. Verilen ilk kullanıcı iletisini analiz et ve bu sohbet konusu için net, sade, anlaşılır ve en fazla 3-5 kelimelik Türkçe bir başlık üret. Tırnak işareti, "Başlık:" ön eki veya noktalama işareti ekleme, yalnızca başlık metnini döndür.'

          const titleMessages = [
            { role: 'system' as const, content: titlePrompt },
            { role: 'user' as const, content: `Kullanıcı Mesajı: "${userPrompt.slice(0, 300)}"` }
          ]

          const activeProvider = ctx.settings.getActiveProvider()
          const activeModel = ctx.settings.getActiveModel()

          let generatedTitle = ''
          for await (const ev of ctx.llm.streamChat(titleMessages, {
            provider: activeProvider,
            model: activeModel,
            enableThinking: false
          })) {
            if (ev.type === 'chunk' && ev.content) {
              generatedTitle += ev.content
            }
          }

          let cleanTitle = generatedTitle
            .replace(/["'`«»„“”]/g, '')
            .replace(/^başlık\s*:\s*/i, '')
            .replace(/^title\s*:\s*/i, '')
            .replace(/\n.*/g, '')
            .trim()

          if (cleanTitle.length > 45) {
            cleanTitle = cleanTitle.slice(0, 42) + '...'
          }

          if (cleanTitle && cleanTitle.length >= 2) {
            ctx.session.renameSession(sessionId, cleanTitle)
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'session_rename', sessionId, title: cleanTitle }))
            }
          }
        } catch (err: any) {
          console.warn('[AutoTitle Notice]:', err.message)
        }
      }

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString())

          if (msg.type === 'user_question_response') {
            const resolver = pendingQuestions.get(msg.id)
            if (resolver) {
              pendingQuestions.delete(msg.id)
              resolver({ answers: msg.answers || [] })
            }
            return
          }

          if (msg.type === 'get_context') {
            const measurement = ctx.tokenMeter.measureSession(msg.sessionId)
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'context_update', measurement, sessionId: msg.sessionId }))
            }
            return
          }

          if (msg.type === 'approval_response') {
            if (ctx.approval) {
              ctx.approval.respond(msg.id, msg.outcome || 'allow_once')
            }
            return
          }

          if (msg.type === 'abort') {
            const controller = activeRuns.get(ws)
            if (controller) {
              controller.abort()
              activeRuns.delete(ws)
            }
            return
          }

          if (msg.type === 'chat') {
            const { sessionId, prompt, providerId, modelId, presetId, attachments, userId, enableThinking, thinkingBudgetTokens } = msg
            const controller = new AbortController()
            activeRuns.set(ws, controller)

            const sessionUserId = userId || 'user_admin'
            const activeSession = (sessionId && ctx.session.getSession(sessionId)) || ctx.session.createSession(undefined, undefined, sessionUserId)
            const activeSessionId = activeSession.id

            // Send active session id and initial context measurement immediately
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'session_init', sessionId: activeSessionId }))
              const initialMeasurement = ctx.tokenMeter.measureSession(activeSessionId)
              ws.send(JSON.stringify({ type: 'context_update', measurement: initialMeasurement, sessionId: activeSessionId }))
            }

            // Trigger Auto Title Generation on first turn in the background
            const isFirstTurn = !activeSession.messages || activeSession.messages.length <= 1 || activeSession.title === 'Yeni Sohbet' || activeSession.title.startsWith('Sohbet ')
            if (isFirstTurn && prompt && !prompt.startsWith('/')) {
              generateSessionTitle(activeSessionId, prompt, ws)
            }

            // If attachments are provided, format them into structured context
            let promptToSend = prompt
            if (Array.isArray(attachments) && attachments.length > 0) {
              const fileSummaries = attachments.map((att: any, idx: number) => {
                let s = `### [Ek Dosya ${idx + 1}] 📎 ${att.fileName || path.basename(att.filePath)}\n`
                s += `- **Yerel Dosya Yolu:** \`${att.filePath}\`\n`
                s += `- **Dosya Türü:** ${att.fileCategory || 'dosya'} (${typeof att.fileSize === 'number' ? (att.fileSize / 1024).toFixed(1) + ' KB' : ''})\n`
                if (att.schemaSummary) {
                  s += `\n**Şema / İçerik Özeti:**\n${att.schemaSummary}\n`
                }
                if (att.ocrText && !att.schemaSummary?.includes(att.ocrText.slice(0, 50))) {
                  s += `\n**Görsel OCR Metni:**\n${att.ocrText}\n`
                }
                if (att.fileCategory === 'spreadsheet') {
                  s += `\n> 💡 *İpucu:* Bu tablodan veri okumak, filtrelemek, toplamak veya grafik çizmek için Python (pandas, openpyxl, duckdb) komutlarını \`run_command\` ile çalıştırabilirsin.\n`
                } else if (att.fileCategory === 'image') {
                  s += `\n> 💡 *İpucu:* Kullanıcı benzer görselleri aramak isterse \`search_images\` aracını \`imagePath: "${att.filePath}"\` parametresiyle çağırabilirsin.\n`
                }
                return s
              }).join('\n\n---\n\n')

              promptToSend = `[KULLANICININ YÜKLEDİĞİ DOSYALAR]:\n\n${fileSummaries}\n\n========================================\n\n${prompt}`
            }

            let isAutonomous = false
            if (promptToSend.startsWith('/goal')) {
              isAutonomous = true
              const goalGoal = promptToSend.replace(/^\/goal\s*/, '').trim() || 'Proje ve kod tabanını analiz et'
              promptToSend = `[OTONOM HEDEF BAŞLATILDI]: Kullanıcı şu hedefi verdi: "${goalGoal}".\nDoğrudan araçları (list_dir, search_files, read_file, manage_goal) kullanarak çalışmaya başla ve görevi otonom olarak yürüt. Tekrar araç listeleme yapma, doğrudan işe koyul.`
            }

            try {
              const finalResponse = await ctx.agent.run({
                sessionId: activeSessionId,
                prompt: promptToSend,
                providerId,
                modelId,
                presetId,
                userId: sessionUserId,
                autonomous: isAutonomous,
                enableThinking: typeof enableThinking === 'boolean' ? enableThinking : undefined,
                thinkingBudgetTokens: typeof thinkingBudgetTokens === 'number' ? thinkingBudgetTokens : undefined,
                signal: controller.signal,
                onThought: (text: string) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'thought', text, sessionId: activeSessionId }))
                  }
                },
                onChunk: (text: string) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'chunk', text, sessionId: activeSessionId }))
                  }
                },
                onToolStart: (call: { id: string; name: string; args: any }) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'tool_start', call, sessionId: activeSessionId }))
                  }
                },
                onToolResult: (result: { id: string; name: string; output: any }) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'tool_result', result, sessionId: activeSessionId }))
                    const toolMeasurement = ctx.tokenMeter.measureSession(activeSessionId)
                    ws.send(JSON.stringify({ type: 'context_update', measurement: toolMeasurement, sessionId: activeSessionId }))
                  }
                },
                onCompaction: (info: { messageCount: number; summary: string }) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'compaction', info, sessionId: activeSessionId }))
                    const compMeasurement = ctx.tokenMeter.measureSession(activeSessionId)
                    ws.send(JSON.stringify({ type: 'context_update', measurement: compMeasurement, sessionId: activeSessionId }))
                  }
                }
              })

              const measurement = ctx.tokenMeter.measureSession(activeSessionId)

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'done',
                  response: finalResponse,
                  sessionId: activeSessionId,
                  measurement
                }))
                ws.send(JSON.stringify({ type: 'context_update', measurement, sessionId: activeSessionId }))
              }
            } catch (err: any) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', error: err.message, sessionId: activeSessionId }))
              }
            } finally {
              activeRuns.delete(ws)
            }
          }
        } catch (err: any) {
          console.error('[WebSocket] Message error:', err)
        }
      })

      ws.on('close', () => {
        const controller = activeRuns.get(ws)
        if (controller) {
          controller.abort()
          activeRuns.delete(ws)
        }
      })
    })

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Server] Port ${targetPort} meşgul, ${targetPort + 1} deneniyor...`)
        try {
          wss.close()
          server.close()
        } catch (e) {}
        startListening(targetPort + 1)
      } else {
        console.error('[Server] Başlatma Hatası:', err)
      }
    })

    server.listen(targetPort, '0.0.0.0', () => {
      console.log(`\n======================================================`)
      console.log(`✨ Custom Harness Web UI hazır!`)
      console.log(`🌐 Arayüz: http://127.0.0.1:${targetPort}`)
      console.log(`======================================================\n`)
    })
  }

  ctx.on('ready', () => {
    startListening(basePort)
  })
}
