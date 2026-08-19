import type { Context } from '@custom-harness/core-context'
import express from 'express'
import cors from 'cors'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const possibleUiDirs = [
  path.resolve(__dirname, '../../../client/web-react/src'),
  path.resolve(__dirname, '../../../../packages/client/web-react/src'),
  path.resolve(process.cwd(), 'packages/client/web-react/src'),
  path.resolve(process.cwd(), '../../packages/client/web-react/src'),
  path.resolve(__dirname, '../../../client/ui/src'),
  path.resolve(__dirname, '../../../../packages/client/ui/src'),
  path.resolve(process.cwd(), 'packages/client/ui/src'),
  path.resolve(process.cwd(), '../../packages/client/ui/src')
]
const UI_DIR = possibleUiDirs.find((d: string) => fs.existsSync(path.join(d, 'index.html'))) || possibleUiDirs[0]

export const name = 'server'
export const inject = ['settings', 'tools', 'llm', 'agent', 'session', 'skills', 'tokenMeter', 'agentPresets', 'persona', 'userQuestions', 'approval']

export function apply(ctx: Context) {
  const app = express()
  app.use(cors())
  app.use(express.json())

  console.log(`📁 Web UI Dizini: ${UI_DIR} (${fs.existsSync(path.join(UI_DIR, 'index.html')) ? 'Bulundu' : 'Bulunamadı'})`)

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
          '@custom-harness/client-web-react': path.resolve(clientPackagesDir, 'web-react/src/index.tsx')
        }
      })
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
      res.send(result.outputFiles[0].text)
    } catch (err: any) {
      console.error('[Bundle Error]:', err)
      res.status(500).send(`console.error(${JSON.stringify(err.message)})`)
    }
  })

  // Serve static UI assets
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
    res.json(ctx.settings.getSettings())
  })

  app.post('/api/settings', (req, res) => {
    try {
      const updated = ctx.settings.updateSettings(req.body)
      res.json(updated)
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/models/discover', async (req, res) => {
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

  // 2. Session Endpoints
  app.get('/api/sessions', (req, res) => {
    res.json(ctx.session.listSessions())
  })

  app.get('/api/sessions/:id', (req, res) => {
    const session = ctx.session.getSession(req.params.id)
    if (!session) {
      return res.status(404).json({ error: 'Oturum bulunamadı' })
    }
    res.json(session)
  })

  app.delete('/api/sessions/:id', (req, res) => {
    ctx.session.deleteSession(req.params.id)
    res.json({ success: true })
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

      const entries = fs.readdirSync(targetPath, { withFileTypes: true })
      const directories = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => e.name)
        .sort()

      res.json({
        current: targetPath,
        parent: path.dirname(targetPath),
        directories
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/workspace', (req, res) => {
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

  // 4. Skills Endpoints
  app.get('/api/skills', (req, res) => {
    const ws = (req.query.workspace as string) || ctx.settings.getWorkspace()
    ctx.skills.discover(ws)
    res.json(ctx.skills.listSkills())
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

  app.post('/api/plugins/:id/toggle', (req, res) => {
    try {
      const { enabled } = req.body
      const updated = ctx.settings.togglePlugin(req.params.id, Boolean(enabled))
      res.json(updated)
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/plugins/:id/config', (req, res) => {
    try {
      const updated = ctx.settings.updatePluginConfig(req.params.id, req.body?.config || {})
      res.json(updated)
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 6. Agent Presets API (Delegates to @custom-harness/preset-agent-presets)
  app.get('/api/presets', (req, res) => {
    const presets = ctx.agentPresets ? ctx.agentPresets.list() : ctx.settings.getPresets()
    const activePreset = ctx.agentPresets ? ctx.agentPresets.getActive() : ctx.settings.getActivePreset()
    res.json({ presets, activePreset })
  })

  app.post('/api/presets/select', (req, res) => {
    try {
      const { presetId } = req.body
      if (!presetId) return res.status(400).json({ error: 'presetId zorunludur' })
      const activePreset = ctx.agentPresets ? ctx.agentPresets.select(presetId) : (ctx.settings.setDefaultPreset(presetId), ctx.settings.getActivePreset())
      res.json({ success: true, activePreset })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/presets', (req, res) => {
    try {
      const preset = req.body?.preset
      if (!preset || !preset.id || !preset.name) {
        return res.status(400).json({ error: 'Geçersiz önayar bilgileri' })
      }
      const saved = ctx.agentPresets ? ctx.agentPresets.save(preset) : ctx.settings.savePreset(preset)
      res.json({ success: true, preset: saved })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.delete('/api/presets/:id', (req, res) => {
    try {
      const result = ctx.agentPresets ? ctx.agentPresets.delete(req.params.id) : ctx.settings.deletePreset(req.params.id)
      res.json(typeof result === 'object' ? result : { success: Boolean(result) })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  let basePort = process.env.PORT ? parseInt(process.env.PORT) : 3080

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

    wss.on('connection', (ws) => {
      console.log('[WebSocket] İstemci başarıyla bağlandı!')
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'connected' }))
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
            const { sessionId, prompt, providerId, modelId } = msg
            const controller = new AbortController()
            activeRuns.set(ws, controller)

            const activeSession = (sessionId && ctx.session.getSession(sessionId)) || ctx.session.createSession()
            const activeSessionId = activeSession.id

            // Send active session id and initial context measurement immediately
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'session_init', sessionId: activeSessionId }))
              const initialMeasurement = ctx.tokenMeter.measureSession(activeSessionId)
              ws.send(JSON.stringify({ type: 'context_update', measurement: initialMeasurement, sessionId: activeSessionId }))
            }

            try {
              const finalResponse = await ctx.agent.run({
                sessionId: activeSessionId,
                prompt,
                providerId,
                modelId,
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
