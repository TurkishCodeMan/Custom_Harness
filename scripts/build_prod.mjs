#!/usr/bin/env node
import esbuild from 'esbuild'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const PUBLIC_DIR = path.join(DIST_DIR, 'public')

async function buildProduction() {
  console.log('====================================================')
  console.log('🚀 Custom Harness Production Build & Obfuscation')
  console.log('====================================================')

  // 1. Clean dist directory
  await fsp.rm(DIST_DIR, { recursive: true, force: true })
  await fsp.mkdir(PUBLIC_DIR, { recursive: true })

  // 2. Build Backend Server (Minified, Obfuscated, Standalone ESM)
  console.log('📦 [1/4] Backend sunucusu derleniyor ve minify ediliyor (dist/server.mjs)...')
  await esbuild.build({
    entryPoints: [path.join(ROOT_DIR, 'apps/web/src/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: path.join(DIST_DIR, 'server.mjs'),
    minify: true,
    sourcemap: false,
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"
    },
    external: ['pg', 'redis', 'esbuild']
  })
  console.log('   ✅ Backend derlendi (dist/server.mjs)')

  // 3. Build Frontend React UI (Minified, Obfuscated Bundle)
  console.log('🎨 [2/4] Frontend React WebUI derleniyor (dist/public/bundle.js)...')
  const clientEntry = path.join(ROOT_DIR, 'packages/client/web-react/src/index.tsx')
  const clientPackagesDir = path.join(ROOT_DIR, 'packages/client')

  await esbuild.build({
    entryPoints: [clientEntry],
    bundle: true,
    format: 'esm',
    target: 'esnext',
    jsx: 'automatic',
    outfile: path.join(PUBLIC_DIR, 'bundle.js'),
    minify: true,
    sourcemap: false,
    external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
    define: {
      'process.env.NODE_ENV': '"production"',
      'process': '{}'
    },
    alias: {
      '@custom-harness/client-ui-primitives': path.join(clientPackagesDir, 'ui-primitives/src/index.tsx'),
      '@custom-harness/client-ui-layout': path.join(clientPackagesDir, 'ui-layout/src/index.tsx'),
      '@custom-harness/client-ui-sidebar': path.join(clientPackagesDir, 'ui-sidebar/src/index.tsx'),
      '@custom-harness/client-ui-conversation': path.join(clientPackagesDir, 'ui-conversation/src/index.tsx'),
      '@custom-harness/client-ui-token-meter': path.join(clientPackagesDir, 'ui-token-meter/src/index.tsx'),
      '@custom-harness/client-ui-settings': path.join(clientPackagesDir, 'ui-settings/src/index.tsx'),
      '@custom-harness/client-ui-admin': path.join(clientPackagesDir, 'ui-admin/src/index.tsx'),
      '@custom-harness/client-ui-auth': path.join(clientPackagesDir, 'ui-auth/src/index.tsx'),
      '@custom-harness/client-web-react': path.join(clientPackagesDir, 'web-react/src/index.tsx')
    }
  })
  console.log('   ✅ Frontend derlendi (dist/public/bundle.js)')

  // 4. Copy Static HTML & CSS
  console.log('📄 [3/4] Statik HTML ve CSS dosyaları kopyalanıyor...')
  const htmlSrc = path.join(ROOT_DIR, 'packages/client/web-react/src/index.html')
  const cssSrc = path.join(ROOT_DIR, 'packages/client/web-react/src/style.css')
  if (fs.existsSync(htmlSrc)) {
    await fsp.copyFile(htmlSrc, path.join(PUBLIC_DIR, 'index.html'))
  }
  if (fs.existsSync(cssSrc)) {
    await fsp.copyFile(cssSrc, path.join(PUBLIC_DIR, 'style.css'))
  }

  // Copy brand logos if available
  const brandLogosDir = path.join(clientPackagesDir, 'ui-sidebar/public')
  if (fs.existsSync(brandLogosDir)) {
    await fsp.cp(brandLogosDir, PUBLIC_DIR, { recursive: true })
  }

  // Copy Python parser engine for RAG OCR
  const pythonSrc = path.join(ROOT_DIR, 'packages/rag/rag-python-engine/python/document_parser.py')
  if (fs.existsSync(pythonSrc)) {
    const pythonDistDir = path.join(DIST_DIR, 'python')
    await fsp.mkdir(pythonDistDir, { recursive: true })
    await fsp.copyFile(pythonSrc, path.join(pythonDistDir, 'document_parser.py'))
    console.log('   ✅ Python OCR Motoru kopyalandı (dist/python/document_parser.py)')
  }

  // 5. Generate Standalone package.json in dist
  console.log('⚙️  [4/4] dist/package.json oluşturuluyor...')
  const distPkg = {
    name: 'custom-harness-standalone',
    version: '1.0.0',
    private: true,
    type: 'module',
    main: 'server.mjs',
    scripts: {
      start: 'node server.mjs'
    },
    dependencies: {
      pg: '^8.13.1'
    }
  }
  await fsp.writeFile(path.join(DIST_DIR, 'package.json'), JSON.stringify(distPkg, null, 2))

  console.log('====================================================')
  console.log('🎉 TEBRİKLER! Tüm kaynak kodlar başarıyla derlendi ve gizlendi.')
  console.log('📁 Çıktı Dizini: ./dist/')
  console.log('🚀 Müşteri sunucusunda çalıştırmak için: cd dist && node server.mjs')
  console.log('====================================================\n')
}

buildProduction().catch(err => {
  console.error('❌ Build Hatası:', err)
  process.exit(1)
})
