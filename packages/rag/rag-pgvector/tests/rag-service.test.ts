import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { Context } from 'cordis'
import { PgVectorRagService } from '../src/index.js'

describe('PgVectorRagService — Comprehensive Unit & Integration Tests', () => {
  let ctx: Context
  let rag: PgVectorRagService
  let tempDir: string
  let testSourceId: string | null = null
  let privateSourceId: string | null = null

  before(async () => {
    ctx = new Context()
    rag = new PgVectorRagService(ctx as any)
    await rag.initialize()

    // Create a dedicated temporary directory for test indexing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-test-suite-'))
  })

  after(async () => {
    // Cleanup temporary files and test sources
    if (testSourceId) {
      await rag.removeFolder(testSourceId).catch(() => {})
    }
    if (privateSourceId) {
      await rag.removeFolder(privateSourceId).catch(() => {})
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
    await rag.close().catch(() => {})
  })

  test('1. Status check returns active database state', async () => {
    const status = await rag.getStatus('user_admin', true)
    assert.ok(status, 'Status object should exist')
    assert.equal(typeof status.totalChunksCount, 'number')
    assert.equal(typeof status.totalDocumentsCount, 'number')
    assert.ok(Array.isArray(status.sources), 'Sources should be an array')
  })

  test('2. Binary & OS file protection: .DS_Store and binary files are rejected', async () => {
    const dsStorePath = path.join(tempDir, '.DS_Store')
    await fs.writeFile(dsStorePath, Buffer.from([0x00, 0x00, 0x00, 0x01, 0x42, 0x75, 0x64, 0x31]))

    const binFilePath = path.join(tempDir, 'dummy.bin')
    await fs.writeFile(binFilePath, Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]))

    // Simulated unparsable PDF containing raw binary bytes without text
    const fakePdfPath = path.join(tempDir, 'corrupt_scan.pdf')
    await fs.writeFile(fakePdfPath, Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\nstream\n\x00\x01\x02\x03\xff\xfe\x00\x00endstream'))

    // Run processSingleFile directly
    const dsStoreChunks = await (rag as any).processSingleFile({
      filePath: dsStorePath,
      sourceId: 'test_src_binary',
      resolvedPath: tempDir
    })
    assert.equal(dsStoreChunks, 0, '.DS_Store must be ignored and store 0 chunks')

    const binChunks = await (rag as any).processSingleFile({
      filePath: binFilePath,
      sourceId: 'test_src_binary',
      resolvedPath: tempDir
    })
    assert.equal(binChunks, 0, '.bin files must not be processed and store 0 chunks')

    const pdfChunks = await (rag as any).processSingleFile({
      filePath: fakePdfPath,
      sourceId: 'test_src_binary',
      resolvedPath: tempDir
    })
    assert.equal(pdfChunks, 0, 'Unparsable binary PDF must NOT fall back to raw utf8 and must store 0 chunks')
  })

  test('3. Valid text document indexing and chunking', async () => {
    const backendDir = path.join(tempDir, 'backend')
    const frontendDir = path.join(tempDir, 'frontend')
    await fs.mkdir(backendDir, { recursive: true })
    await fs.mkdir(frontendDir, { recursive: true })

    const backendFile = path.join(backendDir, 'database.ts')
    await fs.writeFile(backendFile, [
      '// PostgreSQL pgvector Connection Manager',
      'export class PgVectorDatabase {',
      '  async connect() { return new Pool({ host: "localhost", port: 15432 }) }',
      '  async query(sql: string) { return this.pool.query(sql) }',
      '}'
    ].join('\n'), 'utf-8')

    const frontendFile = path.join(frontendDir, 'App.tsx')
    await fs.writeFile(frontendFile, [
      'import React from "react"',
      'export function App() {',
      '  return <div className="app-container"><h1>ArtificaX Agent Dashboard</h1></div>',
      '}'
    ].join('\n'), 'utf-8')

    // Add and index folder
    const source = await rag.addAndIndexFolder(tempDir, {
      chunkSize: 500,
      chunkOverlap: 50,
      usePythonEngine: false
    }, 'user_admin')

    assert.ok(source, 'Source should be returned')
    assert.ok(source.id, 'Source should have an id')
    testSourceId = source.id

    assert.ok(source.chunkCount >= 2, `Should index at least 2 chunks, got: ${source.chunkCount}`)
  })

  test('4. Semantic search retrieves indexed text and excludes binary noise', async () => {
    const results = await rag.search({
      query: 'PostgreSQL pgvector connection pool',
      topK: 3
    }, 'user_admin', true)

    assert.ok(Array.isArray(results), 'Search results should be an array')
    assert.ok(results.length > 0, 'Should return at least 1 matching passage')

    const match = results[0]
    assert.ok(match.content, 'Match should contain text content')
    assert.ok(match.content.includes('PgVectorDatabase') || match.content.includes('PostgreSQL'), 'Match content should include expected keywords')
    assert.ok(!match.content.includes('\x00'), 'Match content must not contain null bytes')
    assert.ok(typeof match.similarity === 'number', 'Similarity should be numeric')
  })

  test('5. Path prefix filtering narrows down search scope', async () => {
    // Filter specifically for "backend" subfolder
    const backendResults = await rag.search({
      query: 'database query connection',
      filePathPrefix: 'backend',
      topK: 5
    }, 'user_admin', true)

    assert.ok(backendResults.length > 0, 'Should find backend results')
    for (const res of backendResults) {
      assert.ok(
        res.sourcePath?.includes('backend'),
        `Expected path to include "backend", got: ${res.sourcePath}`
      )
    }
  })

  test('6. Multi-Tenancy & Permissions: Private sources restricted to owner/admin', async () => {
    const privateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-private-'))
    const secretFile = path.join(privateDir, 'financial_secrets.txt')
    await fs.writeFile(secretFile, 'Confidential Q3 financial audit report for user_dev only.', 'utf-8')

    // Index as user_dev with isPublic = false
    const privSource = await rag.addAndIndexFolder(privateDir, { usePythonEngine: false }, 'user_dev')
    privateSourceId = privSource.id
    await rag.updateSourcePermissions(privSource.id, ['user_dev'], false)

    // 1. Another normal user (user_analyst) cannot see or search it
    const analystResults = await rag.search({
      query: 'financial secrets audit report',
      topK: 5
    }, 'user_analyst', false)

    const foundByAnalyst = analystResults.find(r => r.content.includes('financial audit'))
    assert.equal(foundByAnalyst, undefined, 'Private source must NOT be accessible to unauthorized user_analyst')

    // 2. Owner (user_dev) can search and find it
    const ownerResults = await rag.search({
      query: 'financial secrets audit report',
      topK: 5
    }, 'user_dev', false)
    const foundByOwner = ownerResults.find(r => r.content.includes('financial audit'))
    assert.ok(foundByOwner, 'Owner user_dev MUST be able to find private source')

    // 3. Admin (user_admin) can search and find it
    const adminResults = await rag.search({
      query: 'financial secrets audit report',
      topK: 5
    }, 'user_admin', true)
    const foundByAdmin = adminResults.find(r => r.content.includes('financial audit'))
    assert.ok(foundByAdmin, 'Admin MUST be able to find all tenant sources')

    // Cleanup private source dir
    await fs.rm(privateDir, { recursive: true, force: true }).catch(() => {})
  })

  test('7. Incremental Indexing: Unchanged files are skipped on re-index', async () => {
    if (!testSourceId) return

    // Get initial status
    const statusBefore = await rag.getStatus('user_admin', true)
    const srcBefore = statusBefore.sources.find(s => s.id === testSourceId)
    const initialChunks = srcBefore?.chunkCount || 0

    // Re-index the same folder without modifying files
    const sourceReindexed = await rag.addAndIndexFolder(tempDir, {
      skipExistingUnchanged: true,
      usePythonEngine: false
    }, 'user_admin')

    assert.equal(
      sourceReindexed.chunkCount,
      initialChunks,
      'Re-indexing unchanged folder should keep identical chunk count without duplicating'
    )
  })

  test('8. RAG Mode state management: toggle on/off', () => {
    rag.setRagMode(true)
    assert.equal(rag.isRagMode(), true, 'RAG Mode should be enabled')

    rag.setRagMode(false)
    assert.equal(rag.isRagMode(), false, 'RAG Mode should be disabled')
  })

  test('9. Resource Configuration updates (Turbo vs Standard mode)', () => {
    // Switch to Turbo mode
    rag.setResourceConfig({
      indexingMode: 'turbo',
      workerConcurrency: 8,
      chunkSize: 1200
    })

    const turboConfig = rag.getResourceConfig()
    assert.equal(turboConfig.indexingMode, 'turbo')
    assert.equal(turboConfig.workerConcurrency, 8)
    assert.equal(turboConfig.chunkSize, 1200)

    // Switch back to Standard mode
    rag.setResourceConfig({
      indexingMode: 'standard',
      workerConcurrency: 2,
      chunkSize: 1000
    })

    const standardConfig = rag.getResourceConfig()
    assert.equal(standardConfig.indexingMode, 'standard')
    assert.equal(standardConfig.workerConcurrency, 2)
    assert.equal(standardConfig.chunkSize, 1000)
  })

  test('10. Source removal cascades and deletes all related chunks', async () => {
    if (testSourceId) {
      await rag.removeFolder(testSourceId)

      const status = await rag.getStatus('user_admin', true)
      const found = status.sources.find(s => s.id === testSourceId)
      assert.equal(found, undefined, 'Deleted source should no longer exist in status')
      testSourceId = null
    }

    if (privateSourceId) {
      await rag.removeFolder(privateSourceId)
      privateSourceId = null
    }
  })
})
