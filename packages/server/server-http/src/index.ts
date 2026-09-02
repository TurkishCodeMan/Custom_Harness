import type { Context } from '@custom-harness/core-context'
import { ServerService, type ServerInfo } from '@custom-harness/server'
import express from 'express'
import cors from 'cors'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import type { WebSocketServer } from 'ws'

import { attachUser } from './middleware/auth.js'
import { createAssetsRouter, UI_DIR } from './routes/assets.js'
import { createAuthRouter } from './routes/auth.js'
import { createAdminRouter } from './routes/admin.js'
import { createSettingsRouter } from './routes/settings.js'
import { createSessionsRouter } from './routes/sessions.js'
import { createWorkspaceRouter } from './routes/workspace.js'
import { createFilesRouter } from './routes/files.js'
import { createPresetsRouter } from './routes/presets.js'
import { createSkillsRouter } from './routes/skills.js'
import { createPluginsMcpRouter } from './routes/plugins-mcp.js'
import { createRagRouter } from './routes/rag.js'
import { setupWebSocketGateway } from './ws/gateway.js'

export class HttpServerService extends ServerService {
  private app: express.Express
  private server?: http.Server
  private wss?: WebSocketServer
  private currentPort?: number
  private isStarting = false

  constructor(ctx: Context) {
    super(ctx)

    this.app = express()
    this.app.use(cors())
    this.app.use(express.json({ limit: '100mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '100mb' }))
    this.app.use(attachUser(ctx))

    console.log(`📁 Web UI Dizini: ${UI_DIR} (${fs.existsSync(path.join(UI_DIR, 'index.html')) ? 'Bulundu' : 'Bulunamadı'})`)

    // Mount Modular Route Handlers
    this.app.use('/api/auth', createAuthRouter(ctx))
    this.app.use('/api/admin', createAdminRouter(ctx))
    this.app.use('/api', createSettingsRouter(ctx))
    this.app.use('/api', createSessionsRouter(ctx))
    this.app.use('/api', createWorkspaceRouter(ctx))
    this.app.use('/api', createFilesRouter(ctx))
    this.app.use('/api', createPresetsRouter(ctx))
    this.app.use('/api', createSkillsRouter(ctx))
    this.app.use('/api', createPluginsMcpRouter(ctx))
    this.app.use('/api', createRagRouter(ctx))

    // Assets & Static Files Router (Mounted at root)
    this.app.use(createAssetsRouter())
  }

  public getPort(): number | undefined {
    return this.currentPort
  }

  public getUrl(): string | undefined {
    return this.currentPort ? `http://127.0.0.1:${this.currentPort}` : undefined
  }

  public isRunning(): boolean {
    return Boolean(this.server?.listening)
  }

  public getHttpServer(): http.Server | undefined {
    return this.server
  }

  public getWebSocketServer(): WebSocketServer | undefined {
    return this.wss
  }

  public getApp(): express.Express {
    return this.app
  }

  public async start(port?: number): Promise<ServerInfo> {
    if (this.isRunning() && this.currentPort) {
      return {
        port: this.currentPort,
        url: this.getUrl()!,
        address: '0.0.0.0'
      }
    }

    const basePort = port !== undefined ? port : (process.env.PORT !== undefined ? parseInt(process.env.PORT) : 3080)

    return new Promise((resolve, reject) => {
      const tryListen = (targetPort: number) => {
        const srv = http.createServer(this.app)
        const wss = setupWebSocketGateway(this.ctx, srv)
        this.server = srv
        this.wss = wss

        srv.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.warn(`[Server] Port ${targetPort} meşgul, ${targetPort + 1} deneniyor...`)
            try {
              wss.close()
              srv.close()
            } catch (e) {}
            tryListen(targetPort + 1)
          } else {
            console.error('[Server] Başlatma Hatası:', err)
            reject(err)
          }
        })

        srv.listen(targetPort, '0.0.0.0', () => {
          const boundPort = (srv.address() as any)?.port || targetPort
          this.currentPort = boundPort

          console.log(`\n======================================================`)
          console.log(`✨ Custom Harness Web UI hazır!`)
          console.log(`🌐 Arayüz: http://127.0.0.1:${boundPort}`)
          console.log(`======================================================\n`)

          resolve({
            port: boundPort,
            url: `http://127.0.0.1:${boundPort}`,
            address: '0.0.0.0'
          })
        })
      }

      tryListen(basePort)
    })
  }

  public async stop(): Promise<void> {
    try {
      this.wss?.close()
      this.server?.close()
    } catch {}
    this.server = undefined
    this.wss = undefined
    this.currentPort = undefined
  }
}

export const name = 'server-http'
export const inject = [
  'settings',
  'tools',
  'llm',
  'agent',
  'session',
  'skills',
  'tokenMeter',
  'agentPresets',
  'persona',
  'userQuestions',
  'approval',
  'rag',
  'auth',
  'mcpClient'
]

export function apply(ctx: Context) {
  const service = new HttpServerService(ctx)

  const safeStart = () => {
    service.start().catch((err) => {
      console.error('[Server HTTP Service] Start failed:', err)
    })
  }

  ctx.on('ready', () => {
    safeStart()
  })

  ctx.on('dispose', async () => {
    await service.stop()
  })

  // Start immediately so web port binds without waiting for background services
  safeStart()
}

export default HttpServerService
