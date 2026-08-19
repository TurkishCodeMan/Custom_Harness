import type { Context } from '@custom-harness/core-context'
import * as baseBundle from '@custom-harness/bundle-base'
import * as server from '@custom-harness/server'

export const name = 'bundle-web-app'

export async function apply(ctx: Context) {
  // 1. Load Base Bundle (Services, Tools, Seams, LLM)
  await ctx.plugin(baseBundle)

  // 2. Load Web Server (Express, WebSocket, Modular UI Bundler)
  await ctx.plugin(server)
}

