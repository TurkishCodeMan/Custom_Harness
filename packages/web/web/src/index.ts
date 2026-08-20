import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface WebSearchSource {
  title: string
  url: string
  snippet: string
}

export interface WebSearchResult {
  sources: WebSearchSource[]
  query: string
}

export interface WebSearchRequest {
  query: string
  maxResults?: number
  signal?: AbortSignal
}

export interface WebFetchRequest {
  url: string
  signal?: AbortSignal
  maxChars?: number
}

export interface WebFetchResult {
  url: string
  title?: string
  markdown: string
  status: number
  contentType?: string
}

export interface WebSearchProvider {
  id: string
  name: string
  search(req: WebSearchRequest): Promise<WebSearchResult>
}

export interface WebFetchProvider {
  id: string
  name: string
  fetch(req: WebFetchRequest): Promise<WebFetchResult>
}

export const name = 'web'

export class WebService extends Service {
  private searchProviders = new Map<string, WebSearchProvider>()
  private fetchProviders = new Map<string, WebFetchProvider>()

  constructor(ctx: Context) {
    super(ctx, 'web')
  }

  public registerSearchProvider(provider: WebSearchProvider) {
    this.searchProviders.set(provider.id, provider)
    console.log(`[Web] Search provider registered: ${provider.id} (${provider.name})`)
  }

  public registerFetchProvider(provider: WebFetchProvider) {
    this.fetchProviders.set(provider.id, provider)
    console.log(`[Web] Fetch provider registered: ${provider.id} (${provider.name})`)
  }

  public async search(req: WebSearchRequest, providerId?: string): Promise<WebSearchResult> {
    const provider = (providerId && this.searchProviders.get(providerId)) || this.searchProviders.values().next().value
    if (!provider) {
      throw new Error('Aktif bir Web Arama sağlayıcısı (Search Provider) bulunamadı.')
    }
    return provider.search(req)
  }

  public async fetch(req: WebFetchRequest, providerId?: string): Promise<WebFetchResult> {
    const provider = (providerId && this.fetchProviders.get(providerId)) || this.fetchProviders.values().next().value
    if (!provider) {
      throw new Error('Aktif bir Web Sayfası Çekme sağlayıcısı (Fetch Provider) bulunamadı.')
    }
    return provider.fetch(req)
  }
}

export function apply(ctx: Context) {
  ctx.set('web', new WebService(ctx))
}
