import type { Context } from '@custom-harness/core-context'
import * as baseBundle from '@custom-harness/bundle-base'

export interface HeadlessConfig {
  llmPlugin?: any
}

export const name = 'bundle-headless'

export function apply(ctx: Context, config: HeadlessConfig = {}) {
  // Load full base bundle (Infrastructure, Seams, LLM, Tools)
  ctx.plugin(baseBundle)

  if (config.llmPlugin) {
    ctx.plugin(config.llmPlugin)
  }
}



