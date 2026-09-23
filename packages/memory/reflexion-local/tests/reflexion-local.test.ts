import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Context } from 'cordis'
import { LocalReflexionService } from '../src/index.js'

describe('LocalReflexionService (Provider & Episodic Memory)', () => {
  const tmpDir = path.join(os.tmpdir(), `dsh_test_refl_${Date.now()}`)
  const storagePath = path.join(tmpDir, 'test_reflections.json')

  test('records reflections and persists to disk JSON', async () => {
    const ctx = new Context()
    const service = new LocalReflexionService(ctx as any, storagePath)

    const entry = await service.recordReflection({
      task: 'Build Three.js portfolio with Vite',
      workspace: '/home/user/portfolio',
      error: 'ENOSPC: file watchers limit reached',
      reflection: 'Enable server.watch.usePolling: true in vite.config.ts on Linux systems.',
      tags: ['vite', 'three', 'enospc']
    })

    assert.ok(entry.id.startsWith('refl_'))
    assert.equal(entry.task, 'Build Three.js portfolio with Vite')

    // Verify disk file exists and contains entry
    assert.ok(fs.existsSync(storagePath))
    const raw = fs.readFileSync(storagePath, 'utf8')
    const parsed = JSON.parse(raw)
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].id, entry.id)
    assert.match(parsed[0].reflection, /usePolling: true/)
  })

  test('retrieves relevant reflections matching task keywords', async () => {
    const ctx = new Context()
    const service = new LocalReflexionService(ctx as any, storagePath)

    // Add a second unrelated reflection
    await service.recordReflection({
      task: 'Python OCR pipeline',
      workspace: '/home/user/ocr',
      error: 'GPU OOM on batch size 64',
      reflection: 'Set batch_size to 16 when running SigLIP on 24GB GPUs.',
      tags: ['python', 'ocr', 'gpu']
    })

    // Query for "Vite portfolio build"
    const matchedVite = await service.getReflections({ query: 'Vite build error' })
    assert.ok(matchedVite.length > 0)
    assert.equal(matchedVite[0].task, 'Build Three.js portfolio with Vite')

    // Query for "GPU OCR"
    const matchedOcr = await service.getReflections({ query: 'GPU OCR batch' })
    assert.ok(matchedOcr.length > 0)
    assert.equal(matchedOcr[0].task, 'Python OCR pipeline')
  })

  test('renderPromptSection outputs formatted Markdown for prompt injection', async () => {
    const ctx = new Context()
    const service = new LocalReflexionService(ctx as any, storagePath)

    const section = await service.renderPromptSection('Vite build issue', '/home/user/portfolio')
    assert.ok(section.length > 0)
    assert.match(section, /REFLEXION MEMORY — LESSONS LEARNED FROM PAST FAILURES/)
    assert.match(section, /usePolling: true/)
  })

  test('clearReflections clears both in-memory cache and disk file', async () => {
    const ctx = new Context()
    const service = new LocalReflexionService(ctx as any, storagePath)

    await service.clearReflections()
    const entries = await service.getReflections()
    assert.equal(entries.length, 0)

    const raw = fs.readFileSync(storagePath, 'utf8')
    assert.equal(raw, '[]')

    // Clean up temporary directory
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  })
})
