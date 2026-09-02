import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServer, type TestServer } from './server-harness.js'
import path from 'node:path'
import os from 'node:os'

describe('Server Package - Workspace & Directory Endpoints', () => {
  let server: TestServer

  before(async () => {
    server = await createTestServer()
  })

  after(async () => {
    await server.cleanup()
  })

  test('GET /api/workspace returns workspace directory and files for caller', async () => {
    const res = await server.adminRequest('/api/workspace')
    assert.equal(res.status, 200)
    assert.ok(res.data.cwd)
    assert.ok(Array.isArray(res.data.files))
  })

  test('POST /api/workspace/browse lists folders and files in a valid directory', async () => {
    const target = path.resolve(process.cwd())
    const res = await server.adminRequest('/api/workspace/browse', {
      method: 'POST',
      body: { path: target }
    })

    assert.equal(res.status, 200)
    assert.ok(res.data.current)
    assert.ok(Array.isArray(res.data.directories))
    assert.ok(Array.isArray(res.data.files))
  })

  test('POST /api/workspace sets workspace per-user and per-session without global pollution', async () => {
    const userAName = `user_ws_a_${Date.now()}`
    const userBName = `user_ws_b_${Date.now()}`

    const regA = await server.request('/api/auth/register', {
      method: 'POST',
      body: { username: userAName, name: 'User A', role: 'user' }
    })
    const userA = regA.data.user.id

    const regB = await server.request('/api/auth/register', {
      method: 'POST',
      body: { username: userBName, name: 'User B', role: 'user' }
    })
    const userB = regB.data.user.id

    const dirA = path.resolve(process.cwd())
    const dirB = path.resolve(os.homedir())

    // User A sets workspace to dirA
    const resA = await server.userRequest(userA, '/api/workspace', {
      method: 'POST',
      body: { path: dirA }
    })
    assert.equal(resA.status, 200)
    assert.equal(resA.data.success, true)
    assert.equal(resA.data.workspace, dirA)

    // User B sets workspace to dirB
    const resB = await server.userRequest(userB, '/api/workspace', {
      method: 'POST',
      body: { path: dirB }
    })
    assert.equal(resB.status, 200)
    assert.equal(resB.data.success, true)
    assert.equal(resB.data.workspace, dirB)

    // Query userA -> must return dirA
    const getA = await server.userRequest(userA, '/api/workspace')
    assert.equal(getA.data.cwd, dirA)

    // Query userB -> must return dirB
    const getB = await server.userRequest(userB, '/api/workspace')
    assert.equal(getB.data.cwd, dirB)
  })

  test('POST /api/workspace rejects non-existent paths gracefully', async () => {
    const res = await server.adminRequest('/api/workspace', {
      method: 'POST',
      body: { path: '/non/existent/path/xyz_12345' }
    })

    assert.equal(res.status, 400)
    assert.ok(res.data.error)
  })
})
