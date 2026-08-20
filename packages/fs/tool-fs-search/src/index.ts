import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import fs from 'node:fs'
import path from 'node:path'

export const name = 'tool-fs-search'
export const inject = ['tools', 'settings']

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'search_files',
      description: 'Recursively searches workspace files matching a text query or regex pattern with optional glob filters.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query or regex pattern.'
          },
          targetDir: {
            type: 'string',
            description: 'Optional subfolder to search within (defaults to workspace root).'
          },
          filePattern: {
            type: 'string',
            description: 'Optional filename filter extension (e.g. ".ts", ".py", ".json").'
          }
        },
        required: ['query']
      },
      async execute(
        { query, targetDir, filePattern }: { query: string; targetDir?: string; filePattern?: string },
        exec?: { cwd?: string }
      ) {
        const workspaceRoot = path.resolve(exec?.cwd || (ctx.settings?.getWorkspace ? ctx.settings.getWorkspace() : process.cwd()))
        let root = workspaceRoot
        if (targetDir) {
          const candidate = path.resolve(workspaceRoot, targetDir.replace(/^[/\\]+/, ''))
          if (candidate.startsWith(workspaceRoot)) {
            root = candidate
          }
        }

        const matches: Array<{ file: string; line: number; content: string }> = []
        const MAX_MATCHES = 50

        function walk(dir: string) {
          if (matches.length >= MAX_MATCHES) return
          let entries: fs.Dirent[] = []
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true })
          } catch {
            return
          }

          for (const entry of entries) {
            if (matches.length >= MAX_MATCHES) break
            const fullPath = path.join(dir, entry.name)

            if (entry.isDirectory()) {
              if (['node_modules', '.git', 'dist', 'build', '.venv', '__pycache__'].includes(entry.name)) continue
              walk(fullPath)
            } else if (entry.isFile()) {
              if (filePattern && !entry.name.endsWith(filePattern)) continue
              try {
                const content = fs.readFileSync(fullPath, 'utf8')
                const lines = content.split('\n')
                const regex = new RegExp(query, 'i')

                for (let i = 0; i < lines.length; i++) {
                  if (regex.test(lines[i])) {
                    const relPath = path.relative(root, fullPath)
                    matches.push({
                      file: relPath,
                      line: i + 1,
                      content: lines[i].trim()
                    })
                    if (matches.length >= MAX_MATCHES) break
                  }
                }
              } catch {}
            }
          }
        }

        walk(root)

        if (matches.length === 0) {
          return `No matches found for '${query}'.`
        }

        return `### Search Results (${matches.length} matches):\n\n` +
          matches.map(m => `- **${m.file}:${m.line}**: \`${m.content}\``).join('\n')
      }
    })
  )
}
