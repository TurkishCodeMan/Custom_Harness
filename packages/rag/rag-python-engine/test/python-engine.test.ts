import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Context } from 'cordis'
import { PythonRagEngineService } from '../src/index.js'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

describe('PythonRagEngineService', () => {
  let ctx: Context
  let engine: PythonRagEngineService
  let tempFilePath: string

  beforeAll(async () => {
    ctx = new Context()
    engine = new PythonRagEngineService(ctx)

    tempFilePath = path.join(os.tmpdir(), `test_doc_${Date.now()}.txt`)
    await fsp.writeFile(tempFilePath, 'Custom Harness 7TB Enterprise RAG Python Engine Test', 'utf8')
  })

  afterAll(async () => {
    engine.stopAllWorkers()
    await fsp.unlink(tempFilePath).catch(() => {})
  })


  it('should parse a text document via Python worker IPC', async () => {
    const res = await engine.parseDocument(tempFilePath, 5000)
    expect(res).toBeDefined()
    expect(res.success).toBe(true)
    expect(res.type).toBe('text')
    expect(res.content).toContain('Custom Harness 7TB Enterprise RAG')
  })
})
