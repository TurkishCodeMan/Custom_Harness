import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServer, type TestServer } from './server-harness.js'

describe('Server Package - Settings & Presets Endpoints', () => {
  let server: TestServer
  const testUserId = `user_settings_test_${Date.now()}`

  before(async () => {
    server = await createTestServer()
  })

  after(async () => {
    await server.cleanup()
  })

  test('GET /api/settings returns settings configuration', async () => {
    const res = await server.userRequest(testUserId, '/api/settings')
    assert.equal(res.status, 200)
    assert.ok(res.data.providers || res.data.defaultModel)
  })

  test('POST /api/settings updates user-level settings (UI, thinking)', async () => {
    const res = await server.userRequest(testUserId, '/api/settings', {
      method: 'POST',
      body: {
        thinkingEnabled: true,
        ui: {
          fontWeight: 'bold',
          fontSize: 'lg',
          bubbleStyle: 'modern'
        }
      }
    })

    assert.equal(res.status, 200)
    assert.equal(res.data.thinkingEnabled, true)
    assert.equal(res.data.ui?.fontWeight, 'bold')
  })

  test('POST /api/settings/sandbox-mode switches sandbox mode', async () => {
    const res = await server.adminRequest('/api/settings/sandbox-mode', {
      method: 'POST',
      body: { mode: 'read-only' }
    })

    assert.equal(res.status, 200)
    assert.equal(res.data.success, true)
    assert.equal(res.data.sandboxMode, 'read-only')

    // Reset back to workspace-write
    await server.adminRequest('/api/settings/sandbox-mode', {
      method: 'POST',
      body: { mode: 'workspace-write' }
    })
  })

  test('GET /api/presets lists available presets', async () => {
    const res = await server.userRequest(testUserId, '/api/presets')
    assert.equal(res.status, 200)
    const list = Array.isArray(res.data) ? res.data : res.data.presets
    assert.ok(Array.isArray(list))
    assert.ok(list.length > 0)
  })

  test('POST /api/presets saves a new agent preset profile', async () => {
    const presetId = `preset_${Date.now()}`
    const res = await server.userRequest(testUserId, '/api/presets', {
      method: 'POST',
      body: {
        id: presetId,
        name: 'Custom Test Preset',
        description: 'Testing presets endpoints',
        icon: '🧪',
        systemPrompt: 'You are a test assistant.',
        enabledTools: ['bash', 'skill']
      }
    })

    assert.equal(res.status, 200)
    assert.equal(res.data.success, true)

    // Select this preset
    const selectRes = await server.userRequest(testUserId, '/api/presets/select', {
      method: 'POST',
      body: { presetId }
    })
    assert.equal(selectRes.status, 200)
    assert.equal(selectRes.data.success, true)

    // Delete preset
    const deleteRes = await server.userRequest(testUserId, `/api/presets/${presetId}`, {
      method: 'DELETE'
    })
    assert.equal(deleteRes.status, 200)
    assert.equal(deleteRes.data.success, true)
  })
})
