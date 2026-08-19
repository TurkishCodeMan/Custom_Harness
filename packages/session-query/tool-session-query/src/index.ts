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
      async execute({ query, sessionId }: { query: string; sessionId?: string }) {
        const sessions = ctx.session.listSessions()
        const targetSessions = sessionId ? sessions.filter(s => s.id === sessionId) : sessions

        const matches: Array<{ sessionId: string; role: string; snippet: string }> = []

        const lowerQuery = query.toLowerCase()

        for (const summary of targetSessions) {
          const s = ctx.session.getSession(summary.id)
          if (!s || !s.messages) continue
          for (const msg of s.messages) {
            const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            if (text.toLowerCase().includes(lowerQuery)) {
              matches.push({
                sessionId: s.id,
                role: msg.role,
                snippet: text.length > 300 ? text.substring(0, 300) + '...' : text
              })
            }
          }
        }

        if (matches.length === 0) {
          return `No matches found for '${query}' in session history.`
        }

        return `### Session History Matches (${matches.length}):\n\n` +
          matches.map(m => `- **[${m.sessionId}] ${m.role}**: ${m.snippet}`).join('\n\n')
      }
    })
  )
}
