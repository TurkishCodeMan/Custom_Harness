import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { Context, Service } from 'cordis'
import type { StreamEvent } from '@custom-harness/llm'
import { OpenAiLlmService } from '../src/index.js'

class MockService extends Service {
  constructor(ctx: Context, name: string, impl: any) {
    super(ctx, name)
    Object.assign(this, impl)
  }
}

describe('OpenAiLlmService — Retry, Token Usage & Structured Output', () => {
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
    const llm = new OpenAiLlmService(ctx)

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

    assert.ok(lastRequestBody, 'A request must have been made to the mock server')
    assert.deepEqual(lastRequestBody.response_format, { type: 'json_object' })
    const userPrompt = lastRequestBody.messages.find((m: any) => m.role === 'user')?.content
    assert.match(userPrompt, /JSON/i, 'User prompt should mention JSON when response_format is json_object')
    const chunks = events.filter((e) => e.type === 'chunk')
    assert.equal(chunks.length, 1)
    assert.equal(chunks[0].content, '{"answer":42}')
  })

  test('Automatic Retry: recovers from 429 rate limit with exponential backoff', async () => {
    requestCount = 0
    mockHandler = (req, res) => {
      if (requestCount === 1) {
        res.writeHead(429, { 'Content-Type': 'text/plain' })
        res.end('Too Many Requests')
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"Success after 429"}}]}\n\n')
      res.write('data: [DONE]\n\n')
      res.end()
    }

    const eventsRecord: Record<string, any[]> = {}
    const ctx = createMockCtx(eventsRecord)
    const llm = new OpenAiLlmService(ctx)

    const events: StreamEvent[] = []
    for await (const ev of llm.streamChat(
      [{ role: 'user', content: 'Hello' }],
      {
        retry: {
          maxRetries: 2,
          initialDelayMs: 20,
          maxDelayMs: 100,
          backoffMultiplier: 1.5
        }
      }
    )) {
      events.push(ev)
    }

    assert.equal(requestCount, 2, 'Should have made 2 requests (1 failure + 1 success retry)')
    assert.equal(eventsRecord['llm/retry']?.length, 1, 'Should have emitted 1 llm/retry event')
    assert.equal(eventsRecord['llm/retry'][0].status, 429)
    const chunks = events.filter((e) => e.type === 'chunk')
    assert.equal(chunks.length, 1)
    assert.equal(chunks[0].content, 'Success after 429')
  })

  test('Automatic Retry: yields error when maxRetries is exceeded', async () => {
    requestCount = 0
    mockHandler = (req, res) => {
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('Service Unavailable')
    }

    const eventsRecord: Record<string, any[]> = {}
    const ctx = createMockCtx(eventsRecord)
    const llm = new OpenAiLlmService(ctx)

    const events: StreamEvent[] = []
    for await (const ev of llm.streamChat(
      [{ role: 'user', content: 'Hello' }],
      {
        retry: {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 50,
          backoffMultiplier: 1.5
        }
      }
    )) {
      events.push(ev)
    }

    assert.equal(requestCount, 3, 'Should have made 3 attempts total (initial + 2 retries)')
    assert.equal(eventsRecord['llm/retry']?.length, 2, 'Should have emitted 2 retry events')
    const errorEvent = events.find((e) => e.type === 'error')
    assert.ok(errorEvent, 'Should yield an error event when all retries fail')
    assert.match(errorEvent.error!, /503/)
  })

  test('AbortSignal: immediately breaks retry loop without hanging', async () => {
    requestCount = 0
    mockHandler = (req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Server Error')
    }

    const ctx = createMockCtx()
    const llm = new OpenAiLlmService(ctx)
    const ac = new AbortController()

    const events: StreamEvent[] = []
    const promise = (async () => {
      for await (const ev of llm.streamChat(
        [{ role: 'user', content: 'Hello' }],
        {
          signal: ac.signal,
          retry: {
            maxRetries: 5,
            initialDelayMs: 500,
            maxDelayMs: 2000
          }
        }
      )) {
        events.push(ev)
      }
    })()

    await new Promise((r) => setTimeout(r, 40))
    ac.abort()

    await promise
    assert.ok(requestCount <= 2, 'Should not have continued attempting retries after abort')
    const doneEvent = events.find((e) => e.type === 'done')
    assert.ok(doneEvent, 'Should cleanly yield a done event on abort')
  })

  test('Token Usage: accurately captures real tokenUsage from SSE payload', async () => {
    mockHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n')
      res.write('data: {"usage":{"prompt_tokens":12,"completion_tokens":2,"total_tokens":14}}\n\n')
      res.write('data: [DONE]\n\n')
      res.end()
    }

    const eventsRecord: Record<string, any[]> = {}
    const ctx = createMockCtx(eventsRecord)
    const llm = new OpenAiLlmService(ctx)

    const events: StreamEvent[] = []
    for await (const ev of llm.streamChat([{ role: 'user', content: 'Hello' }])) {
      events.push(ev)
    }

    const doneEvent = events.find((e) => e.type === 'done')
    assert.ok(doneEvent, 'Must yield done event')
    assert.ok(doneEvent.usage, 'Done event must contain tokenUsage')
    assert.equal(doneEvent.usage.promptTokens, 12)
    assert.equal(doneEvent.usage.completionTokens, 2)
    assert.equal(doneEvent.usage.totalTokens, 14)
  })
})
