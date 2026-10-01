import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { toolGuardMiddleware } from '../src/tool-guard.js'
import type { BeforeToolContext } from '@custom-harness/agent-middleware'

describe('toolGuardMiddleware', () => {
  test('allows tool when tool is in enabledTools whitelist', async () => {
    let nextCalled = false
    const ctx: BeforeToolContext = {
      sessionId: 's1',
      turnCount: 1,
      toolName: 'read_file',
      params: { path: 'POLICY.md' },
      toolCallId: 'call_1',
      preset: {
        id: 'invoice-reviewer-v1',
        name: 'Invoice Reviewer',
        description: 'Auditor',
        enabledTools: ['read_file', 'list_dir']
      }
    }

    await toolGuardMiddleware.beforeTool!(ctx, async () => {
      nextCalled = true
    })

    assert.equal(nextCalled, true)
    assert.equal(ctx.skipExecution, undefined)
  })

  test('blocks tool when tool is NOT in enabledTools whitelist', async () => {
    let nextCalled = false
    const ctx: BeforeToolContext = {
      sessionId: 's1',
      turnCount: 1,
      toolName: 'bash',
      params: { command: 'rm -rf /' },
      toolCallId: 'call_2',
      preset: {
        id: 'invoice-reviewer-v1',
        name: 'Invoice Reviewer',
        description: 'Auditor',
        enabledTools: ['read_file', 'list_dir']
      }
    }

    await toolGuardMiddleware.beforeTool!(ctx, async () => {
      nextCalled = true
    })

    assert.equal(nextCalled, false)
    assert.equal(ctx.skipExecution, true)
    assert.match(ctx.customOutput, /Erişim Engeli \/ Tool Guard/)
    assert.match(ctx.customOutput, /bash/)
  })

  test('blocks tool when enabledTools is empty array', async () => {
    let nextCalled = false
    const ctx: BeforeToolContext = {
      sessionId: 's1',
      turnCount: 1,
      toolName: 'bash',
      params: { command: 'ls' },
      toolCallId: 'call_3',
      preset: {
        id: 'restricted-agent',
        name: 'Restricted',
        description: 'Restricted',
        enabledTools: []
      }
    }

    await toolGuardMiddleware.beforeTool!(ctx, async () => {
      nextCalled = true
    })

    assert.equal(nextCalled, false)
    assert.equal(ctx.skipExecution, true)
    assert.match(ctx.customOutput, /Erişim Engeli \/ Tool Guard/)
  })

  test('blocks tool when preset has no enabledTools defined', async () => {
    let nextCalled = false
    const ctx: BeforeToolContext = {
      sessionId: 's1',
      turnCount: 1,
      toolName: 'bash',
      params: { command: 'ls' },
      toolCallId: 'call_4',
      preset: {
        id: 'agent-no-tools',
        name: 'Chat Only Agent',
        description: 'No tools defined'
      }
    }

    await toolGuardMiddleware.beforeTool!(ctx, async () => {
      nextCalled = true
    })

    assert.equal(nextCalled, false)
    assert.equal(ctx.skipExecution, true)
    assert.match(ctx.customOutput, /Erişim Engeli \/ Tool Guard/)
  })
})
