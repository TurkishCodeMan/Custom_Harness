import type { Context } from '@custom-harness/core-context'
import type { ToolExecutionContext } from './types.js'
import { validateJsonSchema } from './schema-validator.js'
import { parseDelegationTargetId } from './tool-scoper.js'

export interface DelegationCallContext {
  callerPresetId: string
  targetPresetId: string
  traceId: string
  callStack: string[]
  depth: number
}

/**
 * Executes a contract-safe agent-to-agent delegation call.
 * 1. Resolves target preset and its AgentContract.
 * 2. Enforces Bi-directional Access Control (allowedDelegates & allowedCallers).
 * 3. Enforces DAG recursion depth limits and cyclic delegation prevention.
 * 4. Validates input payload strictly against target's inputSchema.
 * 5. Runs target in an isolated context (zero parent chat history leakage).
 * 6. Validates target's output against target's outputSchema.
 * 7. Returns structured JSON result and emits auditable trace receipt.
 */
export async function executeContractDelegation(
  ctx: Context,
  call: { id: string; name: string; arguments: string },
  execContext: ToolExecutionContext
): Promise<any> {
  const rawTargetId = parseDelegationTargetId(call.name)
  if (!rawTargetId) {
    throw new Error(`[Delegation] Invalid delegation tool name: '${call.name}'`)
  }

  const callerPreset = execContext.activePreset
  const callerId = callerPreset?.id || callerPreset?.name || 'unknown-caller'

  // 1. Resolve Target Preset (with hyphen/underscore normalization)
  const presetsResolver: any = (ctx as any).agentPresets || (ctx as any).settings
  const normalizedTargetId = rawTargetId.replace(/_/g, '-')
  const targetPreset =
    presetsResolver?.get?.(rawTargetId) ??
    presetsResolver?.getPreset?.(rawTargetId) ??
    presetsResolver?.get?.(normalizedTargetId) ??
    presetsResolver?.getPreset?.(normalizedTargetId) ??
    (presetsResolver?.list ? presetsResolver.list().find((p: any) =>
      p.id === rawTargetId ||
      p.id === normalizedTargetId ||
      p.id?.replace(/[^a-zA-Z0-9_]/g, '_') === rawTargetId
    ) : undefined)

  if (!targetPreset) {
    return {
      status: 'error',
      code: 'TARGET_NOT_FOUND',
      error: `Delegation target preset '${rawTargetId}' was not found in the registry.`
    }
  }

  // Canonical preset id
  const targetId = targetPreset.id || normalizedTargetId

  // 2. DAG Recursion & Cycle Prevention (Fail-Safe Top-Level Guard)
  const parentSession = ctx.session?.getSession?.(execContext.sessionId)
  const existingStack: string[] = (parentSession as any)?.delegationCallStack || [callerId]
  const maxDepth = targetPreset.contract?.budget?.maxDelegationDepth ?? 3

  if (existingStack.includes(targetId) || existingStack.includes(rawTargetId) || existingStack.includes(normalizedTargetId)) {
    return {
      status: 'error',
      code: 'CYCLIC_DELEGATION_DETECTED',
      error: `Cyclic delegation prohibited: '${callerId}' -> '${targetId}'. Call chain: ${existingStack.join(' -> ')} -> ${targetId}`
    }
  }

  if (existingStack.length >= maxDepth) {
    return {
      status: 'error',
      code: 'MAX_DELEGATION_DEPTH_EXCEEDED',
      error: `Maximum delegation depth (${maxDepth}) exceeded. Current depth: ${existingStack.length}. Call stack: ${existingStack.join(' -> ')}`
    }
  }

  // 3. Bi-directional Access Control Check
  const allowedDelegates: string[] = callerPreset?.contract?.allowedDelegates || callerPreset?.allowedDelegates || []
  const hasOutboundAccess =
    allowedDelegates.includes('*') ||
    allowedDelegates.includes(targetId) ||
    allowedDelegates.includes(rawTargetId) ||
    allowedDelegates.includes(normalizedTargetId)

  if (!hasOutboundAccess) {
    return {
      status: 'error',
      code: 'OUTBOUND_PERMISSION_DENIED',
      error: `Caller '${callerId}' is not authorized to delegate to '${targetId}'.`
    }
  }

  const targetCallers: string[] = targetPreset.contract?.allowedCallers || targetPreset.allowedCallers || []
  if (targetCallers.length > 0 && !targetCallers.includes(callerId) && !targetCallers.includes('*')) {
    return {
      status: 'error',
      code: 'INBOUND_PERMISSION_DENIED',
      error: `Target '${targetId}' does not accept delegation calls from caller '${callerId}'.`
    }
  }

  // 4. Strict Contract Availability Check
  const isCallable = targetPreset.contract ? targetPreset.contract.isCallableByAgents : (targetPreset.isCallableByAgents ?? true)
  const inputSchema = targetPreset.contract?.inputSchema ?? targetPreset.inputSchema
  if (!isCallable || !inputSchema) {
    return {
      status: 'error',
      code: 'TARGET_NOT_CALLABLE',
      error: `Target '${targetId}' has not defined an inputSchema and cannot be invoked as an agent delegation service.`
    }
  }

  // 5. Parse & Validate Input Payload
  let parsedArgs: any = {}
  try {
    parsedArgs = typeof call.arguments === 'string' ? JSON.parse(call.arguments || '{}') : call.arguments
  } catch (err: any) {
    return {
      status: 'error',
      code: 'MALFORMED_JSON_ARGUMENTS',
      error: `Tool arguments must be valid JSON: ${err.message}`
    }
  }

  const inputValidation = validateJsonSchema(inputSchema, parsedArgs)
  if (!inputValidation.valid) {
    return {
      status: 'error',
      code: 'INPUT_SCHEMA_VIOLATION',
      error: `Delegation payload failed inputSchema validation for target '${targetId}':`,
      validationErrors: inputValidation.errors
    }
  }

  const nextStack = [...existingStack, targetId]
  const traceId = (parentSession as any)?.traceId || `trace_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const startTime = Date.now()

  // 6. Execute in an Isolated Sub-Session (Zero Parent Context Leakage)
  const subSessionTitle = `[Contract Delegation: ${callerId} -> ${targetId}]`
  const subSession = ctx.session.createSession(
    subSessionTitle,
    execContext.cwd,
    execContext.userId,
    'web',
    false,
    true // isInternal = true (does not pollute user UI session list)
  )

  ;(subSession as any).isDelegationTrace = true
  ;(subSession as any).traceId = traceId
  ;(subSession as any).parentSessionId = execContext.sessionId
  ;(subSession as any).delegationCallStack = nextStack
  ctx.session.saveSession?.(subSession)

  // Contract-Safe Output Schema Enforcement:
  const outputSchema = targetPreset.contract?.outputSchema ?? targetPreset.outputSchema
  const delegationResponseFormat = outputSchema
    ? {
        type: 'json_schema' as const,
        json_schema: {
          name: `${targetId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)}_output`,
          strict: true,
          schema: outputSchema
        }
      }
    : undefined

  // Construct structured prompt containing ONLY the schema-validated payload
  const prompt =
    `[ORGANIZATIONAL CONTRACT INVOCATION]\n` +
    `You are serving as '${targetPreset.name || targetId}'.\n` +
    `Caller: '${callerId}' (Trace: ${traceId})\n` +
    `Input Payload:\n${JSON.stringify(parsedArgs, null, 2)}\n\n` +
    `Execute this subtask strictly according to your preset policy. Provide your final response in clean structured JSON.`

  let rawResult = ''
  try {
    rawResult = await ctx.agent.run({
      sessionId: subSession.id,
      prompt,
      presetId: targetPreset.id,
      isInternal: true,
      workspace: execContext.cwd,
      userId: execContext.userId,
      signal: execContext.signal,
      responseFormat: delegationResponseFormat
    })
  } catch (runErr: any) {
    return {
      status: 'error',
      code: 'EXECUTION_FAILED',
      error: `Delegated agent '${targetId}' encountered an error: ${runErr.message}`
    }
  } finally {
    // Cleanup sub-session if needed or preserve for audit
  }

  // 7. Extract & Validate Output Payload against outputSchema (if present)
  let parsedOutput: any = rawResult
  try {
    // Attempt to extract JSON from markdown or raw text
    const jsonMatch = rawResult.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    const candidate = jsonMatch ? jsonMatch[1].trim() : rawResult.trim()
    parsedOutput = JSON.parse(candidate)
  } catch {
    // If not JSON, leave as raw string
  }

  if (outputSchema && typeof parsedOutput === 'object') {
    let outputValidation = validateJsonSchema(outputSchema, parsedOutput)
    if (!outputValidation.valid) {
      // 7b. Self-Healing Schema Pass: If tools were active during ReAct loop and prevented json_schema enforcement,
      // run an immediate tool-free final synthesis turn using responseFormat to strictly map findings to schema.
      try {
        const reformatPrompt =
          `[CONTRACT SCHEMA CORRECTION]\n` +
          `Your previous analysis was accurate, but the output structure did not strictly match the required outputSchema.\n` +
          `Errors: ${JSON.stringify(outputValidation.errors)}\n` +
          `Original Raw Finding:\n${typeof parsedOutput === 'string' ? parsedOutput : JSON.stringify(parsedOutput, null, 2)}\n\n` +
          `Format your finding into a single strictly compliant JSON object adhering to your contract schema.`

        const reformatted = await ctx.agent.run({
          sessionId: subSession.id,
          prompt: reformatPrompt,
          presetId: targetPreset.id,
          isInternal: true,
          workspace: execContext.cwd,
          userId: execContext.userId,
          signal: execContext.signal,
          maxTurns: 1,
          responseFormat: delegationResponseFormat
        })

        const secondMatch = reformatted.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        const secondCandidate = secondMatch ? secondMatch[1].trim() : reformatted.trim()
        const secondParsed = JSON.parse(secondCandidate)
        const secondValidation = validateJsonSchema(outputSchema, secondParsed)
        if (secondValidation.valid) {
          parsedOutput = secondParsed
          outputValidation = secondValidation
        }
      } catch (err: any) {
        // Fall back to partial_success if reformatting fails
      }
    }

    if (!outputValidation.valid) {
      console.warn(`[Delegation Warning] Target '${targetId}' output violated outputSchema:`, outputValidation.errors)
      return {
        status: 'partial_success',
        warning: 'Output did not strictly match outputSchema contract',
        validationErrors: outputValidation.errors,
        result: parsedOutput
      }
    }
  }

  const durationMs = Date.now() - startTime

  // Emit delegation completion event for audit receipts
  ;(ctx as any).emit?.('agent/delegation_completed', {
    traceId,
    callerPreset: callerId,
    targetPreset: targetId,
    contractVersion: targetPreset.contract?.contractVersion || 1,
    durationMs,
    input: parsedArgs,
    output: parsedOutput
  })

  return {
    status: 'success',
    delegatedTo: targetId,
    durationMs,
    data: parsedOutput
  }
}
