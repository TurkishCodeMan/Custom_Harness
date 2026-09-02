import { Context } from '@custom-harness/core-context'
import * as settingsPlugin from '@custom-harness/settings'
import * as authPlugin from '@custom-harness/auth'
import * as authLocalPlugin from '@custom-harness/auth-local'
import * as sessionPlugin from '@custom-harness/session'
import * as tokenMeterPlugin from '@custom-harness/token-meter'
import * as skillsPlugin from '@custom-harness/tool-skill'
import * as toolsPlugin from '@custom-harness/core-tools'
import * as serverPlugin from '../src/index.js'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface TestServer {
  ctx: Context
  port: number
  baseUrl: string
  wsUrl: string
  cleanup: () => Promise<void>
  request: (path: string, options?: RequestOptions) => Promise<HttpResponse>
  adminRequest: (path: string, options?: RequestOptions) => Promise<HttpResponse>
  userRequest: (userId: string, path: string, options?: RequestOptions) => Promise<HttpResponse>
}

export interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: any
}

export interface HttpResponse {
  status: number
  data: any
  raw: string
  headers: http.IncomingHttpHeaders
}

import { Service } from 'cordis'

class MockService extends Service {
  constructor(ctx: Context, name: string, methods: Record<string, any> = {}) {
    super(ctx, name)
    Object.assign(this, methods)
  }
}

export async function createTestServer(): Promise<TestServer> {
  process.env.PORT = '0' // Request OS-assigned ephemeral port
  const testDshDir = path.join(os.tmpdir(), `dsh_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
  fs.mkdirSync(testDshDir, { recursive: true })
  process.env.DSH_DIR = testDshDir

  const ctx = new Context()

  // 1. Core and Local Services
  ctx.plugin(settingsPlugin)
  ctx.plugin(authPlugin)
  ctx.plugin(authLocalPlugin)
  ctx.plugin(sessionPlugin)
  ctx.plugin(tokenMeterPlugin)
  ctx.plugin(skillsPlugin)
  ctx.plugin(toolsPlugin)

  // 2. Register mock Cordis services for injected server requirements
  new MockService(ctx, 'llm', {
    complete: async () => ({ text: 'ok' }),
    chat: async () => ({ text: 'ok' })
  })

  new MockService(ctx, 'agent', {
    run: async () => ({ text: 'ok' })
  })

  const presetsStore = new Map<string, any>([
    [
      'default',
      {
        id: 'default',
        name: 'Default Assistant',
        description: 'Standard preset',
        icon: '🤖',
        isDefault: true
      }
    ]
  ])

  new MockService(ctx, 'agentPresets', {
    list: () => Array.from(presetsStore.values()),
    get: (id: string) => presetsStore.get(id),
    getActive: () => presetsStore.get('default') || presetsStore.values().next().value,
    select: (id: string) => {
      const p = presetsStore.get(id)
      return p || null
    },
    save: (preset: any) => {
      presetsStore.set(preset.id, preset)
      return preset
    },
    delete: (id: string) => {
      const existed = presetsStore.has(id)
      presetsStore.delete(id)
      return { success: existed }
    }
  })

  new MockService(ctx, 'persona', {
    getActivePersona: () => undefined
  })

  new MockService(ctx, 'userQuestions', {
    registerProvider: () => {}
  })

  new MockService(ctx, 'approval', {
    respond: () => {}
  })

  new MockService(ctx, 'rag', {
    getStatus: async () => ({ status: 'ready', totalDocuments: 0 }),
    getFolders: async () => [],
    listDocuments: async () => [],
    indexDirectory: async () => ({ success: true })
  })

  new MockService(ctx, 'mcpClient', {
    listServers: () => [],
    getAvailableTools: () => []
  })

  new MockService(ctx, 'web', {
    fetch: async () => ({ text: 'ok' }),
    search: async () => []
  })

  // 3. Directly apply server plugin (mounts express routes, middleware, and ephemeral server)
  serverPlugin.apply(ctx)

  // Ensure port is assigned via ctx.server
  let port = ctx.server?.getPort() || (ctx.server?.getHttpServer()?.address() as any)?.port
  while (!port) {
    await new Promise((r) => setTimeout(r, 10))
    port = ctx.server?.getPort() || (ctx.server?.getHttpServer()?.address() as any)?.port
  }

  const baseUrl = `http://127.0.0.1:${port}`
  const wsUrl = `ws://127.0.0.1:${port}`

  const request = (path: string, options: RequestOptions = {}): Promise<HttpResponse> => {
    return new Promise((resolve, reject) => {
      const url = new URL(baseUrl + path)
      const reqHeaders: Record<string, string> = { ...(options.headers || {}) }
      
      let postBody: string | undefined = undefined
      if (options.body !== undefined) {
        postBody = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
        if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
          reqHeaders['Content-Type'] = 'application/json'
        }
        reqHeaders['Content-Length'] = Buffer.byteLength(postBody).toString()
      }

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method: options.method || 'GET',
          headers: reqHeaders
        },
        (res) => {
          let chunks: Buffer[] = []
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8')
            let data = raw
            try {
              data = JSON.parse(raw)
            } catch {}
            resolve({
              status: res.statusCode || 200,
              data,
              raw,
              headers: res.headers
            })
          })
        }
      )

      req.on('error', reject)
      if (postBody) req.write(postBody)
      req.end()
    })
  }

  const adminRequest = (path: string, options: RequestOptions = {}) => {
    return request(path, {
      ...options,
      headers: {
        'X-User-Id': 'user_admin',
        ...(options.headers || {})
      }
    })
  }

  const userRequest = (userId: string, path: string, options: RequestOptions = {}) => {
    return request(path, {
      ...options,
      headers: {
        'X-User-Id': userId,
        ...(options.headers || {})
      }
    })
  }

  const cleanup = async () => {
    try {
      await ctx.server?.stop()
    } catch {}
    try {
      await ctx.stop()
    } catch {}
    // Clean up temporary test directory completely
    if (fs.existsSync(testDshDir)) {
      try {
        fs.rmSync(testDshDir, { recursive: true, force: true })
      } catch {}
    }
  }

  return {
    ctx,
    port,
    baseUrl,
    wsUrl,
    cleanup,
    request,
    adminRequest,
    userRequest
  }
}
