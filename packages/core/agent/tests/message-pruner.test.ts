import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { ChatMessage } from '@custom-harness/core-types'
import { pruneToolMessages, ensureUserMessage, PRUNE_NOTICE } from '../src/message-pruner.js'

describe('pruneToolMessages', () => {
  test('returns empty array when given empty or falsy messages', () => {
    assert.deepEqual(pruneToolMessages([]), [])
  })

  test('does not prune messages within the recent threshold (last 4 messages)', () => {
    const longText = 'X'.repeat(500)
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'calling tool' },
      { role: 'tool', content: longText, tool_call_id: 'call_1' },
      { role: 'assistant', content: 'done' }
    ]

    const pruned = pruneToolMessages(messages, 4)
    assert.equal(pruned.length, 4)
    assert.equal(pruned[2].content, longText, 'Recent tool output should not be pruned')
  })

  test('prunes older tool result messages exceeding maxAllowedLength', () => {
    const longText = 'A'.repeat(200) + 'B'.repeat(200) // 400 chars > 300
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Step 1' },
      { role: 'tool', content: longText, tool_call_id: 'call_old' },
      { role: 'assistant', content: 'Step 2' },
      { role: 'user', content: 'Step 3' },
      { role: 'tool', content: 'recent tool output', tool_call_id: 'call_recent' },
      { role: 'assistant', content: 'Step 4' }
    ]

    const pruned = pruneToolMessages(messages, 4, 300, 200)
    const oldToolMsg = pruned[1]

    assert.equal(oldToolMsg.content?.startsWith('A'.repeat(200)), true)
    assert.equal(oldToolMsg.content?.includes(PRUNE_NOTICE), true)
    assert.equal(oldToolMsg.content?.includes('B'), false, 'Content after 200 chars should be truncated')
  })

  test('does not prune older tool messages if length is under maxAllowedLength', () => {
    const shortText = 'Small output 123'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'query' },
      { role: 'tool', content: shortText, tool_call_id: 'call_short' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
      { role: 'assistant', content: 'a3' }
    ]

    const pruned = pruneToolMessages(messages, 4, 300)
    assert.equal(pruned[1].content, shortText)
  })

  test('does not prune non-tool messages even if they are long and old', () => {
    const longUserMsg = 'U'.repeat(1000)
    const messages: ChatMessage[] = [
      { role: 'user', content: longUserMsg },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
      { role: 'assistant', content: 'a3' }
    ]

    const pruned = pruneToolMessages(messages, 4)
    assert.equal(pruned[0].content, longUserMsg, 'User messages must never be pruned by tool pruner')
  })
})

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
