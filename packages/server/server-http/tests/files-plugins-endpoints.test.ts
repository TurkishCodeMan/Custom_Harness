import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServer, type TestServer } from './server-harness.js'

describe('Server Package - Files, Plugins & MCP Endpoints', () => {
  let server: TestServer
  const testUserId = `user_files_test_${Date.now()}`

  before(async () => {
    server = await createTestServer()
  })

  after(async () => {
    await server.cleanup()
  })

  test('POST /api/upload/:sessionId accepts base64 files and saves them', async () => {
    const dummyBase64 = 'data:text/plain;base64,' + Buffer.from('Hello Test File Content').toString('base64')
    const res = await server.userRequest(testUserId, '/api/upload/session_upload_test', {
      method: 'POST',
      body: {
        files: [
          {
            name: 'test_doc.txt',
            data: dummyBase64,
            type: 'text/plain'
          }
        ]
      }
    })

    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data.files))
    assert.equal(res.data.files.length, 1)
    assert.equal(res.data.files[0].fileName, 'test_doc.txt')
  })

  test('GET /api/files/my-files lists uploaded tenant files', async () => {
    const res = await server.userRequest(testUserId, '/api/files/my-files')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data.files))
  })

  test('GET /api/uploads/:sessionId returns files uploaded for specific session', async () => {
    const res = await server.userRequest(testUserId, '/api/uploads/session_upload_test')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data.files))
    assert.equal(res.data.files.length, 1)
  })

  test('GET /api/plugins lists system plugins and categories', async () => {
    const res = await server.adminRequest('/api/plugins')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data))
  })

  test('GET /api/mcp/servers lists configured MCP server endpoints', async () => {
    const res = await server.adminRequest('/api/mcp/servers')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data.servers))
  })

  test('GET /api/context/measure returns global or session token measurement', async () => {
    const res = await server.userRequest(testUserId, '/api/context/measure')
    assert.equal(res.status, 200)
    assert.ok(res.data.totalTokens !== undefined || res.data.contextPressure !== undefined)
  })
})
