import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import type { LspOperation, LspQueryResult } from '@custom-harness/lsp'
import path from 'node:path'

export const name = 'tool-lsp'
export const inject = ['tools', 'lsp', 'settings']

export const LSP_OPERATIONS: readonly LspOperation[] = ['goToDefinition', 'findReferences', 'goToImplementation', 'hover']

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'lsp',
      description:
        'Language Server Protocol (LSP) tool for code intelligence. Use for precise definition lookup, reference search, implementation jump, and hover type info. Positions are 1-based.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['goToDefinition', 'findReferences', 'goToImplementation', 'hover'],
            description: 'The LSP query operation to perform.'
          },
          filePath: {
            type: 'string',
            description: 'Source file path to query (e.g. src/index.ts).'
          },
          line: {
            type: 'integer',
            description: '1-based line number at cursor.'
          },
          character: {
            type: 'integer',
            description: '1-based UTF-16 character/column offset within the line.'
          }
        },
        required: ['operation', 'filePath', 'line', 'character']
      },
      async execute(
        {
          operation,
          filePath,
          line,
          character
        }: {
          operation: LspOperation
          filePath: string
          line: number
          character: number
        },
        exec?: { cwd?: string }
      ) {
        const workspaceRoot = exec?.cwd || (ctx.settings?.getWorkspace ? ctx.settings.getWorkspace() : process.cwd())

        try {
          const result: LspQueryResult = await ctx.lsp.query({
            operation,
            filePath,
            position: {
              line: Math.max(0, line - 1),
              character: Math.max(0, character - 1)
            },
            workspaceRoot
          })

          if (result.operation === 'hover') {
            if (!result.hover || !result.hover.contents) {
              return 'No hover information available at this position.'
            }
            return `### Hover Info:\n\n${result.hover.contents}`
          }

          if ('locations' in result) {
            if (!result.locations || result.locations.length === 0) {
              return `No ${operation} results found.`
            }

            const formatted = result.locations
              .map(loc => {
                return `- **${loc.uri}** (Line ${loc.range.start.line + 1}, Col ${loc.range.start.character + 1})`
              })
              .join('\n')

            return `### ${operation} (${result.locations.length} results):\n\n${formatted}`
          }

          return JSON.stringify(result, null, 2)
        } catch (e: any) {
          return `LSP Error [${e.code || 'UNKNOWN'}]: ${e.message}`
        }
      }
    })
  )
}
