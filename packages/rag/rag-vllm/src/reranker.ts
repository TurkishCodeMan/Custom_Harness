export interface RerankResultItem {
  index: number
  relevanceScore: number
  text: string
}

export interface RerankerClientConfig {
  endpoint?: string
  model?: string
  apiKey?: string
  timeoutMs?: number
}

export class VllmRerankerClient {
  private endpoint: string
  private timeoutMs: number

  constructor(config?: RerankerClientConfig) {
    this.endpoint = config?.endpoint || process.env.RERANKER_URL || 'http://localhost:8006/v1/rerank'
    this.timeoutMs = config?.timeoutMs || 10000
  }

  public setEndpoint(endpoint: string) {
    this.endpoint = endpoint
  }

  public async rerank(query: string, documents: string[], topN?: number): Promise<RerankResultItem[] | null> {
    if (!documents || documents.length === 0) return []

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          documents,
          top_n: topN || documents.length
        }),
        signal: controller.signal
      })

      clearTimeout(timer)

      if (!response.ok) {
        console.warn(`[RAG:Reranker] HTTP error ${response.status} from ${this.endpoint}`)
        return null
      }

      const data: any = await response.json()
      if (!data || !Array.isArray(data.results)) {
        return null
      }

      return data.results.map((r: any) => ({
        index: r.index,
        relevanceScore: r.relevance_score ?? r.score ?? 0,
        text: r.document?.text || documents[r.index] || ''
      }))
    } catch (err: any) {
      clearTimeout(timer)
      if (err.name !== 'AbortError') {
        console.warn(`[RAG:Reranker] Connection failed to ${this.endpoint}:`, err.message)
      }
      return null
    }
  }
}
