import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type {
  DocumentChunk,
  RagSearchQuery,
  RagResourceConfig,
  RagSourceFolder,
  RagStatus
} from './types.js'

export * from './types.js'

export abstract class RagService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'rag')
  }

  /**
   * Initializes database connections and vector extensions.
   */
  public abstract initialize(config?: any): Promise<void>

  /**
   * Adds and recursively indexes an entire folder of code, docs, and images.
   */
  public abstract addAndIndexFolder(folderPath: string, options?: RagResourceConfig, ownerId?: string): Promise<RagSourceFolder>

  /**
   * Updates permission access list for an indexed source folder.
   */
  public abstract updateSourcePermissions(sourceId: string, allowedUserIds: string[], isPublic?: boolean): Promise<void>

  /**
   * Performs semantic similarity search against pgvector.
   */
  public abstract search(query: RagSearchQuery, userId?: string, isAdmin?: boolean): Promise<DocumentChunk[]>

  /**
   * Performs semantic image similarity search using SigLIP visual embeddings.
   */
  public abstract searchImages(query: { textQuery?: string; imagePath?: string; topK?: number }, userId?: string, isAdmin?: boolean): Promise<import('./types.js').ImageSearchResult[]>

  /**
   * Removes an indexed folder and all its associated vector chunks.
   */
  public abstract removeFolder(sourceIdOrPath: string): Promise<void>

  /**
   * Clears the entire RAG vector index across all sources.
   */
  public abstract clearAll(): Promise<void>

  /**
   * Returns current RAG indexing, storage, and resource status.
   */
  public abstract getStatus(userId?: string, isAdmin?: boolean): Promise<RagStatus>

  /**
   * Sets or updates RAG resource throttling and mode configuration.
   */
  public abstract setResourceConfig(config: Partial<RagResourceConfig>): void

  /**
   * Returns live real-time indexing progress and stats.
   */
  public abstract getProgress(): import('./types.js').IndexingProgress

  /**
   * Pauses active indexing job queue.
   */
  public abstract pauseIndexing(): Promise<void>

  /**
   * Resumes paused indexing job queue.
   */
  public abstract resumeIndexing(): Promise<void>

  /**
   * Cancels active indexing jobs and clears the queue.
   */
  public abstract cancelIndexing(): Promise<void>

  /**
   * Toggles active RAG mode.
   */
  public abstract setRagMode(enabled: boolean): void

  /**
   * Returns whether RAG mode is currently active.
   */
  public abstract isRagMode(): boolean
}

export const name = 'rag'

export function apply(ctx: Context) {
  // Abstract service capability seam
}

export default RagService
