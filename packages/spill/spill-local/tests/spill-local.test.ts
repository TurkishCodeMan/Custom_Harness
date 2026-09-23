import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Context } from 'cordis'
import { LocalSpillService } from '../src/index.js'

describe('LocalSpillService (Tool Output Spill)', () => {
  const testSpillRoot = path.join(os.tmpdir(), `test-spill-${Date.now()}`)

  after(() => {
    if (fs.existsSync(testSpillRoot)) {
      fs.rmSync(testSpillRoot, { recursive: true, force: true })
    }
  })

  test('passes through output smaller than threshold unchanged', async () => {
    const ctx = new Context()
    const svc = new LocalSpillService(ctx as any, {
      thresholdChars: 100,
      root: testSpillRoot
    })

    const result = await svc.processOutput('Kısa bir çıktı', 'session-1', 'bash')
    assert.equal(result.spilled, false)
    assert.equal(result.modelText, 'Kısa bir çıktı')
    assert.equal(result.length, 14)
  })

  test('spills oversized output to session file and returns bounded preview with retrieval hint', async () => {
    const ctx = new Context()
    const svc = new LocalSpillService(ctx as any, {
      thresholdChars: 100,
      previewHeadChars: 30,
      previewTailChars: 20,
      root: testSpillRoot
    })

    const bigText = 'HEAD_START_' + 'A'.repeat(200) + '_TAIL_END'
    const result = await svc.processOutput(bigText, 'session-abc', 'read_file')

    assert.equal(result.spilled, true)
    assert.ok(result.spillId)
    assert.ok(result.filePath)
    assert.ok(fs.existsSync(result.filePath!), 'Spill file should physically exist on disk')

    // Verify file content matches original full text
    const savedContent = fs.readFileSync(result.filePath!, 'utf8')
    assert.equal(savedContent, bigText)

    // Verify model-facing text has head, tail and hint
    assert.ok(result.modelText.includes('HEAD_START_'))
    assert.ok(result.modelText.includes('_TAIL_END'))
    assert.ok(result.modelText.includes(result.filePath!))
    assert.ok(result.modelText.includes('read_file'))

    // Verify retrieval via get(id)
    const retrieved = await svc.get(result.spillId!)
    assert.equal(retrieved, bigText)
  })

  test('deleteSessionSpills deletes all spilled files and in-memory entries for that session', async () => {
    const ctx = new Context()
    const svc = new LocalSpillService(ctx as any, {
      thresholdChars: 50,
      root: testSpillRoot
    })

    const bigText = 'LONG_SESSION_SPILL_DATA_'.repeat(10)
    const res1 = await svc.processOutput(bigText, 'session-to-delete', 'bash')
    const res2 = await svc.processOutput(bigText, 'session-to-keep', 'bash')

    assert.ok(fs.existsSync(res1.filePath!))
    assert.ok(fs.existsSync(res2.filePath!))

    // Call deleteSessionSpills
    svc.deleteSessionSpills('session-to-delete')

    // res1 file and directory should be deleted
    assert.equal(fs.existsSync(res1.filePath!), false, 'Spill file should be deleted on session delete')
    assert.equal(await svc.get(res1.spillId!), undefined, 'In-memory entry should be cleared')

    // res2 should remain intact
    assert.equal(fs.existsSync(res2.filePath!), true, 'Other sessions should remain untouched')
    assert.ok(await svc.get(res2.spillId!))
  })
})
