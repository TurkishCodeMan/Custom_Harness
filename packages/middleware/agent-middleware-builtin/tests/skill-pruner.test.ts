import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { skillPrunerMiddleware } from '../src/skill-pruner.js'
import type { BeforeChatContext } from '@custom-harness/agent-middleware'
import type { ChatMessage } from '@custom-harness/core-types'

describe('skillPrunerMiddleware', () => {
  test('does not prune skill called in current turn (after last user message)', async () => {
    let nextCalled = false
    const messages: ChatMessage[] = [
      { role: 'user', content: 'faturayı incele' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'skill', arguments: '{"skillName":"invoice-review-skill"}' } }]
      },
      {
        role: 'tool',
        name: 'skill',
        tool_call_id: 'call_1',
        content: '### AKTİF BECERİ TALİMATLARI: (invoice-review-skill)\nTam şema ve detaylar burada (4503 karakter)...'
      }
    ]

    const ctx = {
      sessionId: 's1',
      messages,
      systemPrompt: 'sys'
    } as unknown as BeforeChatContext

    await skillPrunerMiddleware.beforeChat!(ctx, async () => {
      nextCalled = true
    })

    assert.equal(nextCalled, true)
    const toolMsg = ctx.messages.find(m => m.role === 'tool' && m.name === 'skill')
    assert.ok(toolMsg?.content?.includes('Tam şema'), 'Skill in current turn must not be pruned')
  })

  test('does not prune the latest skill call even across turns', async () => {
    let nextCalled = false
    const messages: ChatMessage[] = [
      { role: 'user', content: 'ilk mesaj' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'skill', arguments: '{"skillName":"invoice-review-skill"}' } }]
      },
      {
        role: 'tool',
        name: 'skill',
        tool_call_id: 'call_1',
        content: '### AKTİF BECERİ TALİMATLARI: (invoice-review-skill)\nŞema bilgileri'
      },
      { role: 'assistant', content: 'anladım' },
      { role: 'user', content: 'sonraki mesaj' }
    ]

    const ctx = {
      sessionId: 's1',
      messages,
      systemPrompt: 'sys'
    } as unknown as BeforeChatContext

    await skillPrunerMiddleware.beforeChat!(ctx, async () => {
      nextCalled = true
    })

    assert.equal(nextCalled, true)
    const toolMsg = ctx.messages.find(m => m.role === 'tool' && m.name === 'skill')
    assert.equal(toolMsg?.content, '### AKTİF BECERİ TALİMATLARI: (invoice-review-skill)\nŞema bilgileri')
  })

  test('only prunes older duplicate skill calls and does NOT capture character counts like (4503 karakter)', async () => {
    let nextCalled = false
    const messages: ChatMessage[] = [
      { role: 'user', content: 'mesaj 1' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_old', type: 'function', function: { name: 'skill', arguments: '{"skillName":"invoice-review-skill"}' } }]
      },
      {
        role: 'tool',
        name: 'skill',
        tool_call_id: 'call_old',
        content: 'Eski beceri talimatı (4503 karakter) boyutu.'
      },
      { role: 'assistant', content: 'tamam' },
      { role: 'user', content: 'mesaj 2' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_new', type: 'function', function: { name: 'skill', arguments: '{"skillName":"invoice-review-skill"}' } }]
      },
      {
        role: 'tool',
        name: 'skill',
        tool_call_id: 'call_new',
        content: 'Yeni beceri talimatı (güncel).'
      }
    ]

    const ctx = {
      sessionId: 's1',
      messages,
      systemPrompt: 'sys'
    } as unknown as BeforeChatContext

    await skillPrunerMiddleware.beforeChat!(ctx, async () => {
      nextCalled = true
    })

    assert.equal(nextCalled, true)
    const oldToolMsg = ctx.messages.find(m => m.tool_call_id === 'call_old')
    assert.ok(oldToolMsg?.content?.includes("[Skill 'invoice-review-skill'"), 'Old skill must be pruned with proper skill label')
    assert.ok(!oldToolMsg?.content?.includes('4503 karakter'), 'Must NOT capture "4503 karakter" as skill name')

    const newToolMsg = ctx.messages.find(m => m.tool_call_id === 'call_new')
    assert.equal(newToolMsg?.content, 'Yeni beceri talimatı (güncel).', 'Latest skill must not be pruned')
  })
})
