import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@custom-harness/core-context'
import { LlmService } from '@custom-harness/llm'
import { OpenAiLlmService, apply } from '../src/index.js'

describe('OpenAiLlmService (Provider - Definition - Seam)', () => {
  test('OpenAiLlmService inherits from LlmService abstract seam', () => {
    const ctx = new Context()
    const service = new OpenAiLlmService(ctx)

    assert.ok(service instanceof LlmService, 'Service must inherit from abstract LlmService')
    assert.equal(typeof service.streamChat, 'function')
  })

  test('apply(ctx) registers OpenAiLlmService to ctx.llm', () => {
    const ctx = new Context()
    apply(ctx)

    assert.ok(ctx.llm, 'ctx.llm must be defined after plugin apply')
    assert.ok(ctx.llm instanceof LlmService, 'ctx.llm must be an instance of LlmService')
    assert.ok(ctx.llm instanceof OpenAiLlmService, 'ctx.llm must be an instance of OpenAiLlmService')
  })

  test('streamChat yields error when no provider is configured', async () => {
    const ctx = new Context()
    ;(ctx as any).settings = {
      getSettings: () => ({}),
      getActiveProvider: () => undefined,
      getActiveModel: () => undefined
    }

    const service = new OpenAiLlmService(ctx)
    const events: any[] = []
    for await (const ev of service.streamChat([{ role: 'user', content: 'Hello' }])) {
      events.push(ev)
    }

    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'error')
    assert.match(events[0].error, /bulunamadı/)
  })
})
