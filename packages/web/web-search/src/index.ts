import type { Context } from '@custom-harness/core-context'
import type { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from '@custom-harness/web-service'

export const name = 'web-search'
export const inject = ['web']

export class UniversalWebSearchProvider implements WebSearchProvider {
  public id = 'universal-search'
  public name = 'DuckDuckGo & Web Search Provider'

  public async search(req: WebSearchRequest): Promise<WebSearchResult> {
    const maxResults = req.maxResults || 8
    const query = req.query.trim()
    if (!query) return { query, sources: [] }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      // 1. DuckDuckGo HTML Instant Search
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: req.signal || controller.signal
      })

      clearTimeout(timeout)

      const html = await res.text()
      const sources: WebSearchSource[] = []

      // Match result blocks in DuckDuckGo HTML
      const resultRegex = /<a\s+class="result__url"\s+href="([^"]+)"[^>]*>[\s\S]*?<a\s+class="result__snippet[^"]*"\s+href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
      let match: RegExpExecArray | null

      // Alternative simpler pattern for DDG results
      const snippetBlocks = html.split('<div class="result results_links results_links_deep')
      
      for (let i = 1; i < snippetBlocks.length && sources.length < maxResults; i++) {
        const block = snippetBlocks[i]
        
        // Extract title
        const titleMatch = block.match(/<a class="result__a"[^>]*>([\s\S]*?)<\/a>/i)
        // Extract URL
        const urlMatch = block.match(/<a class="result__snippet"[^>]*href="([^"]+)"/i) || block.match(/<a class="result__url"[^>]*href="([^"]+)"/i) || block.match(/uddg=([^&"]+)/i)
        // Extract snippet
        const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) || block.match(/<div class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i)

        if (titleMatch && (urlMatch || snippetMatch)) {
          const cleanTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim()
          let rawUrl = urlMatch ? (urlMatch[1] || urlMatch[0]) : ''
          if (rawUrl.includes('uddg=')) {
            const uddgMatch = rawUrl.match(/uddg=([^&"]+)/)
            if (uddgMatch) rawUrl = decodeURIComponent(uddgMatch[1])
          }
          const cleanSnippet = (snippetMatch ? snippetMatch[1] : '').replace(/<[^>]+>/g, '').trim()

          if (cleanTitle && rawUrl.startsWith('http')) {
            sources.push({
              title: cleanTitle,
              url: rawUrl,
              snippet: cleanSnippet
            })
          }
        }
      }

      // Fallback: If DDG was throttled or returned empty, return mock research synthesis or direct query
      if (sources.length === 0) {
        console.warn(`[WebSearch] DDG HTML returned 0 results for: "${query}".`)
      }

      return {
        query,
        sources
      }
    } catch (err: any) {
      clearTimeout(timeout)
      console.warn(`[WebSearch] Search error for query "${query}":`, err.message)
      return {
        query,
        sources: []
      }
    }
  }
}

export function apply(ctx: Context) {
  const provider = new UniversalWebSearchProvider()
  ctx.web.registerSearchProvider(provider)
}
