import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createMockContext, createAgentService } from './test-harness.js'

describe('AgentService.run (End-to-End & Fail-Fast)', () => {
  test('assertRequiredServices throws when core services are missing', () => {
    const incompleteCtx = { session: null } as any
    const agent = createAgentService(incompleteCtx)

    assert.throws(
      () => agent.assertRequiredServices(),
      /Zorunlu 'session' servisi Context üzerinde bulunamadı/
    )
  })

  test('successfully executes simple single-turn conversation', async () => {
    const mockCtx = createMockContext({
      llm: {
        streamChat: async function* () {
          yield { type: 'chunk', content: 'Merhaba, ' }
          yield { type: 'chunk', content: 'nasıl yardımcı olabilirim?' }
        }
      }
    })

    const agent = createAgentService(mockCtx)
    const session = mockCtx.session.createSession()

    let streamedChunks = ''
    const response = await agent.run({
      sessionId: session.id,
      prompt: 'Selam',
      onChunk: (c) => { streamedChunks += c }
    })

    assert.equal(response, 'Merhaba, nasıl yardımcı olabilirim?')
    assert.equal(streamedChunks, 'Merhaba, nasıl yardımcı olabilirim?')

    // Check session messages: 1 user, 1 assistant
    const stored = mockCtx.session.getSession(session.id)
    assert.equal(stored?.messages.length, 2)
    assert.equal(stored?.messages[0].role, 'user')
    assert.equal(stored?.messages[0].content, 'Selam')
    assert.equal(stored?.messages[1].role, 'assistant')
    assert.equal(stored?.messages[1].content, 'Merhaba, nasıl yardımcı olabilirim?')
  })

  test('extracts <think> tags during streaming and emits onThought', async () => {
    const mockCtx = createMockContext({
      llm: {
        streamChat: async function* () {
          yield { type: 'thought', content: 'Kullanıcıyı selamlama düşüncesi.' }
          yield { type: 'chunk', content: '<think>Ekstra akıl yürütme</think>Nihai yanıt.' }
        }
      }
    })

    const agent = createAgentService(mockCtx)
    const session = mockCtx.session.createSession()

    let thoughtEvents = ''
    const response = await agent.run({
      sessionId: session.id,
      prompt: 'Test düşünce',
      onThought: (t) => { thoughtEvents += t }
    })

    assert.equal(response, 'Nihai yanıt.')
    assert.equal(thoughtEvents, 'Kullanıcıyı selamlama düşüncesi.')

    const stored = mockCtx.session.getSession(session.id)
    const assistantMsg = stored?.messages[1]
    assert.equal(assistantMsg?.reasoning_content?.includes('Kullanıcıyı selamlama düşüncesi.'), true)
    assert.equal(assistantMsg?.reasoning_content?.includes('Ekstra akıl yürütme'), true)
  })

  test('executes tool_call and continues ReAct loop to final answer', async () => {
    let callCount = 0

    const mockCtx = createMockContext({
      llm: {
        streamChat: async function* () {
          callCount++
          if (callCount === 1) {
            // Turn 1: Model requests tool execution
            yield {
              type: 'tool_call',
              toolCall: { id: 'call_fs_1', name: 'read_file', arguments: '{"path":"README.md"}' }
            }
          } else {
            // Turn 2: Model answers based on tool output
            yield { type: 'chunk', content: 'Dosya içeriği okundu ve tamamlandı.' }
          }
        }
      },
      tools: {
        getOpenAiSchemas: () => [{ type: 'function', function: { name: 'read_file' } }],
        execute: async (name: string, args: any) => `# Project Title\nHello from file`
      }
    })

    const agent = createAgentService(mockCtx)
    const session = mockCtx.session.createSession()

    let toolStarted: any = null
    let toolResult: any = null

    const response = await agent.run({
      sessionId: session.id,
      prompt: 'README dosyasını oku',
      onToolStart: (t) => { toolStarted = t },
      onToolResult: (r) => { toolResult = r }
    })

    assert.equal(callCount, 2, 'LLM should be called twice (tool call + final response)')
    assert.equal(response, 'Dosya içeriği okundu ve tamamlandı.')
    assert.equal(toolStarted?.name, 'read_file')
    assert.equal(toolResult?.output, '# Project Title\nHello from file')

    // Session must contain: user, assistant(tool_calls), tool(result), assistant(final)
    const stored = mockCtx.session.getSession(session.id)
    assert.equal(stored?.messages.length, 4)
    assert.equal(stored?.messages[0].role, 'user')
    assert.equal(stored?.messages[1].role, 'assistant')
    assert.equal(stored?.messages[1].tool_calls?.length, 1)
    assert.equal(stored?.messages[2].role, 'tool')
    assert.equal(stored?.messages[3].role, 'assistant')
    assert.equal(stored?.messages[3].content, 'Dosya içeriği okundu ve tamamlandı.')
  })

  test('aborts gracefully when AbortSignal is triggered', async () => {
    const controller = new AbortController()
    controller.abort() // Immediately aborted

    let llmCalled = false
    const mockCtx = createMockContext({
      llm: {
        streamChat: async function* () {
          llmCalled = true
          yield { type: 'chunk', content: 'should not run' }
        }
      }
    })

    const agent = createAgentService(mockCtx)
    const session = mockCtx.session.createSession()

    const response = await agent.run({
      sessionId: session.id,
      prompt: 'iptal testi',
      signal: controller.signal
    })

    assert.equal(response, '')
    assert.equal(llmCalled, false, 'LLM stream must not be invoked after abort')
  })
})
