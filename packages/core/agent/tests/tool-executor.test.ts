import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { executeToolCall, recordAndEmitToolResult } from '../src/tool-executor.js'
import { createMockContext } from './test-harness.js'

describe('tool-executor', () => {
  test('recordAndEmitToolResult records message to session and triggers onToolResult callback', () => {
    const mockCtx = createMockContext()
    let emittedResult: any = null

    recordAndEmitToolResult(
      mockCtx,
      {
        sessionId: 'test_sess',
        turnCount: 1,
        cwd: '/test',
        onToolResult: (res) => { emittedResult = res }
      },
      'call_123',
      'bash',
      'command output'
    )

    assert.deepEqual(emittedResult, { id: 'call_123', name: 'bash', output: 'command output' })
    const session = mockCtx.session.getSession('test_sess')
    assert.equal(session?.messages.length, 1)
    assert.equal(session?.messages[0].role, 'tool')
    assert.equal(session?.messages[0].content, 'command output')
    assert.equal(session?.messages[0].tool_call_id, 'call_123')
  })

  test('successfully executes tool and records result', async () => {
    let executedToolName = ''
    let executedArgs: any = null

    const mockCtx = createMockContext({
      tools: {
        execute: async (name: string, args: any) => {
          executedToolName = name
          executedArgs = args
          return `success: ${name}`
        }
      }
    })

    let callbackOutput: any = null

    await executeToolCall(
      mockCtx,
      { id: 'c1', name: 'file_reader', arguments: '{"path":"a.txt"}' },
      {
        sessionId: 'sess_tool_1',
        turnCount: 1,
        cwd: '/app',
        onToolResult: (r) => { callbackOutput = r }
      }
    )

    assert.equal(executedToolName, 'file_reader')
    assert.deepEqual(executedArgs, { path: 'a.txt' })
    assert.equal(callbackOutput?.output, 'success: file_reader')

    const session = mockCtx.session.getSession('sess_tool_1')
    assert.equal(session?.messages.length, 1)
    assert.equal(session?.messages[0].content, 'success: file_reader')
  })

  test('beforeTool middleware blocks execution when shouldBlock is true', async () => {
    let toolExecuted = false

    const mockCtx = createMockContext({
      agentMiddleware: {
        runBeforeTool: async () => ({ shouldBlock: true, output: 'Access Denied by Policy' })
      },
      tools: {
        execute: async () => {
          toolExecuted = true
          return 'should not run'
        }
      }
    })

    let callbackOutput: any = null

    await executeToolCall(
      mockCtx,
      { id: 'c2', name: 'dangerous_rm', arguments: '{}' },
      {
        sessionId: 'sess_block',
        turnCount: 1,
        cwd: '/app',
        onToolResult: (r) => { callbackOutput = r }
      }
    )

    assert.equal(toolExecuted, false, 'Tool must NOT be executed when middleware blocks it')
    assert.equal(callbackOutput?.output, 'Access Denied by Policy')

    const session = mockCtx.session.getSession('sess_block')
    assert.equal(session?.messages[0].content, 'Access Denied by Policy')
  })

  test('approval check cancels execution when denied', async () => {
    let toolExecuted = false

    const mockCtx = createMockContext({
      approval: {
        requestApproval: async () => 'deny'
      },
      tools: {
        execute: async () => {
          toolExecuted = true
          return 'denied'
        }
      }
    })

    let callbackOutput: any = null

    await executeToolCall(
      mockCtx,
      { id: 'c3', name: 'deploy_prod', arguments: '{}' },
      {
        sessionId: 'sess_deny',
        turnCount: 1,
        cwd: '/app',
        onToolResult: (r) => { callbackOutput = r }
      }
    )

    assert.equal(toolExecuted, false)
    assert.equal(callbackOutput?.output.includes('Kullanıcı bu araç çağrısını onaylamadı'), true)
  })

  test('repeatGuard blocks tool execution when loop is detected', async () => {
    let toolExecuted = false

    const mockCtx = createMockContext({
      repeatGuard: {
        inspectCall: () => ({ shouldBlock: true, isLooping: true, reminder: 'Loop Detected' })
      },
      tools: {
        execute: async () => {
          toolExecuted = true
          return 'loop'
        }
      }
    })

    let callbackOutput: any = null

    await executeToolCall(
      mockCtx,
      { id: 'c4', name: 'looping_tool', arguments: '{}' },
      {
        sessionId: 'sess_loop',
        turnCount: 1,
        cwd: '/app',
        onToolResult: (r) => { callbackOutput = r }
      }
    )

    assert.equal(toolExecuted, false)
    assert.equal(callbackOutput?.output, 'Loop Detected')
  })
})
