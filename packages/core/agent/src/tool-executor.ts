import type { Context } from '@custom-harness/core-context'
import type { ToolExecutionContext } from './types.js'

/**
 * Common helper to emit the tool result callback and persist the tool response to session messages.
 * Eliminates repetitive DRY violations across approval, guardrail, and middleware checkpoints.
 */
export function recordAndEmitToolResult(
  ctx: Context,
  execContext: ToolExecutionContext,
  callId: string,
  toolName: string,
  outputContent: string
): void {
  execContext.onToolResult?.({ id: callId, name: toolName, output: outputContent })
  ctx.session.appendMessage(execContext.sessionId, {
    role: 'tool',
    tool_call_id: callId,
    name: toolName,
    content: outputContent
  })
}

/**
 * Executes a single tool call through the complete 7-step safety and execution lifecycle:
 * 1. BeforeTool Middleware (Permissions / Guardrails)
 * 2. Human-in-the-loop Approval
 * 3. Repeat Loop Guard
 * 4. Tool Execution
 * 5. SpillStore / Result Pruning
 * 6. AfterTool Middleware
 * 7. Persistence & Event Emission
 */
export async function executeToolCall(
  ctx: Context,
  call: { id: string; name: string; arguments: string },
  execContext: ToolExecutionContext
): Promise<void> {
  const { sessionId, userId, activePreset, turnCount, signal, cwd } = execContext

  let parsedArgs: any = {}
  try {
    parsedArgs = JSON.parse(call.arguments || '{}')
  } catch {
    parsedArgs = { raw: call.arguments }
  }

  // 1. BeforeTool Middleware (tool-guard, permissions, sql safety)
  if (ctx.agentMiddleware?.runBeforeTool) {
    const toolCheck = await ctx.agentMiddleware.runBeforeTool({
      sessionId,
      userId,
      preset: activePreset,
      turnCount,
      signal,
      toolName: call.name,
      params: parsedArgs,
      toolCallId: call.id
    })

    if (toolCheck.shouldBlock) {
      const blockedOutput = toolCheck.output ?? `[Erişim Engeli]: '${call.name}' araç çağrısı güvenlik politikası gereği durduruldu.`
      recordAndEmitToolResult(ctx, execContext, call.id, call.name, blockedOutput)
      return
    }
  }

  // 2. Human-in-the-loop Approval Check
  if (ctx.approval) {
    try {
      const outcome = await ctx.approval.requestApproval(sessionId, call.name, parsedArgs, undefined, signal)
      if (outcome === 'deny') {
        const deniedOutput = `[İptal Edildi]: Kullanıcı bu araç çağrısını onaylamadı (${call.name})`
        recordAndEmitToolResult(ctx, execContext, call.id, call.name, deniedOutput)
        return
      }
    } catch (err: any) {
      const abortOutput = `[İptal]: ${err.message}`
      recordAndEmitToolResult(ctx, execContext, call.id, call.name, abortOutput)
      return
    }
  }

  // 3. Repeat Loop Guard Check
  let guardCheck: { isLooping: boolean; reminder?: string; shouldBlock?: boolean } | undefined = undefined
  if (ctx.repeatGuard) {
    guardCheck = ctx.repeatGuard.inspectCall(sessionId, call.name, parsedArgs)
    if (guardCheck?.shouldBlock) {
      const blockedOutput = guardCheck.reminder || `[Döngü Engellendi]: Bu araç çağrısı çok fazla tekrar ettiği için durduruldu.`
      recordAndEmitToolResult(ctx, execContext, call.id, call.name, blockedOutput)
      return
    }
  }

  // 4. Physical Tool Execution
  let output: any = ''
  try {
    if (!ctx.tools) {
      throw new Error("[AgentService] 'tools' servisi Context üzerinde bulunamadı.")
    }
    output = await ctx.tools.execute(call.name, parsedArgs, { signal, cwd, sessionId })
  } catch (err: any) {
    output = `Araç Çalıştırma Hatası: ${err.message}`
  }

  // 5. SpillStore / Pruning
  let outputContent = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
  if (ctx.spillStore?.processOutput) {
    const spill = await ctx.spillStore.processOutput(output, sessionId, call.name)
    outputContent = spill.modelText
  } else if (ctx.toolResultPruner) {
    outputContent = ctx.toolResultPruner.prune(outputContent).text
  }

  // 6. AfterTool Middleware
  if (ctx.agentMiddleware?.runAfterTool) {
    outputContent = await ctx.agentMiddleware.runAfterTool({
      sessionId,
      userId,
      preset: activePreset,
      turnCount,
      signal,
      toolName: call.name,
      params: parsedArgs,
      toolCallId: call.id,
      output: outputContent
    })
  }

  if (guardCheck?.isLooping && guardCheck.reminder) {
    outputContent += `\n\n${guardCheck.reminder}`
  }

  // 7. Persist Tool Result in session
  recordAndEmitToolResult(ctx, execContext, call.id, call.name, outputContent)
}
