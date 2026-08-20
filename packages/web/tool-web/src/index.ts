import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-web'
export const inject = ['tools', 'web', 'systemPrompt']

export function apply(ctx: Context) {
  // 1. web_search Tool
  ctx.tools.register(
    defineTool({
      name: 'web_search',
      description: 'Search the live web for documentation, latest library updates, technical articles, and solutions.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up on the web.'
          },
          maxResults: {
            type: 'integer',
            description: 'Maximum number of search results to return (default: 6).'
          }
        },
        required: ['query']
      },
      async execute({ query, maxResults }: { query: string; maxResults?: number }) {
        try {
          const result = await ctx.web.search({ query, maxResults: maxResults || 6 })
          if (!result.sources || result.sources.length === 0) {
            return `No web results found for query: "${query}". Try refining your search terms.`
          }

          let formatted = `### 🌐 Web Arama Sonuçları: "${query}"\n\n`
          result.sources.forEach((src, idx) => {
            formatted += `**[${idx + 1}] [${src.title}](${src.url})**\n`
            formatted += `> ${src.snippet}\n`
            formatted += `- *Kaynak:* \`${src.url}\`\n\n`
          })

          return formatted.trim()
        } catch (err: any) {
          return `[Hata]: Web araması gerçekleştirilemedi: ${err.message}`
        }
      }
    })
  )

  // 2. web_fetch Tool
  ctx.tools.register(
    defineTool({
      name: 'web_fetch',
      description: 'Fetches content from a public URL and converts the page HTML into clean, readable Markdown text.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The HTTP or HTTPS URL of the web page to fetch.'
          },
          maxChars: {
            type: 'integer',
            description: 'Maximum characters of markdown text to return (default: 80000).'
          }
        },
        required: ['url']
      },
      async execute({ url, maxChars }: { url: string; maxChars?: number }) {
        try {
          const result = await ctx.web.fetch({ url, maxChars: maxChars || 80000 })
          let header = `### 📄 Sayfa İçeriği: ${result.title || url}\n`
          header += `- **URL:** \`${result.url}\`\n`
          header += `- **Durum:** HTTP ${result.status}\n\n---\n\n`

          return header + result.markdown
        } catch (err: any) {
          return `[Hata]: Web sayfası okunamadı: ${err.message}`
        }
      }
    })
  )

  // 3. System Prompt Guidance
  if (ctx.systemPrompt?.section) {
    ctx.systemPrompt.section({
      name: 'web-tools-guidance',
      order: 85,
      text: () => `\n## WEB ACCESS CAPABILITY (Active)
- Use 'web_search' to find external documentation, library APIs, and latest tech information.
- Use 'web_fetch' with a specific URL to read full articles, GitHub readmes, or technical documentation.
`
    })
  }
}
