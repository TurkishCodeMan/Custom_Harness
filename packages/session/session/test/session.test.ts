import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@custom-harness/core-context'
import * as settings from '@custom-harness/settings'

import * as sessionPlugin from '../src/index.js'

describe('SessionService Client Type Separation (Web vs CLI)', async () => {
  const ctx = new Context()
  ctx.plugin(settings)
  ctx.plugin(sessionPlugin)
  await ctx.start()

  test('creates web and cli sessions with proper clientType tags', () => {
    const webSession = ctx.session.createSession('Test Web Session', undefined, 'user_test', 'web')
    const cliSession = ctx.session.createSession('Test CLI Session', undefined, 'user_test', 'cli')

    assert.equal(webSession.clientType, 'web')
    assert.equal(cliSession.clientType, 'cli')

    // Verify retrieval from memory / disk
    const fetchedWeb = ctx.session.getSession(webSession.id, 'user_test')
    const fetchedCli = ctx.session.getSession(cliSession.id, 'user_test')

    assert.equal(fetchedWeb?.clientType, 'web')
    assert.equal(fetchedCli?.clientType, 'cli')
  })

  test('filters sessions correctly by clientType: web', () => {
    const webList = ctx.session.listSessions('user_test', true, 'web')
    
    // All items in webList must have clientType 'web'
    assert.ok(webList.length > 0)
    for (const item of webList) {
      assert.equal(item.clientType, 'web')
    }
  })

  test('filters sessions correctly by clientType: cli', () => {
    const cliList = ctx.session.listSessions('user_test', true, 'cli')
    
    // All items in cliList must have clientType 'cli'
    assert.ok(cliList.length > 0)
    for (const item of cliList) {
      assert.equal(item.clientType, 'cli')
    }
  })

  test('returns all sessions when clientType filter is wildcard (*)', () => {
    const allList = ctx.session.listSessions('user_test', true, '*')
    const clientTypes = new Set(allList.map((s: { clientType?: string }) => s.clientType))

    assert.ok(clientTypes.has('web'))
    assert.ok(clientTypes.has('cli'))
  })

})
