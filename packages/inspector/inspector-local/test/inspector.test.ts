import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@custom-harness/core-context'
import * as agentMiddlewarePlugin from '@custom-harness/agent-middleware'
import * as inspectorSeam from '@custom-harness/inspector'
import * as inspectorLocalPlugin from '../src/index.js'

describe('Inspector Cordis Service & Interceptor Tests', async () => {
  const ctx = new Context()
  ctx.provide('session', { getSession: () => null } as any)
  ctx.provide('tokenMeter', { estimateText: (t: string) => Math.ceil(t.length / 3.6) } as any)
  ctx.plugin(agentMiddlewarePlugin)
  ctx.plugin(inspectorSeam)
  ctx.plugin(inspectorLocalPlugin)
  await ctx.start()

  test('1. Service Registration & Injection Seam', () => {
    assert.ok(ctx.inspector, 'Inspector service must be registered on Context')
    assert.equal(inspectorLocalPlugin.name, 'inspector-local')
    assert.deepEqual(inspectorLocalPlugin.inject, ['agentMiddleware', 'session', 'tokenMeter'])
    assert.deepEqual(inspectorSeam.inject, [])
  })

  test('2. Manual Snapshot Recording Lifecycle', async () => {
    const sessionId = 'test_session_101'
    const snapshot: any = {
      id: 'turn_101_1',
      sessionId,
      turnCount: 1,
      timestamp: Date.now(),
      status: 'running',
      input: {
        sessionId,
        prompt: 'Faturayı kontrol et',
        userId: 'user_1'
      },
      context: {
        systemPrompt: 'Sen Company ABC Finans Uzmanısın.',
        sessionMessagesCount: 1,
        conversationMessagesCount: 1
      },
      llmPayload: {
        provider: 'openai',
        model: 'gpt-4o',
        messagesToSend: [
          { role: 'system', content: 'Sen Company ABC Finans Uzmanısın.' },
          { role: 'user', content: 'Faturayı kontrol et' }
        ],
        tools: [{ type: 'function', function: { name: 'read_invoice' } }],
        estimatedTokens: { totalTokens: 42 }
      },
      toolExecutions: []
    }

    await ctx.inspector.recordTurnStart(snapshot)

    const latest = await ctx.inspector.getLatest(sessionId)
    assert.ok(latest, 'Latest snapshot must exist')
    assert.equal(latest.id, 'turn_101_1')
    assert.equal(latest.llmPayload.messagesToSend.length, 2)
    assert.equal(latest.llmPayload.tools.length, 1)

    // Record tool execution
    await ctx.inspector.recordToolExecution(sessionId, {
      callId: 'call_1',
      toolName: 'read_invoice',
      args: { invoiceId: 'INV-2026' },
      output: 'Total: 5000 TL',
      durationMs: 45
    })

    const withTool = await ctx.inspector.getLatest(sessionId)
    assert.equal(withTool?.toolExecutions?.length, 1)
    assert.equal(withTool?.toolExecutions?.[0].toolName, 'read_invoice')

    // Record turn end
    await ctx.inspector.recordTurnEnd(sessionId, {
      assistantContent: 'Fatura doğrulandı.',
      thinkingContent: 'Hesaplamalar yapıldı.',
      usage: { promptTokens: 42, completionTokens: 15, totalTokens: 57 }
    })

    const completed = await ctx.inspector.getLatest(sessionId)
    assert.equal(completed?.status, 'completed')
    assert.equal(completed?.llmResponse?.assistantContent, 'Fatura doğrulandı.')
    assert.equal(completed?.llmResponse?.usage?.totalTokens, 57)
  })

  test('3. AgentMiddleware Pipeline Interception', async () => {
    const sessionId = 'mw_session_202'
    const beforeCtx: any = {
      sessionId,
      turnCount: 2,
      systemPrompt: 'System instructions',
      messages: [{ role: 'user', content: 'Merhaba' }],
      tools: [],
      options: { provider: 'test-provider', model: 'test-model' }
    }

    // Run middleware pipeline
    await ctx.agentMiddleware.runBeforeChat(beforeCtx)

    const captured = await ctx.inspector.getLatest(sessionId)
    assert.ok(captured, 'Inspector middleware must automatically capture beforeChat')
    assert.equal(captured.sessionId, sessionId)
    assert.equal(captured.turnCount, 2)
    assert.equal(captured.llmPayload.messagesToSend[0].role, 'system')
    assert.equal(captured.llmPayload.messagesToSend[0].content, 'System instructions')
    assert.equal(captured.llmPayload.messagesToSend[1].content, 'Merhaba')
  })

  test('4. Query and Clear', async () => {
    const queryResults = await ctx.inspector.query({ sessionId: 'test_session_101' })
    assert.equal(queryResults.length, 1)

    await ctx.inspector.clear('test_session_101')
    assert.equal(await ctx.inspector.getLatest('test_session_101'), undefined)
  })
})
