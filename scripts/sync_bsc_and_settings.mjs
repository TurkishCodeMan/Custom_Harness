import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import YAML from '../node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js'
import esbuild from 'esbuild'

const dshDir = process.env.DSH_DIR || path.join(os.homedir(), '.dsh')
const settingsFile = path.join(dshDir, 'settings.yaml')

console.log('🔧 Updating ~/.dsh/settings.yaml...')

let currentSettings = {}
if (fs.existsSync(settingsFile)) {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8')
    currentSettings = YAML.parse(raw) || {}
  } catch (e) {
    console.warn('Could not parse settings.yaml:', e.message)
  }
}

// Ensure ONLY 8004 (qwen-local) and 8989 (qwen-bsc) remain
const newProviders = {
  'qwen-bsc': {
    id: 'qwen-bsc',
    name: 'Bsc:Qwen-3.8-27B',
    api: 'openai-completions',
    baseURL: 'http://localhost:8989/v1',
    models: [
      {
        id: 'Qwen3.8-27B',
        name: 'Qwen3.8-27B',
        contextWindow: 16384,
        maxTokens: 8192,
        reasoningFormat: 'deepseek'
      }
    ]
  },
  'qwen-local': {
    id: 'qwen-local',
    name: 'Local Qwen 3.8 27B (llama.cpp - 8004)',
    api: 'openai-completions',
    baseURL: 'http://localhost:8004/v1',
    models: [
      {
        id: 'qwen3.8-27b-uncensored',
        name: 'Qwen 3.8 (27B Uncensored)',
        contextWindow: 16384,
        maxTokens: 8192,
        reasoningFormat: 'deepseek'
      },
      {
        id: 'Qwen3.8-27B',
        name: 'Qwen 3.8 (27B)',
        contextWindow: 16384,
        maxTokens: 8192,
        reasoningFormat: 'deepseek'
      }
    ]
  }
}

const updatedSettings = {
  ...currentSettings,
  defaultProvider: 'qwen-bsc',
  defaultModel: 'Qwen3.8-27B',
  providers: newProviders
}

if (!fs.existsSync(dshDir)) {
  fs.mkdirSync(dshDir, { recursive: true })
}

fs.writeFileSync(settingsFile, YAML.stringify(updatedSettings), 'utf8')
console.log('✅ ~/.dsh/settings.yaml updated successfully:')
console.log(YAML.stringify(updatedSettings))

// Clean tenant settings as well
const tenantsDir = path.join(dshDir, 'tenants')
if (fs.existsSync(tenantsDir)) {
  const tenants = fs.readdirSync(tenantsDir)
  for (const t of tenants) {
    const tSettingsFile = path.join(tenantsDir, t, 'settings.json')
    if (fs.existsSync(tSettingsFile)) {
      try {
        const raw = fs.readFileSync(tSettingsFile, 'utf8')
        const tData = JSON.parse(raw)
        delete tData.providers
        if (tData.defaultProvider && !newProviders[tData.defaultProvider]) {
          tData.defaultProvider = 'qwen-bsc'
          tData.defaultModel = 'Qwen3.8-27B'
        }
        fs.writeFileSync(tSettingsFile, JSON.stringify(tData, null, 2), 'utf8')
        console.log(`✅ Cleaned tenant settings for ${t}`)
      } catch {}
    }
  }
}

// Rebuild frontend bundle
console.log('🎨 Rebuilding frontend bundle (dist/public/bundle.js)...')
const ROOT_DIR = process.cwd()
const clientEntry = path.join(ROOT_DIR, 'packages/client/web-react/src/index.tsx')
const clientPackagesDir = path.join(ROOT_DIR, 'packages/client')
const PUBLIC_DIR = path.join(ROOT_DIR, 'dist/public')

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })
}

try {
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
  console.log('✅ Frontend bundle rebuilt at dist/public/bundle.js')
} catch (e) {
  console.error('Failed to rebuild frontend bundle:', e)
}

// Rebuild dist/server.mjs
console.log('📦 Rebuilding server (dist/server.mjs)...')
try {
  await esbuild.build({
    entryPoints: [path.join(ROOT_DIR, 'apps/web/src/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: path.join(ROOT_DIR, 'dist/server.mjs'),
    minify: true,
    sourcemap: false,
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"
    },
    external: ['pg', 'redis', 'esbuild']
  })
  console.log('✅ Server rebuilt at dist/server.mjs')
} catch (e) {
  console.error('Failed to rebuild server:', e)
}
