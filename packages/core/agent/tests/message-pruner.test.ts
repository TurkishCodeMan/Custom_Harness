import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { ChatMessage } from '@custom-harness/core-types'
import { ensureUserMessage, stripReasoningFromHistory, applyToolOutputSlidingWindow } from '../src/message-pruner.js'


describe('ensureUserMessage', () => {
  test('appends user message when no user message exists', () => {
    const messages: ChatMessage[] = [{ role: 'system', content: 'Sys' }]
    const result = ensureUserMessage(messages, 'Initial prompt')
    assert.equal(result.length, 2)
    assert.equal(result[1].role, 'user')
    assert.equal(result[1].content, 'Initial prompt')
  })

  test('leaves messages unchanged when at least one user message is already present', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'Sys' },
      { role: 'user', content: 'Existing user message' }
    ]
    const result = ensureUserMessage(messages, 'New prompt')
    assert.equal(result.length, 2)
    assert.equal(result[1].content, 'Existing user message')
  })
})

describe('stripReasoningFromHistory', () => {
  test('removes reasoning_content from assistant messages', () => {
    const messages: any[] = [
      { role: 'user', content: 'merhaba' },
      { role: 'assistant', content: 'Cevap', reasoning_content: '<think>uzun düşünce</think>' },
      { role: 'user', content: 'devam' }
    ]
    const result = stripReasoningFromHistory(messages)
    assert.equal((result[1] as any).reasoning_content, undefined)
    assert.equal(result[1].content, 'Cevap')
  })

  test('does not mutate original messages array', () => {
    const original: any[] = [
      { role: 'assistant', content: 'Sonuç', reasoning_content: '<think>...' }
    ]
    const result = stripReasoningFromHistory(original)
    assert.ok((original[0] as any).reasoning_content, 'original must not be mutated')
    assert.equal((result[0] as any).reasoning_content, undefined)
  })

  test('passes through messages without reasoning_content unchanged', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'soru' },
      { role: 'assistant', content: 'cevap' }
    ]
    const result = stripReasoningFromHistory(messages)
    assert.deepEqual(result, messages)
  })
})

describe('applyToolOutputSlidingWindow', () => {
  const buildHistory = (...turns: Array<{ toolContent: string }[]>): ChatMessage[] => {
    const msgs: ChatMessage[] = []
    for (const toolCalls of turns) {
      msgs.push({ role: 'assistant', content: 'assistant turn' } as ChatMessage)
      for (const tc of toolCalls) {
        msgs.push({ role: 'tool', content: tc.toolContent } as ChatMessage)
      }
    }
    return msgs
  }

  test('compresses tool outputs older than windowSize turns', () => {
    const longOutput = 'X'.repeat(5000)
    // 3 turns: turn1 (old), turn2, turn3 (latest) — window=2
    const msgs = buildHistory([{ toolContent: longOutput }], [{ toolContent: 'short' }], [{ toolContent: 'recent' }])
    const result = applyToolOutputSlidingWindow(msgs, 2)

    // The first turn's tool output (long) should be compressed
    const firstTool = result.find((m, i) => m.role === 'tool' && i === 1)
    assert.ok(firstTool!.content!.toString().includes('gizlendi'), 'old tool output should be compressed')

    // Recent turn's tool outputs should remain
    const lastTool = result[result.length - 1]
    assert.equal(lastTool.content, 'recent')
  })

  test('caps in-window tool outputs at maxToolChars', () => {
    const hugeOutput = 'Z'.repeat(10000)
    const msgs = buildHistory([{ toolContent: hugeOutput }])
    const result = applyToolOutputSlidingWindow(msgs, 2, 3000)

    const toolMsg = result.find(m => m.role === 'tool')!
    assert.ok(toolMsg.content!.toString().length < 10000, 'in-window tool output should be capped')
    assert.ok(toolMsg.content!.toString().includes('kısaltıldı'))
  })

  test('does not mutate original messages', () => {
    const original: ChatMessage[] = [
      { role: 'assistant', content: 'a' } as ChatMessage,
      { role: 'tool', content: 'Y'.repeat(5000) } as ChatMessage
    ]
    const copy = JSON.stringify(original)
    applyToolOutputSlidingWindow(original, 0)
    assert.equal(JSON.stringify(original), copy, 'original must not be mutated')
  })

  test('short tool outputs are never compressed even when old', () => {
    const msgs = buildHistory([{ toolContent: 'kısa' }], [{ toolContent: 'recent' }], [{ toolContent: 'now' }])
    const result = applyToolOutputSlidingWindow(msgs, 2)
    const firstTool = result.find(m => m.role === 'tool')!
    assert.equal(firstTool.content, 'kısa', 'short old outputs should pass through unchanged')
  })

  test('skill tool outputs are never compressed even when older than windowSize', () => {
    const longSkillOutput = '### AKTİF BECERİ TALİMATLARI: (invoice-review-skill)\n' + 'S'.repeat(5000)
    const msgs: ChatMessage[] = [
      { role: 'assistant', content: 'turn 1' },
      { role: 'tool', name: 'skill', content: longSkillOutput },
      { role: 'assistant', content: 'turn 2' },
      { role: 'tool', name: 'read_file', content: 'file content' },
      { role: 'assistant', content: 'turn 3' },
      { role: 'tool', name: 'bash', content: 'bash content' }
    ]
    const result = applyToolOutputSlidingWindow(msgs, 1)
    const skillMsg = result.find(m => m.role === 'tool' && m.name === 'skill')
    assert.equal(skillMsg?.content, longSkillOutput, 'skill output should never be compressed')
  })
})

