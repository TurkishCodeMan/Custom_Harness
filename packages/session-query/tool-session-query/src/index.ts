import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-session-query'
export const inject = ['tools', 'session']

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'query_session_history',
      description: 'Searches previous messages, tool calls, and decisions across current and past sessions.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term or keywords to look for in past conversation history.'
          },
          sessionId: {
            type: 'string',
            description: 'Optional specific session ID to filter history (defaults to current session).'
          }
        },
        required: ['query']
      },
      async execute(args: any, context?: any) {
        const query = (args?.query ?? args?.keyword ?? args?.search ?? args?.q ?? args?.term ?? '').toString().trim()
        const targetSessionId = args?.sessionId || context?.sessionId
        const currentUserId = context?.userId || (context?.sessionId ? ctx.session.getSession(context.sessionId)?.userId : undefined)

        // Strict tenant-boundary enforcement: list only sessions belonging to current tenant
        const sessions = ctx.session.listSessions(currentUserId)
        let targetSessions = targetSessionId ? sessions.filter(s => s.id === targetSessionId) : sessions

        // Security boundary check: if targetSessionId specified, verify caller has access
        if (targetSessionId && targetSessions.length === 0) {
          const directSession = ctx.session.getSession(targetSessionId, currentUserId)
          if (!directSession) {
            return `Oturum bulunamadı veya bu oturuma erişim izniniz yok: ${targetSessionId}`
          }
          targetSessions = [{ id: targetSessionId, title: directSession.title, updatedAt: directSession.updatedAt || Date.now() }]
        }

        const matches: Array<{ sessionId: string; role: string; snippet: string; score: number }> = []
        const lowerQuery = query.toLowerCase()
        const tokens = lowerQuery.split(/\s+/).filter(t => t.length > 1)

        for (const summary of targetSessions) {
          const s = ctx.session.getSession(summary.id, currentUserId)
          if (!s || !s.messages || !Array.isArray(s.messages)) continue
          for (const msg of s.messages) {
            if (!msg) continue
            let text = ''
            if (typeof msg.content === 'string') {
              text = msg.content
            } else if (msg.content) {
              text = JSON.stringify(msg.content)
            } else if ((msg as any).reasoning_content) {
              text = (msg as any).reasoning_content
            } else if ((msg as any).tool_calls) {
              text = JSON.stringify((msg as any).tool_calls)
            }

            if (!text) continue

            const lowerText = text.toLowerCase()
            let score = 0
            if (!lowerQuery) {
              score = 1
            } else if (lowerText.includes(lowerQuery)) {
              score = 10
            } else if (tokens.length > 0) {
              const matchedCount = tokens.filter(t => lowerText.includes(t)).length
              if (matchedCount > 0) {
                score = matchedCount
              }
            }

            if (score > 0) {
              matches.push({
                sessionId: s.id,
                role: msg.role || 'unknown',
                snippet: text.length > 300 ? text.substring(0, 300) + '...' : text,
                score
              })
            }
          }
        }

        matches.sort((a, b) => b.score - a.score)

        if (matches.length === 0) {
          return query ? `No matches found for '${query}' in session history.` : 'No session messages recorded yet.'
        }

        return `### Session History Matches (${matches.length}):\n\n` +
          matches.slice(0, 30).map(m => `- **[${m.sessionId}] ${m.role}**: ${m.snippet}`).join('\n\n')
      }
    })
  )
}
