import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

export interface McpServerConfig {
  id: string
  name?: string
  type?: 'stdio' | 'http' | 'sse' | 'ws' | 'websocket' | 'docker'
  command?: string
  args?: string[]
  url?: string
  headers?: Record<string, string>
  env?: Record<string, string>
}

// 1. HTTP / Streaming JSON-RPC Client
export class McpHttpClient {
  private reqId = 1
  public activeTools: any[] = []

  constructor(public config: McpServerConfig) {}

  public async start(): Promise<any[]> {
    try {
      console.log(`[MCP] Connecting to HTTP MCP endpoint "${this.config.id}": ${this.config.url}`)
      await this.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'custom-harness', version: '0.1.0' }
      })
      const toolsRes = await this.request('tools/list', {})
      const tools = toolsRes?.tools || []
      this.activeTools = tools
      console.log(`[MCP] Successfully connected to HTTP MCP "${this.config.id}". Discovered ${tools.length} tool(s): ${tools.map((t: any) => t.name).join(', ')}`)
      return tools
    } catch (e: any) {
      console.warn(`[MCP:${this.config.id}] HTTP connection error:`, e.message)
      return []
    }
  }

  public async request(method: string, params: any): Promise<any> {
    if (!this.config.url) throw new Error(`MCP server "${this.config.id}" has no URL`)
    const id = this.reqId++
    const res = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream, */*',
        'User-Agent': 'ModelContextProtocol/1.0 (custom-harness)',
        ...(this.config.headers || {})
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: AbortSignal.timeout(12000)
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const text = await res.text()
    let data: any
    if (text.includes('data:')) {
      const line = text.split('\n').find(l => l.trim().startsWith('data:'))
      if (line) {
        data = JSON.parse(line.trim().replace(/^data:\s*/, ''))
      } else {
        data = JSON.parse(text)
      }
    } else {
      data = JSON.parse(text)
    }

    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error))
    }
    return data.result
  }

  public async callTool(name: string, args: any): Promise<any> {
    const result = await this.request('tools/call', {
      name,
      arguments: args || {}
    })
    if (result?.content && Array.isArray(result.content)) {
      return result.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
    }
    return result
  }

  public stop() {
    this.activeTools = []
  }
}

// 2. WebSocket MCP Client (ws:// / wss://)
export class McpWsClient {
  private ws?: any
  private reqId = 1
  private pendingRequests = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>()
  public activeTools: any[] = []

  constructor(public config: McpServerConfig) {}

  public async start(): Promise<any[]> {
    return new Promise((resolve) => {
      try {
        if (!this.config.url) return resolve([])
        console.log(`[MCP] Connecting to WebSocket MCP "${this.config.id}": ${this.config.url}`)
        
        // Node 22 native WebSocket or ws package
        const WSClass = (globalThis as any).WebSocket || require('ws')
        const ws = new WSClass(this.config.url, {
          headers: this.config.headers || {}
        })
        this.ws = ws

        let settled = false
        const finish = (tools: any[]) => {
          if (!settled) {
            settled = true
            this.activeTools = tools
            resolve(tools)
          }
        }

        const timeout = setTimeout(() => {
          if (!settled) {
            console.warn(`[MCP:${this.config.id}] WebSocket connection timeout.`)
            finish([])
          }
        }, 12000)

        ws.onopen = async () => {
          try {
            await this.request('initialize', {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'custom-harness', version: '0.1.0' }
            })
            const toolsRes = await this.request('tools/list', {})
            clearTimeout(timeout)
            const tools = toolsRes?.tools || []
            console.log(`[MCP] WebSocket connected to "${this.config.id}". Discovered ${tools.length} tool(s).`)
            finish(tools)
          } catch (err: any) {
            clearTimeout(timeout)
            console.warn(`[MCP:${this.config.id}] WS Handshake error:`, err.message)
            finish([])
          }
        }

        ws.onmessage = (event: any) => {
          try {
            const dataStr = typeof event.data === 'string' ? event.data : event.data.toString('utf8')
            const msg = JSON.parse(dataStr)
            if (msg.id && this.pendingRequests.has(msg.id)) {
              const { resolve, reject } = this.pendingRequests.get(msg.id)!
              this.pendingRequests.delete(msg.id)
              if (msg.error) {
                reject(new Error(msg.error.message || JSON.stringify(msg.error)))
              } else {
                resolve(msg.result)
              }
            }
          } catch {}
        }

        ws.onerror = (err: any) => {
          console.error(`[MCP:${this.config.id}] WebSocket error:`, err.message || err)
          clearTimeout(timeout)
          finish([])
        }

        ws.onclose = () => {
          this.ws = undefined
        }
      } catch (e: any) {
        console.error(`[MCP:${this.config.id}] WebSocket init failure:`, e.message)
        resolve([])
      }
    })
  }

  public request(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        return reject(new Error(`WebSocket MCP "${this.config.id}" is not connected`))
      }
      const id = this.reqId++
      this.pendingRequests.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  public async callTool(name: string, args: any): Promise<any> {
    const result = await this.request('tools/call', { name, arguments: args || {} })
    if (result?.content && Array.isArray(result.content)) {
      return result.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
    }
    return result
  }

  public stop() {
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = undefined
    }
    this.activeTools = []
  }
}

// 3. Stdio Process / Subprocess Client (CLI, npx, uvx, docker)
export class McpProcessClient {
  private process?: ChildProcess
  private reqId = 1
  private pendingRequests = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>()
  private buffer = ''
  public activeTools: any[] = []

  constructor(public config: McpServerConfig) {}

  public async start(): Promise<any[]> {
    return new Promise((resolve) => {
      try {
        if (!this.config.command) {
          return resolve([])
        }
        console.log(`[MCP] Spawning process for "${this.config.id}": ${this.config.command} ${(this.config.args || []).join(' ')}`)
        const proc = spawn(this.config.command, this.config.args || [], {
          env: { ...process.env, ...this.config.env },
          stdio: ['pipe', 'pipe', 'pipe']
        })
        this.process = proc

        let settled = false
        const finish = (tools: any[]) => {
          if (!settled) {
            settled = true
            this.activeTools = tools
            resolve(tools)
          }
        }

        const timeout = setTimeout(() => {
          if (!settled) {
            console.warn(`[MCP] Timeout waiting for "${this.config.id}" initialization handshake.`)
            finish([])
          }
        }, 12000)

        proc.stdout?.on('data', (chunk: Buffer) => {
          this.handleData(chunk)
        })

        proc.stderr?.on('data', (chunk: Buffer) => {
          const msg = chunk.toString('utf8').trim()
          if (msg) {
            console.log(`[MCP:${this.config.id}:stderr]`, msg)
          }
        })

        proc.on('error', (err) => {
          console.error(`[MCP:${this.config.id}] Process spawn error:`, err.message)
          clearTimeout(timeout)
          finish([])
        })

        proc.on('close', (code) => {
          console.log(`[MCP:${this.config.id}] Process exited with code ${code}`)
          this.process = undefined
        })

        this.request('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'custom-harness', version: '0.1.0' }
        }).then(async () => {
          this.notify('notifications/initialized', {})
          const toolsRes = await this.request('tools/list', {})
          clearTimeout(timeout)
          const tools = toolsRes?.tools || []
          console.log(`[MCP] Successfully connected to "${this.config.id}". Discovered ${tools.length} tool(s): ${tools.map((t: any) => t.name).join(', ')}`)
          finish(tools)
        }).catch((err) => {
          clearTimeout(timeout)
          console.warn(`[MCP:${this.config.id}] Handshake failed:`, err.message)
          finish([])
        })
      } catch (err: any) {
        console.error(`[MCP:${this.config.id}] Failed to start:`, err.message)
        resolve([])
      }
    })
  }

  private handleData(chunk: Buffer) {
    this.buffer += chunk.toString('utf8')
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line)
        if (msg.id && this.pendingRequests.has(msg.id)) {
          const { resolve, reject } = this.pendingRequests.get(msg.id)!
          this.pendingRequests.delete(msg.id)
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)))
          } else {
            resolve(msg.result)
          }
        }
      } catch (e) {
      }
    }
  }

  public request(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin?.writable) {
        return reject(new Error(`MCP server "${this.config.id}" is not running`))
      }
      const id = this.reqId++
      this.pendingRequests.set(id, { resolve, reject })
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
      this.process.stdin.write(payload)
    })
  }

  public notify(method: string, params: any) {
    if (!this.process || !this.process.stdin?.writable) return
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'
    this.process.stdin.write(payload)
  }

  public async callTool(name: string, args: any): Promise<any> {
    const result = await this.request('tools/call', {
      name,
      arguments: args || {}
    })
    if (result?.content && Array.isArray(result.content)) {
      return result.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
    }
    return result
  }

  public stop() {
    if (this.process) {
      this.process.kill()
      this.process = undefined
    }
  }
}


export const name = 'mcp-client'
export const inject = ['tools']

export class McpClientService extends Service {
  declare ctx: Context
  private serverConfigs = new Map<string, McpServerConfig>()
  private clients = new Map<string, McpProcessClient | McpHttpClient | McpWsClient>()
  private serverDisposers = new Map<string, Array<() => void>>()

  constructor(ctx: Context) {
    super(ctx, 'mcpClient')
    this.discoverConfigs()
    this.connectAll().catch(err => {
      console.warn('[MCP] Error connecting servers:', err)
    })
  }

  public discoverConfigs() {
    const configPaths = [
      path.join(process.cwd(), 'mcp.json'),
      path.join(process.cwd(), '.mcp.json'),
      path.resolve(process.cwd(), '../../mcp.json'),
      path.resolve(process.cwd(), '../../.mcp.json'),
      path.resolve(process.cwd(), '../mcp.json'),
      path.resolve(process.cwd(), '../.mcp.json'),
      path.join(os.homedir(), '.gemini', 'antigravity-ide', 'mcp_config.json'),
      path.join(os.homedir(), '.dsh', 'mcp.json')
    ]

    for (const p of configPaths) {
      if (!fs.existsSync(p)) continue
      try {
        const raw = fs.readFileSync(p, 'utf8')
        const json = JSON.parse(raw)
        const servers = json.mcpServers || json.servers || json
        if (typeof servers === 'object') {
          for (const [id, srv] of Object.entries(servers)) {
            if (typeof srv === 'object') {
              const item = srv as any
              if (item.url?.startsWith('ws://') || item.url?.startsWith('wss://') || item.type === 'ws' || item.type === 'websocket') {
                this.registerServer({
                  id,
                  name: item.name || id,
                  type: 'websocket',
                  url: item.url,
                  headers: item.headers || {}
                })
              } else if (item.url || item.type === 'http' || item.type === 'sse') {
                this.registerServer({
                  id,
                  name: item.name || id,
                  type: item.type || 'http',
                  url: item.url,
                  headers: item.headers || {}
                })
              } else if (item.command) {
                this.registerServer({
                  id,
                  name: item.name || id,
                  type: 'stdio',
                  command: item.command,
                  args: item.args || [],
                  env: item.env || {}
                })
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[MCP] Failed to parse config at ${p}:`, e)
      }
    }
  }

  public registerServer(config: McpServerConfig) {
    if (this.serverConfigs.has(config.id)) return
    this.serverConfigs.set(config.id, config)
    console.log(`[MCP] Registered server configuration: ${config.id} (${config.url || config.command})`)
  }

  public async connectAll() {
    for (const [id, config] of this.serverConfigs.entries()) {
      if (!this.clients.has(id)) {
        await this.connectServer(config)
      }
    }
  }

  public async connectServer(config: McpServerConfig) {
    // 1. Clean up any previous registrations for this server
    this.cleanupServerTools(config.id)

    let client: McpProcessClient | McpHttpClient | McpWsClient
    if (config.url?.startsWith('ws://') || config.url?.startsWith('wss://') || config.type === 'ws' || config.type === 'websocket') {
      client = new McpWsClient(config)
    } else if (config.url || config.type === 'http' || config.type === 'sse') {
      client = new McpHttpClient(config)
    } else {
      client = new McpProcessClient(config)
    }
    this.clients.set(config.id, client)
    const tools = await client.start()

    const disposers: Array<() => void> = []
    for (const tool of tools) {
      const sanitizedServerId = config.id.replace(/[^a-zA-Z0-9_]/g, '_')
      const toolName = `mcp_${sanitizedServerId}_${tool.name}`

      const disposer = this.ctx.tools.register(
        defineTool({
          name: toolName,
          description: `[MCP: ${config.id}] ${tool.description || tool.name}`,
          parameters: tool.inputSchema || { type: 'object', properties: {} },
          execute: async (args: any) => {
            return await client.callTool(tool.name, args)
          }
        })
      )
      disposers.push(disposer)
    }
    this.serverDisposers.set(config.id, disposers)
  }

  private cleanupServerTools(id: string) {
    const disposers = this.serverDisposers.get(id)
    if (disposers) {
      for (const disposer of disposers) {
        try { disposer() } catch (e) {}
      }
      this.serverDisposers.delete(id)
    }
  }

  public listServers(): Array<McpServerConfig & { toolsCount: number; connected: boolean }> {
    return Array.from(this.serverConfigs.values()).map(cfg => {
      const client = this.clients.get(cfg.id)
      return {
        ...cfg,
        connected: !!client,
        toolsCount: client?.activeTools.length || 0
      }
    })
  }

  public async removeServer(id: string): Promise<boolean> {
    const client = this.clients.get(id)
    if (client) {
      client.stop()
      this.clients.delete(id)
    }
    this.cleanupServerTools(id)
    const existed = this.serverConfigs.delete(id)
    this.saveConfigFile()
    return existed
  }

  public async toggleServer(id: string): Promise<{ connected: boolean; toolsCount: number }> {
    const config = this.serverConfigs.get(id)
    if (!config) throw new Error(`MCP server '${id}' not found.`)

    const client = this.clients.get(id)
    if (client) {
      client.stop()
      this.clients.delete(id)
      this.cleanupServerTools(id)
      return { connected: false, toolsCount: 0 }
    } else {
      await this.connectServer(config)
      const newClient = this.clients.get(id)
      return { connected: true, toolsCount: newClient?.activeTools.length || 0 }
    }
  }

  public saveConfigFile() {
    try {
      const targetPath = path.join(process.cwd(), 'mcp.json')
      const serversObj: Record<string, any> = {}
      for (const [id, cfg] of this.serverConfigs.entries()) {
        if (cfg.url) {
          serversObj[id] = {
            type: cfg.type || 'http',
            url: cfg.url,
            headers: cfg.headers || {}
          }
        } else {
          serversObj[id] = {
            type: 'stdio',
            command: cfg.command,
            args: cfg.args || [],
            env: cfg.env || {}
          }
        }
      }
      const data = { mcpServers: serversObj }
      fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf8')
    } catch (e: any) {
      console.warn('[MCP] Failed to save mcp.json:', e.message)
    }
  }

  public disconnectAll() {
    for (const client of this.clients.values()) {
      client.stop()
    }
    this.clients.clear()
    for (const [id] of this.serverConfigs.entries()) {
      this.cleanupServerTools(id)
    }
  }
}



export function apply(ctx: Context) {
  const service = new McpClientService(ctx)
  ctx.set('mcpClient', service)

  ctx.on('dispose', () => {
    service.disconnectAll()
  })

  // Register mcp management tool
  ctx.tools.register(
    defineTool({
      name: 'mcp',
      description: 'Model Context Protocol (MCP) tool manager. Discovers, connects and lists active external MCP tool servers.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list_servers', 'reload_configs', 'connect_all'],
            description: 'Action to perform.'
          }
        },
        required: ['action']
      },
      async execute({ action }: { action: 'list_servers' | 'reload_configs' | 'connect_all' }) {
        if (action === 'reload_configs' || action === 'connect_all') {
          service.discoverConfigs()
          await service.connectAll()
        }
        const list = service.listServers()
        if (list.length === 0) {
          return 'No active MCP servers found in mcp.json or workspace configs.'
        }
        return `### Active MCP Servers (${list.length}):\n\n` + list.map(s => `- **${s.id}** (${s.connected ? `Connected, ${s.toolsCount} tools` : 'Disconnected'}): \`${s.command} ${(s.args || []).join(' ')}\``).join('\n')
      }
    })
  )
}

export default McpClientService
