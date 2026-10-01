import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { toolFilterMiddleware } from '../src/tool-filter.js'

describe('toolFilterMiddleware (Zero-Trust Tool Whitelisting)', () => {
  const dummyTools = [
    { type: 'function', function: { name: 'read_file' } },
    { type: 'function', function: { name: 'write_file' } },
    { type: 'function', function: { name: 'bash' } }
  ]

  test('filters down to enabledTools whitelist', async () => {
    const ctx: any = {
      preset: {
        id: 'reviewer',
        enabledTools: ['read_file']
      },
      tools: [...dummyTools]
    }

    await toolFilterMiddleware.beforeChat!(ctx, async () => {})

    assert.equal(ctx.tools.length, 1)
    assert.equal(ctx.tools[0].function.name, 'read_file')
  })

  test('empties tools when enabledTools is undefined (Zero-Trust default)', async () => {
    const ctx: any = {
      preset: {
        id: 'chat-agent'
      },
      tools: [...dummyTools]
    }

    await toolFilterMiddleware.beforeChat!(ctx, async () => {})

    assert.equal(ctx.tools.length, 0)
  })

  test('empties tools when enabledTools is empty array', async () => {
    const ctx: any = {
      preset: {
        id: 'chat-agent-empty',
        enabledTools: []
      },
      tools: [...dummyTools]
    }

    await toolFilterMiddleware.beforeChat!(ctx, async () => {})

    assert.equal(ctx.tools.length, 0)
  })
})
