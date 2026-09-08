/**
 * Unit tests for @custom-harness/token-meter
 *
 * Uses Node.js built-in test runner (node:test) — no external deps needed.
 * Run: npx tsx --test src/index.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { TokenMeterService } from './index.ts'

// ---------------------------------------------------------------------------
// Minimal context mock factory
// ---------------------------------------------------------------------------

function makeCtx(overrides: {
  pluginEnabled?: boolean
  systemPromptText?: string | null
  toolSchemas?: object[]
  session?: { messages: any[] } | null
  compactResult?: { compacted: boolean; messages: any[] } | null
  contextWindow?: number
  modelId?: string
} = {}): any {
  const {
    pluginEnabled = true,
    systemPromptText = null,
    toolSchemas = [],
    session = null,
    compactResult = null,
    contextWindow = 16_384,
    modelId = 'test-model',
  } = overrides

  return {
    settings: {
      getPlugin: () => ({ enabled: pluginEnabled }),
      getActiveModel: () => ({ id: modelId, name: 'Test Model', contextWindow }),
      getSettings: () => ({ workspace: '/test/workspace' }),
    },
    tools: {
      getOpenAiSchemas: () => toolSchemas,
    },
    session: {
      getSession: (id: string) => (id ? session : null),
    },
    systemPrompt: systemPromptText !== null
      ? { render: () => systemPromptText }
      : null,
    compactor: compactResult !== null
      ? { compact: () => compactResult }
      : null,
  }
}

/** Create a service with a given context. Bypasses cordis super() by direct instantiation trick. */
function makeService(ctx: any): TokenMeterService {
  // TokenMeterService extends cordis Service — we mock the super() by directly
  // setting ctx on the prototype instance without cordis bootstrapping.
  const svc = Object.create(TokenMeterService.prototype) as TokenMeterService
  ;(svc as any).ctx = ctx
  return svc
}

// ---------------------------------------------------------------------------
// estimateText
// ---------------------------------------------------------------------------

describe('TokenMeterService.estimateText', () => {
  const svc = makeService(makeCtx())

  test('returns 0 for empty / undefined input', () => {
    assert.equal(svc.estimateText(undefined), 0)
    assert.equal(svc.estimateText(''), 0)
  })

  test('returns at least 1 for any non-empty string', () => {
    assert.equal(svc.estimateText('a'), 1)
    assert.equal(svc.estimateText('ab'), 1)
    assert.equal(svc.estimateText('abc'), 1)
  })

  test('applies 4 chars per token heuristic', () => {
    // 8 chars → ceil(8/4) = 2
    assert.equal(svc.estimateText('12345678'), 2)
    // 400 chars → 100 tokens
    assert.equal(svc.estimateText('x'.repeat(400)), 100)
  })

  test('rounds up fractional tokens', () => {
    // 5 chars → ceil(5/4) = 2
    assert.equal(svc.estimateText('hello'), 2)
    // 9 chars → ceil(9/4) = 3
    assert.equal(svc.estimateText('123456789'), 3)
  })
})

// ---------------------------------------------------------------------------
// estimateMessage
// ---------------------------------------------------------------------------

describe('TokenMeterService.estimateMessage', () => {
  const svc = makeService(makeCtx())

  test('base overhead is 4 tokens for an empty message', () => {
    assert.equal(svc.estimateMessage({ role: 'user' } as any), 4)
  })

  test('adds content tokens', () => {
    // "hello" = ceil(5/4) = 2 tokens + 4 base = 6
    assert.equal(svc.estimateMessage({ role: 'user', content: 'hello' } as any), 6)
  })

  test('adds reasoning_content tokens', () => {
    // 8 chars → 2 tokens + 4 base = 6
    assert.equal(svc.estimateMessage({ role: 'assistant', reasoning_content: '12345678' } as any), 6)
  })

  test('adds both content and reasoning tokens', () => {
    // content "hello" (2) + reasoning "12345678" (2) + 4 base = 8
    const msg = { role: 'assistant', content: 'hello', reasoning_content: '12345678' } as any
    assert.equal(svc.estimateMessage(msg), 8)
  })

  test('adds tool call tokens with per-call overhead', () => {
    const msg = {
      role: 'assistant',
      tool_calls: [
        { function: { name: 'read_file', arguments: '{"path":"/x"}' } }
      ]
    } as any
    // 4 base + 6 call overhead + estimateText("read_file"=9→3) + estimateText('{"path":"/x"}'=13→4)
    // = 4 + 6 + 3 + 4 = 17
    assert.equal(svc.estimateMessage(msg), 17)
  })

  test('handles multiple tool calls', () => {
    const msg = {
      role: 'assistant',
      tool_calls: [
        { function: { name: 'a', arguments: 'b' } },
        { function: { name: 'c', arguments: 'd' } },
      ]
    } as any
    // 4 base + 2 × (6 + 1 + 1) = 4 + 16 = 20
    assert.equal(svc.estimateMessage(msg), 20)
  })

  test('handles tool calls with missing function gracefully', () => {
    const msg = {
      role: 'assistant',
      tool_calls: [{ function: undefined }]
    } as any
    // 4 base + 6 overhead + 0 + 0 = 10
    assert.equal(svc.estimateMessage(msg), 10)
  })
})

// ---------------------------------------------------------------------------
// measureSession — disabled plugin
// ---------------------------------------------------------------------------

describe('measureSession — plugin disabled', () => {
  test('returns zeros and disabled: true when plugin is off', () => {
    const svc = makeService(makeCtx({ pluginEnabled: false }))
    const result = svc.measureSession()

    assert.equal(result.disabled, true)
    assert.equal(result.contextPressure.usedTokens, 0)
    assert.equal(result.contextPressure.percent, 0)
    assert.equal(result.contextBreakdown.systemTokens, 0)
    assert.equal(result.contextBreakdown.toolsTokens, 0)
    assert.equal(result.contextBreakdown.messageTokens, 0)
  })
})

// ---------------------------------------------------------------------------
// measureSession — system prompt
// ---------------------------------------------------------------------------

describe('measureSession — system prompt tokens', () => {
  test('uses rendered systemPrompt when available', () => {
    // 40-char system prompt → ceil(40/4) = 10 tokens + 8 overhead = 18
    const svc = makeService(makeCtx({ systemPromptText: 'x'.repeat(40) }))
    const result = svc.measureSession()

    assert.equal(result.systemPromptTokens, 18)
    assert.equal(result.contextBreakdown.systemTokens, 18)
  })

  test('falls back to default prompt when systemPrompt is null', () => {
    const svc = makeService(makeCtx({ systemPromptText: null }))
    const result = svc.measureSession()

    // Default fallback is ~3 lines of text → should be > 0
    assert.ok(result.systemPromptTokens! > 0)
  })

  test('falls back when systemPrompt.render() throws', () => {
    const ctx = makeCtx()
    ctx.systemPrompt = { render: () => { throw new Error('render fail') } }
    const svc = makeService(ctx)
    const result = svc.measureSession()

    assert.ok(result.systemPromptTokens! > 0, 'Should fall back to default prompt on render error')
  })
})

// ---------------------------------------------------------------------------
// measureSession — tools tokens
// ---------------------------------------------------------------------------

describe('measureSession — tools tokens', () => {
  test('returns 0 tools tokens when no schemas', () => {
    const svc = makeService(makeCtx({ toolSchemas: [] }))
    const result = svc.measureSession()
    assert.equal(result.toolsTokens, 0)
    assert.equal(result.contextBreakdown.toolsTokens, 0)
  })

  test('estimates tools tokens from JSON-serialized schemas', () => {
    // Produce a schema array that serializes to a known length
    const schema = [{ name: 'tool_a', description: 'x'.repeat(100) }]
    const svc = makeService(makeCtx({ toolSchemas: schema }))
    const result = svc.measureSession()

    const expected = Math.ceil(JSON.stringify(schema).length / 4) + 12
    assert.equal(result.toolsTokens, expected)
  })
})

// ---------------------------------------------------------------------------
// measureSession — message history
// ---------------------------------------------------------------------------

describe('measureSession — message history', () => {
  test('skips message counting when no sessionId given', () => {
    const session = { messages: [{ role: 'user', content: 'hello' }] }
    const svc = makeService(makeCtx({ session }))
    const result = svc.measureSession() // no sessionId

    assert.equal(result.historyTokens, 0)
    assert.equal(result.contextBreakdown.messageTokens, 0)
  })

  test('counts message tokens for given sessionId', () => {
    // "hello" → 2 content tokens + 4 base = 6
    const session = { messages: [{ role: 'user', content: 'hello' }] }
    const svc = makeService(makeCtx({ session }))
    const result = svc.measureSession('session-1')

    assert.equal(result.historyTokens, 6)
  })

  test('returns 0 message tokens when session not found', () => {
    const svc = makeService(makeCtx({ session: null }))
    const result = svc.measureSession('nonexistent-session')

    assert.equal(result.historyTokens, 0)
  })

  test('uses compacted messages when compactor returns compacted=true', () => {
    const original = [
      { role: 'user', content: 'x'.repeat(400) },   // 100 + 4 = 104 tokens
      { role: 'assistant', content: 'x'.repeat(400) },
    ]
    const compacted = [
      { role: 'system', content: 'summary: x'.repeat(10) }, // much smaller
    ]
    const svc = makeService(makeCtx({
      session: { messages: original },
      compactResult: { compacted: true, messages: compacted },
    }))

    const resultWithCompaction = svc.measureSession('session-1')
    // Should measure `compacted` messages, not `original`
    const expectedCompacted = 4 + Math.ceil('summary: x'.repeat(10).length / 4)
    assert.equal(resultWithCompaction.historyTokens, expectedCompacted)
  })

  test('uses original messages when compactor returns compacted=false', () => {
    const original = [{ role: 'user', content: 'hello' }] // 6 tokens
    const svc = makeService(makeCtx({
      session: { messages: original },
      compactResult: { compacted: false, messages: [] },
    }))

    const result = svc.measureSession('session-1')
    assert.equal(result.historyTokens, 6)
  })
})

// ---------------------------------------------------------------------------
// measureSession — totals, percent, breakdown percents
// ---------------------------------------------------------------------------

describe('measureSession — totals & percentages', () => {
  test('percent is capped at 100 even when tokens exceed context window', () => {
    // Force a tiny context window (256 tokens) with a large system prompt
    const svc = makeService(makeCtx({
      systemPromptText: 'x'.repeat(4000), // 1000 tokens >> 256
      contextWindow: 256,
    }))
    const result = svc.measureSession()

    assert.equal(result.contextPressure.percent, 100, 'percent must be ≤ 100')
    assert.equal(result.percentage, 100)
    // totalTokens must be clamped at the source — never exceeds contextWindow
    assert.ok(result.totalTokens! <= 256, `totalTokens (${result.totalTokens}) must be ≤ contextWindow (256)`)
    assert.equal(result.totalTokens, result.contextPressure.usedTokens, 'totalTokens and usedTokens must match')
  })

  test('contextPressure fields are consistent', () => {
    const svc = makeService(makeCtx({ systemPromptText: 'x'.repeat(40), toolSchemas: [] }))
    const result = svc.measureSession()

    assert.equal(result.contextPressure.usedTokens, result.totalTokens)
    assert.equal(result.contextPressure.projectedTokens, result.totalTokens)
    assert.equal(result.contextPressure.contextWindow, result.contextWindow)
    assert.equal(result.contextPressure.percent, result.percentage)
  })

  test('systemPromptTokens + toolsTokens + historyTokens === totalTokens', () => {
    const session = { messages: [{ role: 'user', content: 'test' }] }
    const svc = makeService(makeCtx({
      systemPromptText: 'You are helpful.',
      toolSchemas: [{ name: 'shell', description: 'Run shell commands' }],
      session,
    }))
    const result = svc.measureSession('session-1')

    const sumParts = result.systemPromptTokens! + result.toolsTokens! + result.historyTokens!
    assert.equal(sumParts, result.totalTokens, 'parts must sum to totalTokens')
  })

  test('breakdown percents sum to 100', () => {
    const session = { messages: [{ role: 'user', content: 'Hello there' }] }
    const svc = makeService(makeCtx({
      systemPromptText: 'You are a coding assistant.',
      toolSchemas: [{ name: 'read', description: 'Read file' }],
      session,
    }))
    const result = svc.measureSession('session-1')

    const sum = result.contextBreakdown.systemPercent
      + result.contextBreakdown.toolsPercent
      + result.contextBreakdown.messagePercent

    // Due to rounding, sum can be 99–101
    assert.ok(Math.abs(sum - 100) <= 1, `breakdown percents (${sum}) should be ~100`)
  })

  test('returns correct modelId from active model', () => {
    const svc = makeService(makeCtx({ modelId: 'my-custom-model' }))
    const result = svc.measureSession()

    assert.equal(result.modelId, 'my-custom-model')
  })

  test('returns correct contextWindow', () => {
    const svc = makeService(makeCtx({ contextWindow: 32_768 }))
    const result = svc.measureSession()

    assert.equal(result.contextWindow, 32_768)
    assert.equal(result.contextPressure.contextWindow, 32_768)
  })

  test('percent is 0 with only base overhead in a very large context window', () => {
    // With a huge window, small system prompt → rounds to 0%
    const svc = makeService(makeCtx({ contextWindow: 1_000_000, systemPromptText: 'hi' }))
    const result = svc.measureSession()

    assert.equal(result.percentage, 0)
  })
})

// ---------------------------------------------------------------------------
// measureSession — disabled=true is absent from normal result
// ---------------------------------------------------------------------------

describe('measureSession — disabled flag', () => {
  test('disabled is NOT set when plugin is enabled', () => {
    const svc = makeService(makeCtx({ pluginEnabled: true }))
    const result = svc.measureSession()

    assert.equal(result.disabled, undefined, 'disabled should be absent when plugin is on')
  })
})
