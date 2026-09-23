import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import { CompactionBasicService } from '../src/index.js'
import type { ChatMessage } from '@custom-harness/core-types'

describe('CompactionBasicService — 10 Messages or 12,000 Tokens Threshold', () => {
  test('does NOT compact when message count <= 10 and tokens < 12,000', () => {
    const ctx = new Context()
    const compactor = new CompactionBasicService(ctx as any)

    // 8 short messages
    const messages: ChatMessage[] = Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Kısa mesaj no ${i}: Merhaba dünya!`
    }))

    const result = compactor.compact(messages)
    assert.equal(result.compacted, false, 'Should not compact when messages <= 10 and tokens < 12,000')
    assert.equal(result.messages.length, 8)
  })

  test('compacts when message count > 10', () => {
    const ctx = new Context()
    const compactor = new CompactionBasicService(ctx as any)

    // 14 short messages
    const messages: ChatMessage[] = Array.from({ length: 14 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Mesaj no ${i}: İşlem adımı.`
    }))

    const result = compactor.compact(messages, 4)
    assert.equal(result.compacted, true, 'Should compact when messages > 10')
    assert.ok(result.summary)
    assert.ok(result.prunedCount! >= 1)

    // Result should keep initial user message as messages[0] and summaryMessage as messages[1]
    assert.equal(result.messages[0].content, 'Mesaj no 0: İşlem adımı.')
    assert.ok(result.messages[1].content?.includes('[Önceki Konuşma ve Araç Çıktıları Özeti'))
  })

  test('compacts when tokens >= 12,000 regardless of message count', () => {
    const ctx = new Context()
    const compactor = new CompactionBasicService(ctx as any)

    // 3 messages, but total chars >= 30,000 (~12,000 tokens)
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Lütfen büyük bir dosya içeriğini analiz et.' },
      { role: 'assistant', content: 'İçerik:'.padEnd(30500, 'X') },
      { role: 'user', content: 'Şimdi ne yapmalıyız?' }
    ]

    const result = compactor.compact(messages, 2)
    assert.equal(result.compacted, true, 'Should compact when tokens >= 12,000')
    assert.ok(result.summary)
  })

  test('compacts when force = true regardless of message/token count', () => {
    const ctx = new Context()
    const compactor = new CompactionBasicService(ctx as any)

    const messages: ChatMessage[] = [
      { role: 'user', content: 'Turn 1' },
      { role: 'assistant', content: 'Response 1' },
      { role: 'user', content: 'Turn 2' },
      { role: 'assistant', content: 'Response 2' }
    ]

    const result = compactor.compact(messages, 2, true)
    assert.equal(result.compacted, true, 'Should compact when force = true')
    assert.ok(result.summary)
  })
})
