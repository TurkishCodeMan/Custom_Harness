import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import { RepeatToolGuardService } from '../src/index.js'

function createGuard() {
  const ctx = new Context()
  return new RepeatToolGuardService(ctx)
}

describe('RepeatToolGuardService (Sliding Window & Hashing)', () => {
  test('consecutive identical calls trigger advisory on 3rd and block on 4th', () => {
    const guard = createGuard()
    const sid = 'sess_consecutive'

    // Call 1 & 2: normal
    assert.equal(guard.inspectCall(sid, 'read_file', { path: 'a.txt' }).isLooping, false)
    assert.equal(guard.inspectCall(sid, 'read_file', { path: 'a.txt' }).isLooping, false)

    // Call 3: Advisory
    const res3 = guard.inspectCall(sid, 'read_file', { path: 'a.txt' })
    assert.equal(res3.isLooping, true)
    assert.equal(res3.shouldBlock, undefined)
    assert.match(res3.reminder || '', /3rd consecutive time/)

    // Call 4: Blocked
    const res4 = guard.inspectCall(sid, 'read_file', { path: 'a.txt' })
    assert.equal(res4.isLooping, true)
    assert.equal(res4.shouldBlock, true)
    assert.match(res4.reminder || '', /LOOP BLOCKED/)
  })

  test('alternating cycle A -> B -> A -> B is detected', () => {
    const guard = createGuard()
    const sid = 'sess_cycle'

    // Step 1: A, B, A
    assert.equal(guard.inspectCall(sid, 'read_file', { path: 'fileA' }).isLooping, false)
    assert.equal(guard.inspectCall(sid, 'read_file', { path: 'fileB' }).isLooping, false)
    assert.equal(guard.inspectCall(sid, 'read_file', { path: 'fileA' }).isLooping, false)

    // Step 2: B completes 2 full cycles (A, B, A, B) -> triggers cycle advisory
    const resCycle = guard.inspectCall(sid, 'read_file', { path: 'fileB' })
    assert.equal(resCycle.isLooping, true)
    assert.match(resCycle.reminder || '', /Alternating cycle detected/)

    // Continuing cycle (A, B) -> 3rd cycle triggers hard block
    guard.inspectCall(sid, 'read_file', { path: 'fileA' })
    const resBlock = guard.inspectCall(sid, 'read_file', { path: 'fileB' })
    assert.equal(resBlock.isLooping, true)
    assert.equal(resBlock.shouldBlock, true)
    assert.match(resBlock.reminder || '', /Alternating tool execution loop detected/)
  })

  test('reset clears session history', () => {
    const guard = createGuard()
    const sid = 'sess_reset'

    guard.inspectCall(sid, 'bash', { command: 'ls' })
    guard.inspectCall(sid, 'bash', { command: 'ls' })
    guard.inspectCall(sid, 'bash', { command: 'ls' })

    guard.reset(sid)

    // After reset, calling again is treated as fresh call
    const fresh = guard.inspectCall(sid, 'bash', { command: 'ls' })
    assert.equal(fresh.isLooping, false)
  })
})
