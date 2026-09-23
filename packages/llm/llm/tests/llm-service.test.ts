import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import { LlmService, type StreamEvent, type ChatMessage, apply, name } from '../src/index.js'

describe('LlmService (Capability Seam Contract)', () => {
  class MockLlmService extends LlmService {
    public async *streamChat(messages: ChatMessage[]): AsyncGenerator<StreamEvent, void, unknown> {
      yield { type: 'chunk', content: 'hello from mock' }
      yield { type: 'done' }
    }
  }

  test('LlmService is an abstract Service subclass with name "llm"', () => {
    assert.equal(name, 'llm')
    const ctx = new Context()
    const mock = new MockLlmService(ctx)
    assert.ok(mock instanceof Service)
    assert.ok(mock instanceof LlmService)
    assert.equal(typeof mock.streamChat, 'function')
  })

  test('concrete subclass can stream events according to contract', async () => {
    const ctx = new Context()
    const mock = new MockLlmService(ctx)
    const events: StreamEvent[] = []
    for await (const ev of mock.streamChat([{ role: 'user', content: 'hi' }])) {
      events.push(ev)
    }
    assert.equal(events.length, 2)
    assert.equal(events[0].type, 'chunk')
    assert.equal(events[0].content, 'hello from mock')
    assert.equal(events[1].type, 'done')
  })

  test('apply function exists for Cordis plugin registration', () => {
    const ctx = new Context()
    apply(ctx)
    assert.ok(true)
  })
})
