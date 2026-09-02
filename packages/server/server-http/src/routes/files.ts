import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'
import type { Request, Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { UploadParser, type UploadedFileInfo } from '../upload-parser.js'

export function createFilesRouter(ctx: Context): Router {
  const router = Router()

  // 1. File Upload Handler
  const handleUpload = async (req: Request, res: Response) => {
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

  router.post('/upload', handleUpload)
  router.post('/upload/:sessionId', handleUpload)

  // 2. GET Session Uploads
  router.get('/uploads/:sessionId', async (req, res) => {
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

  // 3. Tenant File Management ("Dosyalarım")
  router.get('/files/my-files', async (req, res) => {
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

  // 4. Delete File
  router.delete('/files/my-files', async (req, res) => {
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

  return router
}
