import type { Context } from '@custom-harness/core-context'
import * as baseBundle from '@custom-harness/bundle-base'
import * as server from '@custom-harness/server'
import * as serverHttp from '@custom-harness/server-http'

export const name = 'bundle-web-app'

export function apply(ctx: Context) {
  // Enable Redis Queue for Big-Data RAG coordination in Web App runtime
  if (process.env.RAG_ENABLE_REDIS === undefined) {
    process.env.RAG_ENABLE_REDIS = 'true'
  }

  // 1. Load Base Bundle (Services, Tools, Seams, LLM)
  ctx.plugin(baseBundle)

  // 2. Load Server Seam & HTTP Provider (Express, WebSocket, Modular UI Bundler)
  ctx.plugin(server)
  ctx.plugin(serverHttp)
}



