import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { Context, Service } from 'cordis'
import { LlmService, type StreamEvent } from '../src/index.js'

class MockService extends Service {
  constructor(ctx: Context, name: string, impl: any) {
    super(ctx, name)
    Object.assign(this, impl)
  }
}

describe('LlmService — Retry, Token Usage & Structured Output', () => {
  let server: http.Server
  let port: number
  let baseUrl: string
  let requestCount = 0
  let lastRequestBody: any = null
  let mockHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void

  before(async () => {
    server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
      requestCount++
      let raw = ''
      req.on('data', (chunk: any) => { raw += chunk })
      req.on('end', () => {
        try { lastRequestBody = JSON.parse(raw) } catch { lastRequestBody = raw }
        mockHandler(req, res)
      })
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as any).port
        baseUrl = `http://127.0.0.1:${port}/v1`
        resolve()
      })
    })
  })

  after(async () => {
    await new Promise<void>((resolve) => {
      (server as any).closeAllConnections?.()
      server.close(() => resolve())
    })
  })

  function createMockCtx(eventsRecord: Record<string, any[]> = {}) {
    const ctx = new Context()
    new MockService(ctx, 'settings', {
      getSettings: () => ({ defaultModel: 'test-model' }),
      getActiveProvider: () => ({
        id: 'test-prov',
        name: 'Test Provider',
        baseURL: baseUrl,
        models: [{ id: 'test-model', contextWindow: 4096 }]
      }),
      getActiveModel: () => ({ id: 'test-model', contextWindow: 4096 })
    })

    ctx.on('llm/retry' as any, (data: any) => {
      if (!eventsRecord['llm/retry']) eventsRecord['llm/retry'] = []
      eventsRecord['llm/retry'].push(data)
    })

    ctx.on('llm/token-usage' as any, (data: any) => {
      if (!eventsRecord['llm/token-usage']) eventsRecord['llm/token-usage'] = []
      eventsRecord['llm/token-usage'].push(data)
    })

    return ctx
  }

  test('Structured Output: attaches response_format and ensures JSON mention in prompt', async () => {
    mockHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"{\\"answer\\":42}"}}]}\n\n')
      res.write('data: [DONE]\n\n')
      res.end()
    }

    const ctx = createMockCtx()
    const llm = new LlmService(ctx)

    const events: StreamEvent[] = []
    for await (const ev of llm.streamChat(
      [{ role: 'user', content: 'What is the answer?' }],
      {
        responseFormat: {
          type: 'json_object'
        }
      }
    )) {
      events.push(ev)
    }

    assert.ok(lastRequestBody)
    assert.deepEqual(lastRequestBody.response_format, { type: 'json_object' })
    const msgs = lastRequestBody.messages
    const hasJsonInstruction = msgs.some((m: any) => m.content.toLowerCase().includes('json'))
    assert.ok(hasJsonInstruction, 'Payload should include explicit JSON mention')

    const chunks = events.filter(e => e.type === 'chunk').map(e => e.content).join('')
    assert.equal(chunks, '{"answer":42}')
  })

  test('Automatic Retry: recovers from 429 rate limit with exponential backoff', async () => {
    requestCount = 0
    mockHandler = (req, res) => {
      if (requestCount <= 2) {
        res.writeHead(429, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }))
      } else {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        res.write('data: {"choices":[{"delta":{"content":"Success after retry"}}]}\n\n')
        res.write('data: [DONE]\n\n')
        res.end()
      }
    }

    const eventsRecord: Record<string, any[]> = {}
    const ctx = createMockCtx(eventsRecord)
    const llm = new LlmService(ctx)

    const events: StreamEvent[] = []
    for await (const ev of llm.streamChat(
      [{ role: 'user', content: 'Hello' }],
      {
        retry: {
          maxRetries: 3,
          initialDelayMs: 20,
          maxDelayMs: 100,
          backoffMultiplier: 1.5
        }
      }
    )) {
      events.push(ev)
    }

    assert.equal(requestCount, 3, 'Should have made 1 initial + 2 retry requests')
    const chunks = events.filter(e => e.type === 'chunk').map(e => e.content).join('')
    assert.equal(chunks, 'Success after retry')

    assert.ok(eventsRecord['llm/retry'])
    assert.equal(eventsRecord['llm/retry'].length, 2)
    assert.equal(eventsRecord['llm/retry'][0].status, 429)
  })

  test('Automatic Retry: yields error when max retries exceeded', async () => {
    requestCount = 0
    mockHandler = (req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Service Unavailable' }))
    }

    const ctx = createMockCtx()
    const llm = new LlmService(ctx)

    const events: StreamEvent[] = []
    for await (const ev of llm.streamChat(
      [{ role: 'user', content: 'Hello' }],
      {
        retry: {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 50
        }
      }
    )) {
      events.push(ev)
    }

    assert.equal(requestCount, 3, 'Initial + 2 retries = 3 attempts total')
    const errEvent = events.find(e => e.type === 'error')
    assert.ok(errEvent, 'Should yield an error event when all retries are exhausted')
    assert.ok(errEvent!.error?.includes('503'))
  })

  test('AbortSignal: immediately breaks retry loop when aborted', async () => {
    requestCount = 0
    const ac = new AbortController()
    mockHandler = (req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end('Internal Server Error')
      ac.abort()
    }

    const ctx = createMockCtx()
    const llm = new LlmService(ctx)

    const events: StreamEvent[] = []
    for await (const ev of llm.streamChat(
      [{ role: 'user', content: 'Hello' }],
      {
        signal: ac.signal,
        retry: {
          maxRetries: 5,
          initialDelayMs: 200
        }
      }
    )) {
      events.push(ev)
    }

    assert.ok(requestCount <= 2, 'Should abort retry loop immediately without completing 5 retries')
    const doneEvent = events.find(e => e.type === 'done')
    assert.ok(doneEvent, 'Should cleanly yield done on abort')
  })

  test('Token Usage: accurately captures real stream_options usage from SSE and emits Cordis event', async () => {
    mockHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"Hi!"}}]}\n\n')
      res.write('data: {"choices":[],"usage":{"prompt_tokens":25,"completion_tokens":5,"total_tokens":30}}\n\n')
      res.write('data: [DONE]\n\n')
      res.end()
    }

    const eventsRecord: Record<string, any[]> = {}
    const ctx = createMockCtx(eventsRecord)
    const llm = new LlmService(ctx)

    const events: StreamEvent[] = []
    for await (const ev of llm.streamChat(
      [{ role: 'user', content: 'Hello' }],
      { sessionId: 'test-session-123' }
    )) {
      events.push(ev)
    }

    const doneEvent = events.find(e => e.type === 'done')
    assert.ok(doneEvent)
    assert.ok(doneEvent!.usage)
    assert.equal(doneEvent!.usage!.promptTokens, 25)
    assert.equal(doneEvent!.usage!.completionTokens, 5)
    assert.equal(doneEvent!.usage!.totalTokens, 30)

    assert.ok(eventsRecord['llm/token-usage'])
    assert.equal(eventsRecord['llm/token-usage'][0].sessionId, 'test-session-123')
    assert.deepEqual(eventsRecord['llm/token-usage'][0].usage, {
      promptTokens: 25,
      completionTokens: 5,
      totalTokens: 30
    })
  })

  test('Token Usage: fallback calculation works when model does not return usage', async () => {
    mockHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"Hello world!"}}]}\n\n')
      res.write('data: [DONE]\n\n')
      res.end()
    }

    const ctx = createMockCtx()
    const llm = new LlmService(ctx)

    const events: StreamEvent[] = []
    for await (const ev of llm.streamChat([{ role: 'user', content: 'Hello' }])) {
      events.push(ev)
    }

    const doneEvent = events.find(e => e.type === 'done')
    assert.ok(doneEvent)
    assert.ok(doneEvent!.usage)
    assert.ok(doneEvent!.usage!.promptTokens > 0)
    assert.ok(doneEvent!.usage!.completionTokens > 0)
    assert.ok(doneEvent!.usage!.totalTokens === doneEvent!.usage!.promptTokens + doneEvent!.usage!.completionTokens)
  })
})
