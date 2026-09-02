import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServer, type TestServer } from './server-harness.js'

describe('Server Package - Authentication & Multi-Tenancy Endpoints', () => {
  let server: TestServer
  const createdUserIds: string[] = []

  before(async () => {
    server = await createTestServer()
  })

  after(async () => {
    for (const uid of createdUserIds) {
      try {
        await (server.ctx as any).auth?.deleteUser(uid)
      } catch {}
    }
    await server.cleanup()
  })

  test('GET /api/auth/me returns current user identity (admin)', async () => {
    const res = await server.adminRequest('/api/auth/me')
    assert.equal(res.status, 200)
    assert.ok(res.data.user)
    assert.equal(res.data.user.role, 'admin')
  })

  test('POST /api/auth/register creates a new tenant user with token', async () => {
    const testUsername = `tenant_${Date.now()}`
    const res = await server.request('/api/auth/register', {
      method: 'POST',
      body: {
        username: testUsername,
        name: 'Test Tenant User',
        email: `${testUsername}@example.com`,
        role: 'user'
      }
    })

    assert.equal(res.status, 200)
    assert.equal(res.data.success, true)
    assert.ok(res.data.user)
    assert.equal(res.data.user.username, testUsername)
    assert.ok(res.data.token)
    if (res.data.user.id) {
      createdUserIds.push(res.data.user.id)
    }
  })

  test('POST /api/auth/login authenticates registered user', async () => {
    const res = await server.request('/api/auth/login', {
      method: 'POST',
      body: {
        username: 'admin'
      }
    })

    assert.equal(res.status, 200)
    assert.equal(res.data.success, true)
    assert.ok(res.data.token)
    assert.equal(res.data.user?.role, 'admin')
  })

  test('POST /api/auth/switch switches active tenant identity', async () => {
    const res = await server.request('/api/auth/switch', {
      method: 'POST',
      body: {
        userId: 'user_admin'
      }
    })

    assert.equal(res.status, 200)
    assert.ok(res.data.user)
    assert.equal(res.data.user.id, 'user_admin')
    assert.ok(res.data.token)
  })

  test('GET /api/auth/users lists all tenant users', async () => {
    const res = await server.adminRequest('/api/auth/users')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.data.users))
    assert.ok(res.data.users.length > 0)
  })

  test('POST /api/auth/users enforces admin role for user creation', async () => {
    // Register a standard non-admin user
    const standardUsername = `std_user_${Date.now()}`
    const regRes = await server.request('/api/auth/register', {
      method: 'POST',
      body: {
        username: standardUsername,
        name: 'Standard User',
        role: 'user'
      }
    })
    const standardUserId = regRes.data.user.id
    if (standardUserId) createdUserIds.push(standardUserId)

    // Non-admin attempt should be forbidden
    const nonAdminRes = await server.userRequest(standardUserId, '/api/auth/users', {
      method: 'POST',
      body: {
        username: 'unauthorized_user',
        name: 'Unauthorized'
      }
    })
    assert.equal(nonAdminRes.status, 403)

    // Admin attempt should succeed
    const adminRes = await server.adminRequest('/api/auth/users', {
      method: 'POST',
      body: {
        username: `managed_${Date.now()}`,
        name: 'Managed User',
        role: 'user'
      }
    })
    assert.equal(adminRes.status, 200)
    assert.ok(adminRes.data.user)
    if (adminRes.data.user?.id) createdUserIds.push(adminRes.data.user.id)
  })

  test('POST /api/auth/logout responds cleanly', async () => {
    const res = await server.request('/api/auth/logout', { method: 'POST' })
    assert.equal(res.status, 200)
    assert.equal(res.data.success, true)
  })
})
