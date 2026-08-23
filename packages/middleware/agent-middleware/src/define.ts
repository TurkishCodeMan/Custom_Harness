import type { AgentMiddlewareDefinition } from './types.js'

/**
 * Convenience factory that validates and returns a typed middleware definition.
 * TypeScript inference handles the rest — no runtime cost.
 *
 * @example
 * ```ts
 * export const myMiddleware = defineMiddleware({
 *   name: 'my-middleware',
 *   order: 10,
 *   beforeTool: async (ctx, next) => {
 *     console.log('[my-middleware] beforeTool:', ctx.toolName)
 *     await next()
 *   }
 * })
 * ```
 */
export function defineMiddleware(def: AgentMiddlewareDefinition): AgentMiddlewareDefinition {
  return def
}
