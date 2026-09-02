import { Router } from 'express'
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const possibleUiDirs = [
  path.resolve(process.cwd(), 'dist/public'),
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../../public'),
  path.resolve(process.cwd(), 'public'),
  '/home/huseyina/code_mode/custom-harness/packages/client/web-react/src',
  path.resolve(__dirname, '../../../../client/web-react/src'),
  path.resolve(__dirname, '../../../../../packages/client/web-react/src'),
  path.resolve(process.cwd(), '../packages/client/web-react/src'),
  path.resolve(process.cwd(), 'packages/client/web-react/src'),
  path.resolve(process.cwd(), '../../packages/client/web-react/src'),
  path.resolve(__dirname, '../../../../client/ui/src'),
  path.resolve(__dirname, '../../../../../packages/client/ui/src')
]

export const UI_DIR = possibleUiDirs.find((d: string) => fs.existsSync(path.join(d, 'index.html'))) || possibleUiDirs[0]

export function createAssetsRouter(): Router {
  const router = Router()

  // Dedicated no-cache style.css endpoint
  router.get('/style.css', (req, res) => {
    const cssPath = path.join(UI_DIR, 'style.css')
    if (fs.existsSync(cssPath)) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      return res.sendFile(cssPath)
    }
    res.status(404).send('style.css not found')
  })

  // Dynamic on-the-fly bundle endpoint for modular React packages or static production bundle
  router.get('/bundle.js', async (req, res) => {
    // 1. Static pre-compiled bundle in production
    const staticBundle = path.join(UI_DIR, 'bundle.js')
    if (fs.existsSync(staticBundle)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=31536000')
      return res.sendFile(staticBundle)
    }

    // 2. Dynamic on-the-fly bundling for development
    try {
      const esbuild: any = await import('esbuild')
      const candidates = [
        path.resolve(__dirname, '../../../../client/web-react/src/index.tsx'),
        path.resolve(__dirname, '../../../../../packages/client/web-react/src/index.tsx'),
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
    path.resolve(__dirname, '../../../../client/ui-sidebar/public'),
    path.resolve(__dirname, '../../../../../packages/client/ui-sidebar/public'),
    path.resolve(process.cwd(), 'packages/client/ui-sidebar/public'),
    path.resolve(process.cwd(), '../../packages/client/ui-sidebar/public')
  ]
  for (const dir of sidebarPublicDirs) {
    if (fs.existsSync(dir)) {
      router.use(express.static(dir))
    }
  }

  router.get('/logo.png', (req, res) => {
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

  router.get('/artificax-logo.png', (req, res) => {
    for (const dir of sidebarPublicDirs) {
      const p = path.join(dir, 'artificax-logo.png')
      if (fs.existsSync(p)) return res.sendFile(p)
    }
    res.status(404).send('Logo not found')
  })

  if (fs.existsSync(UI_DIR)) {
    router.use(express.static(UI_DIR))
    router.get('/', (req, res) => {
      res.sendFile(path.join(UI_DIR, 'index.html'))
    })
  } else {
    router.get('/', (req, res) => {
      res.send(`<h1>Custom Harness Server Çalışıyor</h1><p>UI dizini bulunamadı (${UI_DIR}).</p>`)
    })
  }

  return router
}
