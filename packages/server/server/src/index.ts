import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type http from 'node:http'
import type { WebSocketServer } from 'ws'
import type express from 'express'

export interface ServerInfo {
  port: number
  url: string
  address: string
}

export abstract class ServerService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'server')
  }

  /**
   * Returns the bound TCP port if listening, otherwise undefined.
   */
  public abstract getPort(): number | undefined

  /**
   * Returns the full base URL (e.g. http://127.0.0.1:3080) if running.
   */
  public abstract getUrl(): string | undefined

  /**
   * Returns whether the web and WebSocket server is actively running.
   */
  public abstract isRunning(): boolean

  /**
   * Returns the underlying Node.js HTTP Server instance.
   */
  public abstract getHttpServer(): http.Server | undefined

  /**
   * Returns the WebSocket Server instance for real-time gateway events.
   */
  public abstract getWebSocketServer(): WebSocketServer | undefined

  /**
   * Returns the Express application instance for mounting custom routes/middleware.
   */
  public abstract getApp(): express.Express | undefined

  /**
   * Starts listening on the given port (or process.env.PORT / default 3080).
   */
  public abstract start(port?: number): Promise<ServerInfo>

  /**
   * Gracefully shuts down HTTP and WebSocket servers.
   */
  public abstract stop(): Promise<void>
}

export const name = 'server'

export function apply(ctx: Context) {
  // Capability Seam: Service Definition
}

export default ServerService
