import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { Context } from '@custom-harness/core-context'
import * as settings from '@custom-harness/settings'
import * as sessionPlugin from '../src/index.js'
import * as reflexionLocalPlugin from '@custom-harness/reflexion-local'

describe('State & Tenant Isolation Audit Tests', async () => {
  const ctx = new Context()
  ctx.plugin(settings)
  ctx.plugin(sessionPlugin)
  ctx.plugin(reflexionLocalPlugin)
  await ctx.start()

  test('1. Cascading Deletion: Deleting parent session cascade-deletes all subagent trace sessions', () => {
    const parent = ctx.session.createSession('Parent Objective Session', undefined, 'tenant_alpha', 'web')
    
    // Create child subagent sessions referencing parent
    const child1 = ctx.session.createSession('[Trace] Subagent A', undefined, 'tenant_alpha', 'web')
    ;(child1 as any).parentSessionId = parent.id
    ctx.session.saveSession(child1)

    const child2 = ctx.session.createSession('[Trace] Subagent B', undefined, 'tenant_alpha', 'web')
    ;(child2 as any).parentSessionId = parent.id
    ctx.session.saveSession(child2)

    // Unrelated session
    const unrelated = ctx.session.createSession('Unrelated Session', undefined, 'tenant_alpha', 'web')

    assert.ok(ctx.session.getSession(parent.id, 'tenant_alpha'))
    assert.ok(ctx.session.getSession(child1.id, 'tenant_alpha'))
    assert.ok(ctx.session.getSession(child2.id, 'tenant_alpha'))
    assert.ok(ctx.session.getSession(unrelated.id, 'tenant_alpha'))

    // Delete parent
    ctx.session.deleteSession(parent.id, 'tenant_alpha')

    // Parent AND child subagents must be completely deleted
    assert.equal(ctx.session.getSession(parent.id, 'tenant_alpha'), undefined, 'Parent must be deleted')
    assert.equal(ctx.session.getSession(child1.id, 'tenant_alpha'), undefined, 'Child 1 must be cascade deleted')
    assert.equal(ctx.session.getSession(child2.id, 'tenant_alpha'), undefined, 'Child 2 must be cascade deleted')

    // Unrelated session must remain intact
    assert.ok(ctx.session.getSession(unrelated.id, 'tenant_alpha'), 'Unrelated session must survive')
  })

  test('2. Tenant Boundary: User cannot access or delete another tenant session', () => {
    const sessionAlpha = ctx.session.createSession('Alpha Private Data', undefined, 'tenant_alpha', 'web')
    
    // Tenant Beta tries to fetch Alpha session
    const attemptFetch = ctx.session.getSession(sessionAlpha.id, 'tenant_beta')
    assert.equal(attemptFetch, undefined, 'Beta must not read Alpha session')

    // Tenant Beta tries to delete Alpha session
    assert.throws(() => {
      ctx.session.deleteSession(sessionAlpha.id, 'tenant_beta')
    }, /Bu oturumu silme yetkiniz bulunmuyor/)

    // Alpha session must still exist
    assert.ok(ctx.session.getSession(sessionAlpha.id, 'tenant_alpha'))
  })

  test('3. Reflexion Memory: Tenant memories are strictly isolated and purged on reset', async () => {
    if (!ctx.reflexion) return

    // Record reflection for tenant_alpha
    await ctx.reflexion.recordReflection({
      task: 'Alpha financial forecasting and budget analysis',
      reflection: 'Always verify Alpha fiscal year end numbers from CSV',
      error: 'Alpha budget discrepancy'
    }, 'tenant_alpha')

    // Record reflection for tenant_beta
    await ctx.reflexion.recordReflection({
      task: 'Beta drone hardware firmware update',
      reflection: 'Always verify battery voltage before firmware flash',
      error: 'Beta drone bricked'
    }, 'tenant_beta')

    // Verify Alpha only sees Alpha reflections
    const alphaReflections = await ctx.reflexion.getReflections({ userId: 'tenant_alpha' })
    assert.ok(alphaReflections.some(r => r.task.includes('Alpha financial')))
    assert.equal(alphaReflections.some(r => r.task.includes('Beta drone')), false, 'Alpha must NOT see Beta reflections!')

    // Verify Beta only sees Beta reflections
    const betaReflections = await ctx.reflexion.getReflections({ userId: 'tenant_beta' })
    assert.ok(betaReflections.some(r => r.task.includes('Beta drone')))
    assert.equal(betaReflections.some(r => r.task.includes('Alpha financial')), false, 'Beta must NOT see Alpha reflections!')

    // Clear tenant_alpha reflections (Right-to-be-forgotten)
    await ctx.reflexion.clearReflections('tenant_alpha')

    const alphaAfterClear = await ctx.reflexion.getReflections({ userId: 'tenant_alpha' })
    assert.equal(alphaAfterClear.length, 0, 'Alpha reflections must be purged')

    // Beta reflections must still be preserved
    const betaAfterClear = await ctx.reflexion.getReflections({ userId: 'tenant_beta' })
    assert.ok(betaAfterClear.length > 0, 'Beta reflections must remain intact')
  })
})
