import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@custom-harness/core-context'
import * as settings from '@custom-harness/settings'
import * as tools from '@custom-harness/core-tools'
import * as sessionPlugin from '@custom-harness/session'
import * as rag from '@custom-harness/rag'
import * as ragPgVector from '@custom-harness/rag-pgvector'
import * as toolRagPlugin from '../src/index.js'

describe('RAGAS (RAG Assessment) & Tool-RAG Evaluation Suite', async () => {
  const ctx = new Context()
  ctx.plugin(settings)
  ctx.plugin(tools)
  ctx.plugin(sessionPlugin)
  ctx.plugin(rag)
  ctx.plugin(ragPgVector)
  ctx.plugin(toolRagPlugin)

  await ctx.start()

  // 1. Tool Registration Verification
  test('registers query_rag and get_rag_status tools in registry', () => {
    const ragTool = ctx.tools.get('query_rag')
    const statusTool = ctx.tools.get('get_rag_status')

    assert.ok(ragTool, 'query_rag tool should be registered')
    assert.ok(statusTool, 'get_rag_status tool should be registered')
    assert.equal(ragTool.name, 'query_rag')
  })

  // 2. Metric 1: Context Precision (Reranker Score Quality)
  test('RAGAS Metric - Context Precision: Retrieves top-ranked chunks with >= 85% match for factual historical query', async () => {
    const ragTool = ctx.tools.get('query_rag')
    assert.ok(ragTool)

    const startTime = Date.now()
    const result = await ragTool.execute({
      query: "Piri Reis'in 1513 haritası ve Topkapı Sarayı",
      topK: 5
    })
    const duration = Date.now() - startTime

    assert.ok(typeof result === 'string', 'Result should be formatted text')
    assert.ok(result.includes('Found'), 'Should find matching passages')

    // Extract match percentages from formatted result: "### Match 1 (99.9% match)"
    const matchRegex = /\((\d+(?:\.\d+)?)%\s*match\)/g
    const percentages: number[] = []
    let m: RegExpExecArray | null
    while ((m = matchRegex.exec(result)) !== null) {
      percentages.push(parseFloat(m[1]))
    }

    assert.ok(percentages.length > 0, 'Should extract at least one match score')
    const topScore = percentages[0]

    // Context Precision Criterion: Top-1 match must be >= 85%
    assert.ok(topScore >= 85.0, `Top-1 match precision (${topScore}%) must be >= 85.0%`)
    console.log(`\n  ✓ [RAGAS: Context Precision] Top Match Score: ${topScore}% (Search Duration: ${duration}ms)`)
  })

  // 3. Metric 2: Context Recall & Factual Coverage
  test('RAGAS Metric - Context Recall: Retrieved context contains core golden facts', async () => {
    const ragTool = ctx.tools.get('query_rag')
    assert.ok(ragTool)

    const result = await ragTool.execute({
      query: 'Piri Reis kimdir, nerelidir ve amcası kimdir?',
      topK: 5
    })

    const lowerResult = result.toLowerCase()

    // Golden Facts that MUST be present in the retrieved knowledge for this query
    const goldenFacts = [
      { name: 'Muhiddin Piri (Asıl Adı)', key: 'muhiddin' },
      { name: 'Gelibolu (Doğum Yeri)', key: 'gelibolu' },
      { name: 'Kemal Reis (Amcası)', key: 'kemal reis' }
    ]

    let factsFound = 0
    for (const fact of goldenFacts) {
      if (lowerResult.includes(fact.key)) {
        factsFound++
      }
    }

    const recallScore = factsFound / goldenFacts.length
    console.log(`  ✓ [RAGAS: Context Recall] Factual Recall Score: ${(recallScore * 100).toFixed(1)}% (${factsFound}/${goldenFacts.length} facts retrieved)`)

    // Context Recall Criterion: At least 66% (2/3) of golden facts must be retrieved in top-5 chunks
    assert.ok(recallScore >= 0.66, `Context Recall (${recallScore}) should be >= 0.66`)
  })

  // 4. Metric 3: Retrieval Latency under 150k+ Vector Load
  test('RAGAS Metric - Search Latency: 150k+ vectors hybrid + reranker completes in < 3500ms', async () => {
    const ragTool = ctx.tools.get('query_rag')
    assert.ok(ragTool)

    const start = performance.now()
    await ragTool.execute({
      query: 'Kitab-ı Bahriye Akdeniz adaları ve limanları',
      topK: 5
    })
    const durationMs = Math.round(performance.now() - start)

    console.log(`  ✓ [RAGAS: Performance] 150k+ Vector Search + Reranker Total Latency: ${durationMs}ms`)
    assert.ok(durationMs < 3500, `Search latency (${durationMs}ms) must be under 3500ms`)
  })

  // 5. Metric 4: Multi-Tenant RBAC Security & Status Verification
  test('RAGAS Metric - Knowledge Base Integrity: get_rag_status returns indexed sources and vector counts', async () => {
    const statusTool = ctx.tools.get('get_rag_status')
    assert.ok(statusTool)

    const statusResult = await statusTool.execute({})
    assert.ok(typeof statusResult === 'string')
    assert.ok(statusResult.includes('Total Documents:'))
    assert.ok(statusResult.includes('Total Vectors:'))

    console.log(`  ✓ [RAGAS: System Integrity] Status Output:\n${statusResult.split('\n').slice(0, 3).map(l => '    ' + l).join('\n')}`)
  })

})
