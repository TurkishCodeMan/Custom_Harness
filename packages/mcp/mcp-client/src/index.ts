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
  command: string
  args?: string[]
  env?: Record<string, string>
}

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
            // Diagnostics / logs
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

        // MCP JSON-RPC Handshake
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
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const msg = JSON.parse(trimmed)
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
        // Not a JSON-RPC message line
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
  private clients = new Map<string, McpProcessClient>()
  private registeredToolsDisposers: Array<() => void> = []

  constructor(ctx: Context) {
    super(ctx, 'mcpClient')
    this.discoverConfigs()
    // Automatically connect on initialization
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
            if (typeof srv === 'object' && (srv as any).command) {
              this.registerServer({
                id,
                name: (srv as any).name || id,
                command: (srv as any).command,
                args: (srv as any).args || [],
                env: (srv as any).env || {}
              })
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
    console.log(`[MCP] Registered server configuration: ${config.id} (${config.command})`)
  }

  public async connectAll() {
    for (const [id, config] of this.serverConfigs.entries()) {
      if (!this.clients.has(id)) {
        await this.connectServer(config)
      }
    }
  }

  public async connectServer(config: McpServerConfig) {
    const client = new McpProcessClient(config)
    this.clients.set(config.id, client)
    const tools = await client.start()

    for (const tool of tools) {
      const sanitizedServerId = config.id.replace(/[^a-zA-Z0-9_]/g, '_')
      const toolName = `mcp_${sanitizedServerId}_${tool.name}`

      // Register prefixed MCP tool into context tools
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
      this.registeredToolsDisposers.push(disposer)

      // Also register direct tool name alias if not already occupied
      if (!this.ctx.tools.get(tool.name)) {
        const aliasDisposer = this.ctx.tools.register(
          defineTool({
            name: tool.name,
            description: `[MCP: ${config.id}] ${tool.description || tool.name}`,
            parameters: tool.inputSchema || { type: 'object', properties: {} },
            execute: async (args: any) => {
              return await client.callTool(tool.name, args)
            }
          })
        )
        this.registeredToolsDisposers.push(aliasDisposer)
      }
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

  public disconnectAll() {
    for (const client of this.clients.values()) {
      client.stop()
    }
    this.clients.clear()
    for (const disposer of this.registeredToolsDisposers) {
      try { disposer() } catch (e) {}
    }
    this.registeredToolsDisposers = []
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
