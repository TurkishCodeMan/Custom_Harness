import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServer, type TestServer } from './server-harness.js'

describe('Server Package - Sessions Endpoints', () => {
  let server: TestServer
  let testSessionId: string
  let testUserId: string

  before(async () => {
    server = await createTestServer()

    // Register user as regular tenant
    const regRes = await server.request('/api/auth/register', {
      method: 'POST',
      body: {
        username: `sess_user_${Date.now()}`,
        name: 'Session Test User',
        role: 'user'
      }
    })
    testUserId = regRes.data.user.id

    // Seed a session for testUserId
    const session = server.ctx.session.createSession('Test Session 1', undefined, testUserId, 'web')
    testSessionId = session.id
  })

  after(async () => {
    await server.cleanup()
  })

  test('GET /api/sessions returns active sessions list for caller', async () => {
    const res = await server.userRequest(testUserId, '/api/sessions')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data))
    assert.ok(res.data.some((s: any) => s.id === testSessionId))
  })

  test('GET /api/sessions/:id returns session details', async () => {
    const res = await server.userRequest(testUserId, `/api/sessions/${testSessionId}`)
    assert.equal(res.status, 200)
    assert.equal(res.data.id, testSessionId)
    assert.equal(res.data.userId, testUserId)
  })

  test('GET /api/sessions/:id returns 404 for non-existent session', async () => {
    const res = await server.userRequest(testUserId, '/api/sessions/non-existent-session-id')
    assert.equal(res.status, 404)
    assert.ok(res.data.error)
  })

  test('GET /api/sessions/:id/context returns context measurement', async () => {
    const res = await server.userRequest(testUserId, `/api/sessions/${testSessionId}/context`)
    assert.equal(res.status, 200)
    assert.ok(res.data.totalTokens !== undefined || res.data.contextPressure !== undefined)
  })

  test('POST /api/sessions/:id/compact triggers compaction process', async () => {
    const res = await server.userRequest(testUserId, `/api/sessions/${testSessionId}/compact`, {
      method: 'POST'
    })
    assert.equal(res.status, 200)
  })

  test('DELETE /api/sessions/:id removes a specific session', async () => {
    // Create a temporary session to delete
    const tempSession = server.ctx.session.createSession('To Delete', undefined, testUserId, 'web')
    
    const deleteRes = await server.userRequest(testUserId, `/api/sessions/${tempSession.id}`, {
      method: 'DELETE'
    })
    assert.equal(deleteRes.status, 200)
    assert.equal(deleteRes.data.success, true)

    // Verify it is no longer found
    const getRes = await server.userRequest(testUserId, `/api/sessions/${tempSession.id}`)
    assert.equal(getRes.status, 404)
  })

  test('POST /api/sessions/clear clears all sessions for the caller', async () => {
    const res = await server.userRequest(testUserId, '/api/sessions/clear', {
      method: 'POST'
    })
    assert.equal(res.status, 200)
    assert.equal(res.data.success, true)

    // Verify list is now empty for this user
    const listRes = await server.userRequest(testUserId, '/api/sessions')
    assert.equal(listRes.status, 200)
    assert.equal(listRes.data.length, 0)
  })
})
