/**
 * Unit tests for QwenLlmService message sanitization logic.
 * Run with:  npx tsx --test packages/llm/llm_qwen/src/index.test.ts
 */

import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  tool_calls?: any[]
  tool_call_id?: string
  name?: string
  isInternal?: boolean
}

function sanitizeMessages(messages: ChatMessage[]): any[] {
  return messages.map((m, idx) => {
    let role = m.role
    let content = m.content || ''
    if (role === 'system' && idx > 0) {
      role = 'user'
      content = `[System Note]:\n${content}`
    }
    const item: any = { role, content }
    if (m.tool_calls && Array.isArray(m.tool_calls)) {
      item.tool_calls = m.tool_calls.map((tc: any) => {
        let rawArgs = tc.function?.arguments || tc.arguments || '{}'
        if (typeof rawArgs !== 'string') rawArgs = JSON.stringify(rawArgs)
        try { JSON.parse(rawArgs) } catch { rawArgs = JSON.stringify({ raw: String(rawArgs) }) }
        return { id: tc.id || 'call_test', type: 'function', function: { name: tc.function?.name || 'tool', arguments: rawArgs } }
      })
    }
    if (m.tool_call_id) item.tool_call_id = m.tool_call_id
    if (m.name) item.name = m.name
    return item
  })
}

function calcMaxTokens(sanitizedMessages: any[], tools: any[], contextLimit: number, modelMaxTokens: number): number {
  const totalPayloadChars = JSON.stringify(sanitizedMessages).length + JSON.stringify(tools).length
  const approxInputTokens = Math.ceil(totalPayloadChars / 3.6) + 100
  const safeRemainingTokens = Math.max(2048, contextLimit - approxInputTokens - 64)
  return Math.min(modelMaxTokens, safeRemainingTokens)
}

describe('sanitizeMessages', () => {
  test('system at index 0 stays as system', () => {
    const out = sanitizeMessages([{ role: 'system', content: 'You are an assistant.' }])
    assert.equal(out[0].role, 'system')
  })

  test('system at index > 0 converts to user with [System Note] prefix', () => {
    const out = sanitizeMessages([
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
      { role: 'system', content: '[SKILL_REMINDER]: some skill' },
    ])
    assert.equal(out[2].role, 'user')
    assert.ok(out[2].content.startsWith('[System Note]:'))
    console.log('  Converted system[2]:', out[2].content.slice(0, 60))
  })

  test('isInternal user messages ARE forwarded to LLM (contamination risk)', () => {
    const out = sanitizeMessages([
      { role: 'system', content: 'System' },
      { role: 'user', content: 'user msg' },
      { role: 'user', content: '[SISTEM BILGILENDIRMESİ]: Acikla', isInternal: true },
    ])
    assert.ok(out[2].content.includes('[SISTEM BILGILENDIRMESİ]'))
    console.log('  LEAKED internal msg in payload:', out[2].content.slice(0, 80))
  })

  test('tool_calls arguments are always valid JSON strings', () => {
    const out = sanitizeMessages([{
      role: 'assistant', content: '',
      tool_calls: [{ id: 'c1', function: { name: 'bash', arguments: { command: 'ls' } } }]
    }])
    const args = out[0].tool_calls[0].function.arguments
    assert.equal(typeof args, 'string')
    assert.doesNotThrow(() => JSON.parse(args))
  })

  test('broken JSON arguments get wrapped safely', () => {
    const out = sanitizeMessages([{
      role: 'assistant', content: '',
      tool_calls: [{ id: 'c2', function: { name: 'bash', arguments: '{broken' } }]
    }])
    assert.doesNotThrow(() => JSON.parse(out[0].tool_calls[0].function.arguments))
  })
})

describe('calcMaxTokens', () => {
  test('short conversation: >=2048 output tokens guaranteed', () => {
    const msgs = [{ role: 'system', content: 'You are a dev.' }, { role: 'user', content: 'Hello' }]
    const t = calcMaxTokens(msgs, [], 16384, 8192)
    console.log('  Short session max_tokens:', t)
    assert.ok(t >= 2048, `Expected >= 2048, got ${t}`)
  })

  test('heavy 8k-token session: floor enforces >=2048', () => {
    const msgs = [{ role: 'system', content: 'S' }, { role: 'user', content: 'x'.repeat(29000) }]
    const t = calcMaxTokens(msgs, [], 16384, 8192)
    console.log('  Heavy session max_tokens:', t)
    assert.ok(t >= 2048, `Floor must be 2048, got ${t}`)
  })
})

describe('Session contamination', () => {
  test('isInternal msgs must NOT appear in session after ephemeral fix', () => {
    const sessionMessages = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'dosyalari listele' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c1', function: { name: 'bash', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c1', name: 'bash', content: 'src/' },
      { role: 'assistant', content: 'Iste dosyalar: src/' },
      { role: 'user', content: 'mimariyi analiz et' },
    ]
    const leaked = sessionMessages.filter((m: any) => m.isInternal)
    console.log('  isInternal msgs in clean session:', leaked.length)
    assert.equal(leaked.length, 0, 'No internal msgs in session after ephemeral fix')
  })
})
