import type {
  AgentMiddlewareDefinition,
  BeforeChatContext,
  BeforeToolContext,
  AfterToolContext,
  AfterChatContext
} from './types.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isEnabledForPreset(mw: AgentMiddlewareDefinition, presetId?: string): boolean {
  if (!mw.presets || mw.presets.length === 0) return true
  if (!presetId) return false
  return mw.presets.includes(presetId)
}

/**
 * Generic Koa-style async middleware pipeline runner.
 * Filters & sorts middleware by `order`, then chains them via `next()`.
 */
async function createPipeline<TCtx>(
  all: AgentMiddlewareDefinition[],
  presetId: string | undefined,
  hookKey: 'beforeChat' | 'beforeTool' | 'afterTool' | 'afterChat',
  ctx: TCtx
): Promise<void> {
  const active = all
    .filter(m => typeof m[hookKey] === 'function' && isEnabledForPreset(m, presetId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  let index = 0
  const next = async (): Promise<void> => {
    const mw = active[index++]
    if (mw) {
      await (mw[hookKey] as any)(ctx, next)
    }
  }
  await next()
}

// ---------------------------------------------------------------------------
// Public pipeline runners
// ---------------------------------------------------------------------------

export async function runBeforeChatPipeline(
  middlewares: AgentMiddlewareDefinition[],
  ctx: BeforeChatContext
): Promise<void> {
  await createPipeline(middlewares, ctx.preset?.id, 'beforeChat', ctx)
}

export async function runBeforeToolPipeline(
  middlewares: AgentMiddlewareDefinition[],
  ctx: BeforeToolContext
): Promise<{ shouldBlock: boolean; output?: any }> {
  // Wrap next so that once skipExecution is set the chain stops
  const active = middlewares
    .filter(m => typeof m.beforeTool === 'function' && isEnabledForPreset(m, ctx.preset?.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  let index = 0
  const next = async (): Promise<void> => {
    if (ctx.skipExecution) return
    const mw = active[index++]
    if (mw?.beforeTool) {
      await mw.beforeTool(ctx, next)
    }
  }
  await next()

  return { shouldBlock: Boolean(ctx.skipExecution), output: ctx.customOutput }
}

export async function runAfterToolPipeline(
  middlewares: AgentMiddlewareDefinition[],
  ctx: AfterToolContext
): Promise<any> {
  await createPipeline(middlewares, ctx.preset?.id, 'afterTool', ctx)
  return ctx.output
}

export async function runAfterChatPipeline(
  middlewares: AgentMiddlewareDefinition[],
  ctx: AfterChatContext
): Promise<{ shouldContinue: boolean; prompt?: string }> {
  await createPipeline(middlewares, ctx.preset?.id, 'afterChat', ctx)
  return { shouldContinue: Boolean(ctx.shouldContinue), prompt: ctx.continuationPrompt }
}
