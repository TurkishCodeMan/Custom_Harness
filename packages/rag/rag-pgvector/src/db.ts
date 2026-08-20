export interface DbConfig {
  connectionString?: string
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  maxConnections?: number
}

export class PgVectorDatabase {
  private pool: any
  private initialized = false
  private config?: DbConfig

  constructor(config?: DbConfig) {
    this.config = config
  }

  private async getOrCreatePool(): Promise<any> {
    if (this.pool) return this.pool
    
    let pgModule: any
    try {
      pgModule = await import('pg')
    } catch {
      throw new Error('PostgreSQL driver (pg) is not installed. Please run `pnpm add pg` or configure database connection.')
    }

    const Pool = pgModule.default?.Pool || pgModule.Pool
    const connectionString = this.config?.connectionString || process.env.DATABASE_URL || process.env.PGVECTOR_URL || 'postgresql://harness_user:harness_pass@localhost:15432/custom_harness_rag'

    if (connectionString.startsWith('postgres')) {
      this.pool = new Pool({
        connectionString,
        max: this.config?.maxConnections || 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      })
    } else {
      this.pool = new Pool({
        host: this.config?.host || process.env.PGHOST || 'localhost',
        port: this.config?.port || Number(process.env.PGPORT) || 15432,
        user: this.config?.user || process.env.PGUSER || 'harness_user',
        password: this.config?.password || process.env.PGPASSWORD || 'harness_pass',
        database: this.config?.database || process.env.PGDATABASE || 'custom_harness_rag',
        max: this.config?.maxConnections || 10
      })
    }

    return this.pool
  }

  public async getPool(): Promise<any> {
    return this.getOrCreatePool()
  }

  /**
   * Initializes PostgreSQL schema and pgvector extension.
   */
  public async initSchema(): Promise<void> {
    if (this.initialized) return

    const pool = await this.getOrCreatePool()
    const client = await pool.connect()
    try {
      // 1. Enable pgvector extension if available
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;')

      // 2. Sources table (Indexed directories)
      await client.query(`
        CREATE TABLE IF NOT EXISTS rag_sources (
          id TEXT PRIMARY KEY,
          path TEXT UNIQUE NOT NULL,
          file_count INT DEFAULT 0,
          chunk_count INT DEFAULT 0,
          last_indexed_at BIGINT NOT NULL,
          status TEXT NOT NULL,
          error TEXT
        );
      `)

      // 3. Documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS rag_documents (
          id TEXT PRIMARY KEY,
          source_id TEXT REFERENCES rag_sources(id) ON DELETE CASCADE,
          file_path TEXT NOT NULL,
          file_type TEXT NOT NULL,
          last_modified BIGINT NOT NULL,
          content_hash TEXT
        );
      `)

      // 4. Chunks and Vector Embeddings table (1024-dim default for modern embeddings e.g. bge-m3 / qwen)
      await client.query(`
        CREATE TABLE IF NOT EXISTS rag_chunks (
          id TEXT PRIMARY KEY,
          document_id TEXT REFERENCES rag_documents(id) ON DELETE CASCADE,
          source_path TEXT NOT NULL,
          chunk_index INT NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB,
          embedding vector
        );
      `)

      // 5. Create index on source_path, HNSW vector index, and GIN Full-Text Search index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_source_path ON rag_chunks(source_path);
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_fts ON rag_chunks USING gin (to_tsvector('simple', content));
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_hnsw ON rag_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
      `).catch(() => {})

      // 6. Dedicated Image Embeddings table (768-dim SigLIP visual vectors)
      await client.query(`
        CREATE TABLE IF NOT EXISTS rag_images (
          id TEXT PRIMARY KEY,
          document_id TEXT REFERENCES rag_documents(id) ON DELETE CASCADE,
          file_path TEXT UNIQUE NOT NULL,
          ocr_text TEXT,
          embedding vector(768),
          created_at BIGINT NOT NULL
        );
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rag_images_filepath ON rag_images(file_path);
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rag_images_hnsw ON rag_images USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
      `).catch(() => {})

      this.initialized = true
    } catch (err: any) {
      console.warn('[PgVector] Database schema init warning (will retry on first operation):', err.message)
    } finally {
      client.release()
    }
  }

  public async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount?: number }> {
    await this.initSchema()
    const pool = await this.getOrCreatePool()
    return pool.query(text, params)
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
    }
  }
}
