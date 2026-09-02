import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServer, type TestServer } from './server-harness.js'
import WebSocket from 'ws'

describe('Server Package - WebSocket Real-Time Gateway', () => {
  let server: TestServer

  before(async () => {
    server = await createTestServer()
  })

  after(async () => {
    await server.cleanup()
  })

  test('WebSocket connects successfully and sends welcome/connected message', async () => {
    const ws = new WebSocket(server.wsUrl)

    const messagePromise = new Promise<any>((resolve, reject) => {
      ws.on('message', (raw) => {
        try {
          resolve(JSON.parse(raw.toString()))
        } catch (e) {
          reject(e)
        }
      })
      ws.on('error', reject)
    })

    const msg = await messagePromise
    assert.equal(msg.type, 'connected')
    ws.close()
  })

  test('WebSocket responds to get_context with context_update message', async () => {
    const ws = new WebSocket(server.wsUrl)
    await new Promise((resolve) => ws.once('open', resolve))

    // Create a dummy session
    const session = server.ctx.session.createSession('WS Test', undefined, 'user_ws', 'web')

    const contextPromise = new Promise<any>((resolve) => {
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.type === 'context_update') {
            resolve(msg)
          }
        } catch {}
      })
    })

    ws.send(JSON.stringify({ type: 'get_context', sessionId: session.id }))
    const msg = await contextPromise
    assert.equal(msg.type, 'context_update')
    assert.ok(msg.measurement)

    ws.close()
  })

  test('WebSocket handles abort command without crashing', async () => {
    const ws = new WebSocket(server.wsUrl)
    await new Promise((resolve) => ws.once('open', resolve))

    ws.send(JSON.stringify({ type: 'abort', sessionId: 'dummy_session_id' }))
    // Give event loop time to process
    await new Promise((r) => setTimeout(r, 100))

    assert.equal(ws.readyState, WebSocket.OPEN)
    ws.close()
  })
})
