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
            description: 'Search term or regex pattern to look for in past conversation history.'
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

        const sessions = ctx.session.listSessions()
        const targetSessions = targetSessionId ? sessions.filter(s => s.id === targetSessionId) : sessions

        const matches: Array<{ sessionId: string; role: string; snippet: string }> = []
        const lowerQuery = query.toLowerCase()

        for (const summary of targetSessions) {
          const s = ctx.session.getSession(summary.id)
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

            if (!lowerQuery || text.toLowerCase().includes(lowerQuery)) {
              matches.push({
                sessionId: s.id,
                role: msg.role || 'unknown',
                snippet: text.length > 300 ? text.substring(0, 300) + '...' : text
              })
            }
          }
        }

        if (matches.length === 0) {
          return query ? `No matches found for '${query}' in session history.` : 'No session messages recorded yet.'
        }

        return `### Session History Matches (${matches.length}):\n\n` +
          matches.slice(0, 30).map(m => `- **[${m.sessionId}] ${m.role}**: ${m.snippet}`).join('\n\n')
      }
    })
  )
}
