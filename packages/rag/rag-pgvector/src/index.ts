import type { Context } from '@custom-harness/core-context'
import {
  RagService,
  type DocumentChunk,
  type RagSearchQuery,
  type RagResourceConfig,
  type RagSourceFolder,
  type RagStatus,
  type ImageSearchResult,
  type ImageSearchQuery,
  type IndexingProgress
} from '@custom-harness/rag'
import { VllmEmbeddingClient, VllmVisionOcrClient, TextSplitter, PdfExtractor, SigLipClient, VllmRerankerClient } from '@custom-harness/rag-vllm'
import { PgVectorDatabase } from './db.js'
import { RagIndexingQueue, type IndexJob } from './queue.js'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

export const name = 'rag-pgvector'

export class PgVectorRagService extends RagService {
  private db: PgVectorDatabase
  private embeddingClient: VllmEmbeddingClient
  private visionClient: VllmVisionOcrClient
  private siglipClient: SigLipClient
  private rerankerClient: VllmRerankerClient
  private splitter: TextSplitter
  private queue: RagIndexingQueue
  private ragModeActive = false
  private activeIndexingJobs = 0

  private resourceConfig: RagResourceConfig = {
    batchSize: 64,
    concurrency: 4,
    workerConcurrency: 8,
    indexingMode: 'turbo',
    chunkSize: 1000,
    chunkOverlap: 150,
    bulkInsertSize: 100,
    throttleDelayMs: 0,
    skipExistingUnchanged: true,
    embeddingModel: process.env.VLLM_EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-0.6B',
    embeddingEndpoint: process.env.VLLM_EMBEDDING_URL || 'http://localhost:8001/v1',
    visionModel: process.env.VLLM_VISION_MODEL || 'zai-org/GLM-OCR',
    visionEndpoint: process.env.VLLM_VISION_URL || 'http://localhost:8010/v1',
    imageSearchEndpoint: process.env.IMAGE_SEARCH_URL || 'http://localhost:8011',
    rerankerEndpoint: process.env.RERANKER_URL || 'http://localhost:8006/v1/rerank',
    rerankerModel: process.env.RERANKER_MODEL || 'Qwen/Qwen3-Reranker-0.6B',
    ocrZoom: 1.4,
    ocrQuality: 85,
    autoThrottling: true,
    usePythonEngine: true
  }


  constructor(ctx: Context) {
    super(ctx)
    this.db = new PgVectorDatabase()
    this.embeddingClient = new VllmEmbeddingClient({
      endpoint: this.resourceConfig.embeddingEndpoint,
      model: this.resourceConfig.embeddingModel,
      batchSize: this.resourceConfig.batchSize
    })
    this.visionClient = new VllmVisionOcrClient({
      endpoint: this.resourceConfig.visionEndpoint,
      model: this.resourceConfig.visionModel,
      apiKey: process.env.VLLM_VISION_API_KEY || 'sk-agent-key'
    })
    this.siglipClient = new SigLipClient({
      endpoint: this.resourceConfig.imageSearchEndpoint
    })
    this.rerankerClient = new VllmRerankerClient({
      endpoint: this.resourceConfig.rerankerEndpoint
    })

    this.splitter = new TextSplitter({
      chunkSize: this.resourceConfig.chunkSize,
      chunkOverlap: this.resourceConfig.chunkOverlap
    })
    this.queue = new RagIndexingQueue({
      concurrency: this.resourceConfig.workerConcurrency || 4
    })
    this.queue.on('progress', (prog: IndexingProgress) => {
      this.ctx.emit('rag/progress' as any, prog)
    })
  }

  public async initialize(config?: any): Promise<void> {
    await this.db.initSchema()
    // Reset any zombie 'indexing' status left over from server restarts to 'idle'
    await this.db.query(`UPDATE rag_sources SET status = 'idle' WHERE status = 'indexing';`).catch(() => {})
  }


  public setRagMode(enabled: boolean): void {
    this.ragModeActive = enabled
  }

  public isRagMode(): boolean {
    return this.ragModeActive
  }

  public getProgress(): IndexingProgress {
    return this.queue.getProgress()
  }

  public async pauseIndexing(): Promise<void> {
    this.queue.pause()
  }

  public async resumeIndexing(): Promise<void> {
    this.queue.resume()
  }

  public async cancelIndexing(): Promise<void> {
    this.queue.cancel()
  }

  public setResourceConfig(config: Partial<RagResourceConfig>): void {
    // Mode Presets
    if (config.indexingMode === 'turbo') {
      config.workerConcurrency = config.workerConcurrency || 8
      config.batchSize = config.batchSize || 128
      config.bulkInsertSize = config.bulkInsertSize || 200
      config.throttleDelayMs = 0
      config.usePythonEngine = true
      if ((this.ctx as any).pythonRagEngine) {
        (this.ctx as any).pythonRagEngine.setPoolSize(8)
      }
    } else if (config.indexingMode === 'standard') {
      config.workerConcurrency = config.workerConcurrency || 2
      config.batchSize = config.batchSize || 32
      config.bulkInsertSize = config.bulkInsertSize || 50
      config.throttleDelayMs = 25
      config.usePythonEngine = true
      if ((this.ctx as any).pythonRagEngine) {
        (this.ctx as any).pythonRagEngine.setPoolSize(2)
      }
    }



    this.resourceConfig = { ...this.resourceConfig, ...config }

    if (this.resourceConfig.workerConcurrency) {
      this.queue.setConcurrency(this.resourceConfig.workerConcurrency)
    }

    this.embeddingClient = new VllmEmbeddingClient({
      endpoint: this.resourceConfig.embeddingEndpoint,
      model: this.resourceConfig.embeddingModel,
      batchSize: this.resourceConfig.batchSize
    })
    this.visionClient = new VllmVisionOcrClient({
      endpoint: this.resourceConfig.visionEndpoint,
      model: this.resourceConfig.visionModel,
      apiKey: process.env.VLLM_VISION_API_KEY || 'sk-agent-key'
    })
    if (this.resourceConfig.imageSearchEndpoint) {
      this.siglipClient.setEndpoint(this.resourceConfig.imageSearchEndpoint)
    }
    if (config.chunkSize || config.chunkOverlap) {
      this.splitter = new TextSplitter({
        chunkSize: this.resourceConfig.chunkSize,
        chunkOverlap: this.resourceConfig.chunkOverlap
      })
    }
  }

  public getResourceConfig(): RagResourceConfig {
    return { ...this.resourceConfig }
  }

  /**
   * Recursively scans, parses, embeds, and indexes a folder or a single file into pgvector.
   */
  public async addAndIndexFolder(folderOrFilePath: string, options?: RagResourceConfig, ownerId?: string): Promise<RagSourceFolder> {
    const resolvedPath = path.resolve(folderOrFilePath)
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File or directory does not exist: ${resolvedPath}`)
    }

    if (options) {
      this.setResourceConfig(options)
    }

    const stat = await fsp.stat(resolvedPath)
    const isSingleFile = stat.isFile()
    const sourceId = `src_${crypto.createHash('md5').update(resolvedPath).digest('hex').slice(0, 10)}`
    const owner = ownerId || 'user_admin'
    
    // Register or update source record
    await this.db.query(`
      INSERT INTO rag_sources (id, path, file_count, chunk_count, last_indexed_at, status, error, owner_id, allowed_user_ids, is_public)
      VALUES ($1, $2, 0, 0, $3, 'indexing', NULL, $4, ARRAY['*'], TRUE)
      ON CONFLICT (path) DO UPDATE SET
        status = 'indexing',
        last_indexed_at = $3,
        error = NULL,
        owner_id = COALESCE(rag_sources.owner_id, $4)
      RETURNING *;
    `, [sourceId, resolvedPath, Date.now(), owner])

    this.activeIndexingJobs++

    try {
      // 1. Discover all files or pick single file
      let files = isSingleFile ? [resolvedPath] : await this.discoverFiles(resolvedPath)
      if (this.resourceConfig.maxFiles && this.resourceConfig.maxFiles > 0) {
        files = files.slice(0, this.resourceConfig.maxFiles)
      }
      const jobs: IndexJob[] = files.map(f => ({ filePath: f, sourceId, resolvedPath }))

      console.log(`[RAG:Queue] Discovered ${files.length} indexable file(s) for "${resolvedPath}" (owner: ${owner}, maxFiles limit: ${this.resourceConfig.maxFiles || 'unlimited'}). Starting worker pool (concurrency: ${this.queue.getConcurrency()})...`)

      this.queue.reset(jobs)
      await this.queue.start(async (job) => {
        return this.processSingleFile(job)
      })

      const progress = this.queue.getProgress()

      // Mark source as completed
      const res = await this.db.query(`
        UPDATE rag_sources
        SET file_count = $1, chunk_count = $2, status = 'idle', error = NULL
        WHERE id = $3
        RETURNING *;
      `, [progress.processedFiles, progress.totalChunks, sourceId])

      const row = res.rows[0]
      return {
        id: row.id,
        path: row.path,
        fileCount: Number(row.file_count),
        chunkCount: Number(row.chunk_count),
        lastIndexedAt: Number(row.last_indexed_at),
        status: 'idle',
        ownerId: row.owner_id,
        allowedUserIds: row.allowed_user_ids || ['*'],
        isPublic: row.is_public !== false
      }
    } catch (err: any) {
      await this.db.query(`
        UPDATE rag_sources
        SET status = 'error', error = $1
        WHERE id = $2;
      `, [err.message, sourceId])
      throw err
    } finally {
      this.activeIndexingJobs = Math.max(0, this.activeIndexingJobs - 1)
    }
  }

  public async updateSourcePermissions(sourceId: string, allowedUserIds: string[], isPublic = true): Promise<void> {
    await this.db.query(`
      UPDATE rag_sources
      SET allowed_user_ids = $1, is_public = $2
      WHERE id = $3 OR path = $3;
    `, [allowedUserIds, isPublic, sourceId])
  }

  /**
   * Processes a single file: extracts OCR/text, creates SigLIP/Qwen embeddings, and bulk inserts to DB.
   */
  private async processSingleFile(job: IndexJob): Promise<number> {
    const { filePath, sourceId } = job
    const ext = path.extname(filePath).toLowerCase()
    let fileContent = ''
    const docId = `doc_${crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12)}`
    let chunksStored = 0

    const imageExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp'])
    const textExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.py', '.md', '.txt', '.yaml', '.yml', '.html', '.css', '.scss', '.sh', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.sql', '.toml', '.xml'])

    try {
      let siglipVector: number[] | null = null

      const heavyExts = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.pptx', '.ppt'])
      const pyEngine = (this.ctx as any).pythonRagEngine

      // 1. High-speed C++/Python Engine for heavy formats (PyMuPDF, docx, openpyxl, scanned multi-page OCR)
      if (heavyExts.has(ext) && pyEngine && this.resourceConfig.usePythonEngine !== false) {
        try {
          const pyRes = await pyEngine.parseDocument(filePath, 1200000)
          if (pyRes && pyRes.success && pyRes.content && pyRes.content.trim().length > 0) {
            fileContent = pyRes.content
          }
        } catch (pyErr: any) {
          console.warn(`[RAG:PythonEngine] Fast parsing fallback for "${filePath}":`, pyErr.message)
        }
      }


      // 3. JavaScript / Node.js fallback parser for other types
      if (!fileContent) {
        if (imageExts.has(ext)) {
          fileContent = await this.visionClient.extractTextFromImage(filePath)
          try {
            siglipVector = await this.siglipClient.extractImageEmbedding(filePath)
          } catch (siglipErr: any) {
            console.warn(`[RAG:SigLIP] SigLIP embedding extraction skipped:`, siglipErr.message)
          }
        } else if (textExts.has(ext) || ext === '') {
          fileContent = await fsp.readFile(filePath, 'utf-8')
        } else {
          fileContent = await fsp.readFile(filePath, 'utf-8').catch(() => '')
        }
      }



      if (!fileContent || fileContent.trim().length === 0) return 0

      // Sanitize null bytes (\x00 / \0) to prevent PostgreSQL "invalid byte sequence for encoding UTF8: 0x00" error
      fileContent = fileContent.replace(/\0/g, '')
      if (fileContent.trim().length === 0) return 0

      const docHash = crypto.createHash('sha256').update(fileContent).digest('hex')


      // Skip unchanged files
      if (this.resourceConfig.skipExistingUnchanged !== false) {
        const existing = await this.db.query(`SELECT content_hash FROM rag_documents WHERE id = $1;`, [docId]).catch(() => ({ rows: [] }))
        if (existing.rows[0]?.content_hash === docHash) {
          const countRes = await this.db.query(`SELECT COUNT(*) AS c FROM rag_chunks WHERE document_id = $1;`, [docId]).catch(() => ({ rows: [{ c: 0 }] }))
          return Number(countRes.rows[0]?.c || 0)
        }
      }

      // 1. Upsert Document
      await this.db.query(`
        INSERT INTO rag_documents (id, source_id, file_path, file_type, last_modified, content_hash)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          last_modified = $5,
          content_hash = $6;
      `, [docId, sourceId, filePath, ext, Date.now(), docHash])

      // 2. Upsert SigLIP Image Record
      if (siglipVector && siglipVector.length === 768) {
        const imgId = `img_${crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12)}`
        const vectorStr = `[${siglipVector.join(',')}]`
        await this.db.query(`
          INSERT INTO rag_images (id, document_id, file_path, ocr_text, embedding, created_at)
          VALUES ($1, $2, $3, $4, $5::vector, $6)
          ON CONFLICT (file_path) DO UPDATE SET
            ocr_text = EXCLUDED.ocr_text,
            embedding = EXCLUDED.embedding,
            created_at = EXCLUDED.created_at;
        `, [imgId, docId, filePath, fileContent, vectorStr, Date.now()])
      }

      // Delete existing chunks if re-indexing
      await this.db.query(`DELETE FROM rag_chunks WHERE document_id = $1;`, [docId])

      // 3. Chunk text
      const chunks = this.splitter.splitText(fileContent, filePath)
      if (chunks.length === 0) return 0

      // 4. Generate embeddings
      const embeddings = await this.embeddingClient.getEmbeddings(chunks)

      // 5. Store chunks using Multi-Row Bulk Insert
      const bulkSize = this.resourceConfig.bulkInsertSize || 50
      for (let i = 0; i < chunks.length; i += bulkSize) {
        const chunkBatch = chunks.slice(i, i + bulkSize)
        const embeddingBatch = embeddings.slice(i, i + bulkSize)
        const valuesSql: string[] = []
        const params: any[] = []
        let pIdx = 1

        for (let j = 0; j < chunkBatch.length; j++) {
          const cIdx = i + j
          const chunkText = chunkBatch[j].replace(/\0/g, '')
          const vector = embeddingBatch[j]
          const chunkId = `chk_${docId}_${cIdx}`
          const vectorStr = vector ? `[${vector.join(',')}]` : null


          valuesSql.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}::vector)`)
          params.push(
            chunkId,
            docId,
            filePath,
            cIdx,
            chunkText,
            JSON.stringify({ filePath, ext, lineApprox: cIdx * 30 }),
            vectorStr
          )
          pIdx += 7
          chunksStored++
        }

        if (valuesSql.length > 0) {
          await this.db.query(`
            INSERT INTO rag_chunks (id, document_id, source_path, chunk_index, content, metadata, embedding)
            VALUES ${valuesSql.join(', ')};
          `, params)
        }
      }

      // 6. Optional Throttling delay
      if (this.resourceConfig.throttleDelayMs && this.resourceConfig.throttleDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.resourceConfig.throttleDelayMs))
      }

      return chunksStored
    } catch (fileErr: any) {
      console.warn(`[RAG:Worker] Skipping file ${filePath}:`, fileErr.message)
      return 0
    }
  }

  /**
   * Performs Enterprise Hybrid RAG Search (Dense HNSW Vector + Lexical BM25 Full-Text + Reciprocal Rank Fusion).
   */
  public async search(query: RagSearchQuery, userId?: string, isAdmin = false): Promise<DocumentChunk[]> {
    const topK = query.topK || 5
    const minSim = query.minSimilarity || 0.3
    const candidateLimit = Math.max(topK * 3, 15)
    const pathFilter = query.filePathPrefix ? `${query.filePathPrefix}%` : null
    const uid = userId || query.tenantId

    // 1. Generate query embedding via vLLM
    const [queryVector] = await this.embeddingClient.getEmbeddings([query.query])
    if (!queryVector) {
      throw new Error('Failed to generate embedding for query.')
    }

    const vectorStr = `[${queryVector.join(',')}]`

    // Build permission filter clause for non-admin callers
    let permClause = ''
    let permParam: any = null
    if (!isAdmin && uid) {
      permClause = `AND EXISTS (
        SELECT 1 FROM rag_sources s 
        WHERE rag_chunks.source_path LIKE s.path || '%' 
          AND (s.owner_id = $4 OR s.is_public = TRUE OR $4 = ANY(s.allowed_user_ids) OR '*' = ANY(s.allowed_user_ids))
      )`
      permParam = uid
    }

    // 2. Parallel Execution: Dense Vector Search (HNSW) + Sparse Lexical Search (BM25)
    const densePromise = this.db.query(`
      SELECT 
        id, 
        document_id AS "documentId", 
        source_path AS "sourcePath", 
        chunk_index AS "chunkIndex", 
        content, 
        metadata,
        1 - (embedding <=> $1::vector) AS similarity
      FROM rag_chunks
      WHERE ($2::text IS NULL OR source_path LIKE $2)
        ${permClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $3;
    `, permParam ? [vectorStr, pathFilter, candidateLimit, permParam] : [vectorStr, pathFilter, candidateLimit]).catch(() => ({ rows: [] }))

    const lexicalPromise = this.db.query(`
      SELECT 
        id, 
        document_id AS "documentId", 
        source_path AS "sourcePath", 
        chunk_index AS "chunkIndex", 
        content, 
        metadata,
        ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', $1)) AS text_rank
      FROM rag_chunks
      WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', $1)
        AND ($2::text IS NULL OR source_path LIKE $2)
        ${permClause}
      ORDER BY text_rank DESC
      LIMIT $3;
    `, permParam ? [query.query, pathFilter, candidateLimit, permParam] : [query.query, pathFilter, candidateLimit]).catch(() => ({ rows: [] }))

    const [denseRes, lexicalRes] = await Promise.all([densePromise, lexicalPromise])

    // 3. Reciprocal Rank Fusion (RRF) Blending
    const rrfMap = new Map<string, { chunk: DocumentChunk; rrfScore: number; isKeywordMatch: boolean }>()
    const kRRF = 60 // Standard RRF smoothing constant

    // Process Dense Rankings
    denseRes.rows.forEach((r: any, rank: number) => {
      const sim = parseFloat(r.similarity) || 0
      const chunk: DocumentChunk = {
        id: r.id,
        documentId: r.documentId,
        sourcePath: r.sourcePath,
        chunkIndex: r.chunkIndex,
        content: r.content,
        metadata: r.metadata,
        similarity: sim
      }
      const score = 0.6 / (kRRF + rank + 1)
      rrfMap.set(r.id, { chunk, rrfScore: score, isKeywordMatch: false })
    })

    // Process Lexical / BM25 Rankings
    lexicalRes.rows.forEach((r: any, rank: number) => {
      const score = 0.4 / (kRRF + rank + 1)
      if (rrfMap.has(r.id)) {
        const existing = rrfMap.get(r.id)!
        existing.rrfScore += score
        existing.isKeywordMatch = true
        // Boost similarity slightly for exact keyword hit
        if (existing.chunk.similarity !== undefined) {
          existing.chunk.similarity = Math.min(0.99, existing.chunk.similarity + 0.15)
        }
      } else {
        const chunk: DocumentChunk = {
          id: r.id,
          documentId: r.documentId,
          sourcePath: r.sourcePath,
          chunkIndex: r.chunkIndex,
          content: r.content,
          metadata: r.metadata,
          similarity: 0.70 // High confidence for exact lexical keyword hit
        }
        rrfMap.set(r.id, { chunk, rrfScore: score, isKeywordMatch: true })
      }
    })

    // 4. Sort candidates by blended RRF score (Take top candidates for neural reranking)
    const candidateEntries = Array.from(rrfMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, Math.max(topK * 3, 15))
      .filter(entry => (entry.chunk.similarity ?? 0) >= minSim)

    const candidates = candidateEntries.map(e => e.chunk)
    if (candidates.length === 0) return []

    // 5. Neural Re-ranking via Qwen3-Reranker (Port 8006 / Cross-Encoder Accuracy)
    try {
      const docTexts = candidates.map(c => c.content)
      const reranked = await this.rerankerClient.rerank(query.query, docTexts, topK)
      if (reranked && reranked.length > 0) {
        const finalResults: DocumentChunk[] = []
        for (const item of reranked) {
          const originalChunk = candidates[item.index]
          if (originalChunk) {
            finalResults.push({
              ...originalChunk,
              similarity: item.relevanceScore
            })
          }
        }
        if (finalResults.length > 0) {
          return finalResults.slice(0, topK)
        }
      }
    } catch (rerankErr: any) {
      console.warn('[RAG:Search] Reranker fallback to RRF rankings:', rerankErr.message)
    }

    return candidates.slice(0, topK)
  }


  /**
   * Performs semantic visual search directly against our own custom pgvector database (rag_images table).
   * Supports both English visual concepts (SigLIP) and multilingual/Turkish terms (GLM-OCR + Qwen3).
   */
  public async searchImages(query: ImageSearchQuery, userId?: string, isAdmin = false): Promise<ImageSearchResult[]> {
    const topK = query.topK || 6
    const resultMap = new Map<string, ImageSearchResult>()
    const targetUserId = userId || 'user_admin'

    // 1. SigLIP Visual Feature Extraction & Custom PostgreSQL pgvector Search
    if (query.imagePath && fs.existsSync(query.imagePath)) {
      try {
        const siglipVector = await this.siglipClient.extractImageEmbedding(query.imagePath)
        if (siglipVector && siglipVector.length === 768) {
          const vectorStr = `[${siglipVector.join(',')}]`
          const sql = `
            SELECT 
              i.file_path AS "filePath",
              i.ocr_text AS "ocrText",
              1 - (i.embedding <=> $1::vector) AS similarity
            FROM rag_images i
            LEFT JOIN rag_documents d ON i.document_id = d.id
            LEFT JOIN rag_sources s ON d.source_id = s.id
            WHERE ($3::boolean = TRUE OR s.owner_id = $4 OR s.is_public = TRUE OR $4 = ANY(s.allowed_user_ids) OR s.id IS NULL)
            ORDER BY i.embedding <=> $1::vector
            LIMIT $2;
          `
          const res = await this.db.query(sql, [vectorStr, topK, isAdmin, targetUserId])
          for (const r of res.rows) {
            const sim = parseFloat(r.similarity)
            const existing = resultMap.get(r.filePath)
            if (!existing || sim > (existing.similarity || 0)) {
              resultMap.set(r.filePath, {
                filePath: r.filePath,
                ocrText: r.ocrText,
                similarity: isNaN(sim) ? 0 : sim
              })
            }
          }
        }
      } catch (err: any) {
        console.warn('[RAG:SigLIP] Image embedding extraction notice:', err.message)
      }
    }

    // 2. SigLIP Text Embedding Extraction & Custom PostgreSQL pgvector Search
    if (query.textQuery && query.textQuery.trim()) {
      const q = query.textQuery.trim()

      try {
        const siglipVector = await this.siglipClient.extractTextEmbedding(q)
        if (siglipVector && siglipVector.length === 768) {
          const vectorStr = `[${siglipVector.join(',')}]`
          const sql = `
            SELECT 
              i.file_path AS "filePath",
              i.ocr_text AS "ocrText",
              1 - (i.embedding <=> $1::vector) AS similarity
            FROM rag_images i
            LEFT JOIN rag_documents d ON i.document_id = d.id
            LEFT JOIN rag_sources s ON d.source_id = s.id
            WHERE ($3::boolean = TRUE OR s.owner_id = $4 OR s.is_public = TRUE OR $4 = ANY(s.allowed_user_ids) OR s.id IS NULL)
            ORDER BY i.embedding <=> $1::vector
            LIMIT $2;
          `
          const res = await this.db.query(sql, [vectorStr, topK, isAdmin, targetUserId])
          for (const r of res.rows) {
            const sim = parseFloat(r.similarity)
            const existing = resultMap.get(r.filePath)
            if (!existing || sim > (existing.similarity || 0)) {
              resultMap.set(r.filePath, {
                filePath: r.filePath,
                ocrText: r.ocrText,
                similarity: isNaN(sim) ? 0 : sim
              })
            }
          }
        }
      } catch (err: any) {
        console.warn('[RAG:SigLIP] SigLIP text vector search notice:', err.message)
      }

      // 3. Multilingual / Turkish OCR Text Search via Qwen3 (Port 8001) against custom PostgreSQL
      try {
        const [qwenVector] = await this.embeddingClient.getEmbeddings([q])
        if (qwenVector) {
          const vectorStr = `[${qwenVector.join(',')}]`
          const sql = `
            SELECT 
              d.file_path AS "filePath",
              c.content AS "ocrText",
              1 - (c.embedding <=> $1::vector) AS similarity
            FROM rag_chunks c
            JOIN rag_documents d ON c.document_id = d.id
            LEFT JOIN rag_sources s ON d.source_id = s.id
            WHERE d.file_type IN ('.png', '.jpg', '.jpeg', '.webp', '.bmp')
              AND ($3::boolean = TRUE OR s.owner_id = $4 OR s.is_public = TRUE OR $4 = ANY(s.allowed_user_ids))
            ORDER BY c.embedding <=> $1::vector
            LIMIT $2;
          `
          const res = await this.db.query(sql, [vectorStr, topK, isAdmin, targetUserId])
          for (const r of res.rows) {
            const sim = parseFloat(r.similarity)
            const existing = resultMap.get(r.filePath)
            if (!existing || sim > (existing.similarity || 0)) {
              resultMap.set(r.filePath, {
                filePath: r.filePath,
                ocrText: r.ocrText,
                similarity: isNaN(sim) ? 0 : sim
              })
            }
          }
        }
      } catch (err: any) {
        console.warn('[RAG:OCR] Multilingual search notice:', err.message)
      }

      // 4. Lexical / Keyword ILIKE fallback in custom PostgreSQL
      if (resultMap.size < topK) {
        try {
          const keywords = q.split(/\s+/).filter(k => k.length > 2)
          for (const kw of keywords.slice(0, 3)) {
            const kwParam = `%${kw}%`
            const lexSql = `
              SELECT 
                i.file_path AS "filePath",
                i.ocr_text AS "ocrText",
                0.75 AS similarity
              FROM rag_images i
              LEFT JOIN rag_documents d ON i.document_id = d.id
              LEFT JOIN rag_sources s ON d.source_id = s.id
              WHERE (i.ocr_text ILIKE $1 OR i.file_path ILIKE $1)
                AND ($3::boolean = TRUE OR s.owner_id = $4 OR s.is_public = TRUE OR $4 = ANY(s.allowed_user_ids) OR s.id IS NULL)
              LIMIT $2;
            `
            const lexRes = await this.db.query(lexSql, [kwParam, topK, isAdmin, targetUserId])
            for (const r of lexRes.rows) {
              if (!resultMap.has(r.filePath)) {
                resultMap.set(r.filePath, {
                  filePath: r.filePath,
                  ocrText: r.ocrText,
                  similarity: 0.75
                })
              }
            }
          }
        } catch (e: any) {}
      }
    }

    // Sort combined results by similarity descending
    return Array.from(resultMap.values())
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, topK)
  }

  public async removeFolder(sourceIdOrPath: string): Promise<void> {
    // If this source is currently being indexed in the queue, cancel and reset the queue immediately
    this.queue.cancel()

    await this.db.query(`
      DELETE FROM rag_sources WHERE id = $1 OR path = $1;
    `, [sourceIdOrPath])
  }

  public async clearAll(): Promise<void> {
    this.queue.cancel()
    await this.db.query(`TRUNCATE TABLE rag_chunks, rag_documents, rag_sources CASCADE;`)
  }


  public async getStatus(userId?: string, isAdmin = false): Promise<RagStatus> {
    let sourcesSql = `SELECT * FROM rag_sources ORDER BY last_indexed_at DESC;`
    let sourcesParams: any[] = []

    if (!isAdmin && userId) {
      sourcesSql = `
        SELECT * FROM rag_sources 
        WHERE owner_id = $1 OR is_public = TRUE OR $1 = ANY(allowed_user_ids) OR '*' = ANY(allowed_user_ids)
        ORDER BY last_indexed_at DESC;
      `
      sourcesParams = [userId]
    }

    const sourcesRes = await this.db.query(sourcesSql, sourcesParams).catch(() => ({ rows: [] }))
    
    let countsRes: { rows: any[] }
    if (!isAdmin && userId) {
      countsRes = await this.db.query(`
        SELECT 
          (SELECT COUNT(*) FROM rag_documents d 
           JOIN rag_sources s ON d.source_id = s.id 
           WHERE s.owner_id = $1 OR s.is_public = TRUE OR $1 = ANY(s.allowed_user_ids) OR '*' = ANY(s.allowed_user_ids)) AS doc_count,
          (SELECT COUNT(*) FROM rag_chunks c 
           JOIN rag_sources s ON c.source_path LIKE s.path || '%'
           WHERE s.owner_id = $1 OR s.is_public = TRUE OR $1 = ANY(s.allowed_user_ids) OR '*' = ANY(s.allowed_user_ids)) AS chunk_count;
      `, [userId]).catch(() => ({ rows: [{ doc_count: 0, chunk_count: 0 }] }))
    } else {
      countsRes = await this.db.query(`
        SELECT 
          (SELECT COUNT(*) FROM rag_documents) AS doc_count,
          (SELECT COUNT(*) FROM rag_chunks) AS chunk_count;
      `).catch(() => ({ rows: [{ doc_count: 0, chunk_count: 0 }] }))
    }

    const sources: RagSourceFolder[] = sourcesRes.rows.map(r => ({
      id: r.id,
      path: r.path,
      fileCount: Number(r.file_count || 0),
      chunkCount: Number(r.chunk_count || 0),
      lastIndexedAt: Number(r.last_indexed_at || 0),
      status: (this.queue.isBusy() || this.activeIndexingJobs > 0) ? r.status : (r.status === 'indexing' ? 'idle' : r.status),
      error: r.error,
      ownerId: r.owner_id,

      allowedUserIds: r.allowed_user_ids || ['*'],
      isPublic: r.is_public !== false
    }))

    return {
      isIndexing: this.queue.isBusy() || this.activeIndexingJobs > 0,
      sources,
      totalDocumentsCount: Number(countsRes.rows[0]?.doc_count || 0),
      totalChunksCount: Number(countsRes.rows[0]?.chunk_count || 0),
      ragModeActive: this.ragModeActive,
      resourceConfig: this.resourceConfig,
      progress: this.queue.getProgress(),
      resourceUsage: {
        activeJobs: this.activeIndexingJobs
      }
    }
  }

  /**
   * Memory-safe streaming file generator for multi-terabyte datasets.
   * Traverses directory hierarchies using `fs.opendir` without loading all files into RAM.
   */
  public async *discoverFilesStream(dir: string): AsyncGenerator<string> {
    const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.cache', 'coverage', '.turbo', '.system_generated'])
    const stack: string[] = [dir]

    while (stack.length > 0) {
      const currentDir = stack.pop()!
      let dirHandle: fs.Dir | null = null

      try {
        dirHandle = await fsp.opendir(currentDir)
        for await (const dirent of dirHandle) {
          const fullPath = path.join(currentDir, dirent.name)
          if (dirent.isDirectory()) {
            if (!ignoredDirs.has(dirent.name) && !dirent.name.startsWith('.')) {
              stack.push(fullPath)
            }
          } else if (dirent.isFile()) {
            yield fullPath
          }
        }
      } catch (err) {
        // Skip unreadable or permission-denied directories gracefully
      } finally {
        if (dirHandle) {
          try { await dirHandle.close() } catch {}
        }
      }
    }
  }

  private async discoverFiles(dir: string): Promise<string[]> {
    const files: string[] = []
    for await (const file of this.discoverFilesStream(dir)) {
      files.push(file)
    }
    return files
  }

}

export function apply(ctx: Context) {
  ctx.set('rag', new PgVectorRagService(ctx))
}

export default PgVectorRagService

