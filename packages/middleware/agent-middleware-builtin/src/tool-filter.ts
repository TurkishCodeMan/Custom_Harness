import { defineMiddleware } from '@custom-harness/agent-middleware'

/**
 * tool-filter (beforeChat, order: -90)
 *
 * Filters the tool schema list sent to the LLM based on the active preset's
 * `enabledTools` whitelist. This prevents the model from even seeing — and
 * therefore attempting to call — tools that are not permitted for the preset.
 *
 * Works in tandem with tool-guard (beforeTool) which acts as a defense-in-depth
 * execution block for any calls that still slip through.
 */
export const toolFilterMiddleware = defineMiddleware({
  name: 'tool-filter',
  order: -90, // Runs after tool-guard (-100) but before any chat-level middleware
  beforeChat: async (ctx, next) => {
    const enabledTools = ctx.preset?.enabledTools
    if (!enabledTools || !Array.isArray(enabledTools) || enabledTools.length === 0) {
      await next()
      return
    }

    const allowedSet = new Set(enabledTools)
    ctx.tools = ctx.tools.filter((t: any) => {
      const name = t.function?.name ?? t.name
      return allowedSet.has(name)
    })

    await next()
  }
})
