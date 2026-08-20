export interface VllmEmbeddingOptions {
  endpoint?: string
  model?: string
  batchSize?: number
  apiKey?: string
  timeoutMs?: number
}

export class VllmEmbeddingClient {
  private endpoint: string
  private model: string
  private batchSize: number
  private apiKey?: string
  private timeoutMs: number

  constructor(options?: VllmEmbeddingOptions) {
    this.endpoint = (options?.endpoint || process.env.VLLM_EMBEDDING_URL || 'http://localhost:7272/v1').replace(/\/+$/, '')
    this.model = options?.model || process.env.VLLM_EMBEDDING_MODEL || 'bge-m3'
    this.batchSize = options?.batchSize || 32
    this.apiKey = options?.apiKey || process.env.VLLM_API_KEY
    this.timeoutMs = options?.timeoutMs || 60000
  }

  public updateConfig(options: Partial<VllmEmbeddingOptions>) {
    if (options.endpoint) this.endpoint = options.endpoint.replace(/\/+$/, '')
    if (options.model) this.model = options.model
    if (options.batchSize) this.batchSize = options.batchSize
    if (options.apiKey !== undefined) this.apiKey = options.apiKey
  }

  public getModel(): string {
    return this.model
  }

  public getEndpoint(): string {
    return this.endpoint
  }

  /**
   * Generates embeddings for a batch of strings via vLLM /v1/embeddings
   */
  public async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const allEmbeddings: number[][] = []
    
    // Chunk into configured batch sizes to respect GPU memory and payload limits
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize)
      const embeddings = await this.fetchBatch(batch)
      allEmbeddings.push(...embeddings)
    }

    return allEmbeddings
  }

  private async fetchBatch(texts: string[]): Promise<number[][]> {
    const url = `${this.endpoint}/embeddings`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          input: texts
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        throw new Error(`vLLM Embeddings API error (${res.status}): ${errorText}`)
      }

      const data: any = await res.json()
      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response structure from vLLM embeddings endpoint.')
      }

      // Sort by index to maintain original order
      const sorted = [...data.data].sort((a: any, b: any) => a.index - b.index)
      return sorted.map((item: any) => item.embedding)
    } finally {
      clearTimeout(timer)
    }
  }
}
