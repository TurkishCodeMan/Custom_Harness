export interface DocumentChunk {
  id: string
  documentId: string
  sourcePath: string
  content: string
  tenantId?: string
  metadata?: Record<string, any>
  embedding?: number[]
  similarity?: number
  tokenCount?: number
  chunkIndex: number
}

export interface RagSearchQuery {
  query: string
  topK?: number
  minSimilarity?: number
  sourceFilter?: string
  filePathPrefix?: string
  tenantId?: string
  filter?: Record<string, any>
}

export interface ImageSearchResult {
  filePath: string
  similarity: number
  ocrText?: string
  rrfScore?: number
}

export interface ImageSearchQuery {
  textQuery?: string
  imagePath?: string
  topK?: number
}

export interface RagResourceConfig {
  maxMemoryMb?: number
  batchSize?: number
  concurrency?: number
  workerConcurrency?: number
  indexingMode?: 'standard' | 'turbo'
  redisUrl?: string
  chunkSize?: number
  chunkOverlap?: number
  autoThrottling?: boolean
  throttleDelayMs?: number
  bulkInsertSize?: number
  skipExistingUnchanged?: boolean
  maxFiles?: number
  embeddingModel?: string
  embeddingEndpoint?: string
  visionModel?: string
  visionEndpoint?: string
  imageSearchEndpoint?: string
}

export interface RagSourceFolder {
  id: string
  path: string
  fileCount: number
  chunkCount: number
  lastIndexedAt: number
  status: 'idle' | 'indexing' | 'error'
  error?: string
  ownerId?: string
  allowedUserIds?: string[]
  isPublic?: boolean
}

export interface IndexingProgress {
  totalFiles: number
  processedFiles: number
  totalChunks: number
  percent: number
  currentFile?: string
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  speedFilesPerSec?: number
  startedAt?: number
  estimatedRemainingSec?: number
}

export interface RagStatus {
  isIndexing: boolean
  sources: RagSourceFolder[]
  totalDocumentsCount: number
  totalChunksCount: number
  ragModeActive: boolean
  resourceConfig: RagResourceConfig
  progress?: IndexingProgress
  resourceUsage: {
    activeJobs: number
    lastBatchDurationMs?: number
  }
}

export interface IndexProgressEvent {
  sourceId: string
  currentFile: string
  completedFiles: number
  totalFiles: number
  totalChunks: number
  percent: number
  phase: 'discovering' | 'parsing' | 'embedding' | 'storing' | 'completed' | 'failed'
  error?: string
}

