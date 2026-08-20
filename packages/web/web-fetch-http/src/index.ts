import type { Context } from '@custom-harness/core-context'
import type { WebFetchProvider, WebFetchRequest, WebFetchResult } from '@custom-harness/web-service'

export const name = 'web-fetch-http'
export const inject = ['web']

export class HttpWebFetchProvider implements WebFetchProvider {
  public id = 'http'
  public name = 'Native HTTP Web Fetcher'

  public async fetch(req: WebFetchRequest): Promise<WebFetchResult> {
    const maxChars = req.maxChars || 150000
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    try {
      const response = await fetch(req.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (DeepSeek-Harness/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7'
        },
        signal: req.signal || controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      const rawText = await response.text()

      let title = ''
      let markdown = ''

      if (contentType.includes('text/html') || rawText.includes('<html')) {
        // Extract Title
        const titleMatch = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        if (titleMatch) {
          title = titleMatch[1].replace(/\s+/g, ' ').trim()
        }

        // Clean HTML to Markdown representation
        let cleaned = rawText
          // Strip head, scripts, styles, svg, and forms
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
          .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
          .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
          .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')

        // Transform Headers
        cleaned = cleaned.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
        cleaned = cleaned.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
        cleaned = cleaned.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
        cleaned = cleaned.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')

        // Transform Links and Images
        cleaned = cleaned.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
        cleaned = cleaned.replace(/<img\s+(?:[^>]*?\s+)?src="([^"]*)"(?:\s+alt="([^"]*)")?[^>]*>/gi, '![$2]($1)')

        // Transform Lists
        cleaned = cleaned.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
        cleaned = cleaned.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
        cleaned = cleaned.replace(/<br\s*[\/]?>/gi, '\n')
        cleaned = cleaned.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
        cleaned = cleaned.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

        // Strip remaining HTML tags
        cleaned = cleaned.replace(/<[^>]+>/g, '')

        // Decode common HTML entities
        cleaned = cleaned
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")

        // Clean up excess blank lines
        markdown = cleaned.replace(/\n{3,}/g, '\n\n').trim()
      } else {
        markdown = rawText.trim()
      }

      if (markdown.length > maxChars) {
        markdown = markdown.slice(0, maxChars) + `\n\n... [Metin ${maxChars} karakter sınırında kesildi / Truncated]`
      }

      return {
        url: req.url,
        title: title || undefined,
        markdown,
        status: response.status,
        contentType
      }
    } catch (err: any) {
      clearTimeout(timeout)
      throw new Error(`Sayfa çekilemedi (${req.url}): ${err.message}`)
    }
  }
}

export function apply(ctx: Context) {
  const provider = new HttpWebFetchProvider()
  ctx.web.registerFetchProvider(provider)
}
