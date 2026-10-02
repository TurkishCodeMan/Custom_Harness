import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import fs from 'node:fs'
import path from 'node:path'

export const name = 'tool-fs-search'
export const inject = ['tools', 'settings']

function globToRegex(glob: string): RegExp {
  let regexStr = '^'
  let i = 0
  while (i < glob.length) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        regexStr += '(?:.*/)?'
        i += 3
      } else {
        regexStr += '.*'
        i += 2
      }
    } else if (c === '*') {
      regexStr += '[^/]*'
      i++
    } else if (c === '?') {
      regexStr += '[^/]'
      i++
    } else if ('./+^$[](){}|'.includes(c)) {
      regexStr += '\\' + c
      i++
    } else {
      regexStr += c
      i++
    }
  }
  regexStr += '$'
  return new RegExp(regexStr, 'i')
}

function matchGlob(pattern: string, targetPath: string): boolean {
  const normTarget = targetPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const normPattern = pattern.replace(/\\/g, '/').replace(/^\/+/, '')

  if (normPattern.endsWith('/**')) {
    const prefix = normPattern.slice(0, -3)
    if (normTarget === prefix || normTarget.startsWith(prefix + '/')) return true
  }

  try {
    return globToRegex(normPattern).test(normTarget)
  } catch {
    return normTarget === normPattern || normTarget.startsWith(normPattern)
  }
}

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
        exec?: { cwd?: string; activePreset?: any }
      ) {
        const workspaceRoot = path.resolve(exec?.cwd || (ctx.settings?.getWorkspace ? ctx.settings.getWorkspace() : process.cwd()))
        let root = workspaceRoot
        if (targetDir) {
          const candidate = path.resolve(workspaceRoot, targetDir.replace(/^[/\\]+/, ''))
          if (candidate.startsWith(workspaceRoot)) {
            root = candidate
          }
        }

        const activePreset = exec?.activePreset
        const fileScope = activePreset?.fileScope

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
            const relFromWorkspace = path.relative(workspaceRoot, fullPath).replace(/\\/g, '/')

            // Deny check
            if (fileScope?.deny && Array.isArray(fileScope.deny) && fileScope.deny.length > 0) {
              if (fileScope.deny.some((p: string) => matchGlob(p, relFromWorkspace))) {
                continue
              }
            }

            if (entry.isDirectory()) {
              if (['node_modules', '.git', 'dist', 'build', '.venv', '__pycache__'].includes(entry.name)) continue
              walk(fullPath)
            } else if (entry.isFile()) {
              if (filePattern && !entry.name.endsWith(filePattern)) continue

              // Read scope check
              if (fileScope?.read && Array.isArray(fileScope.read) && fileScope.read.length > 0) {
                const isAllowed = fileScope.read.some((p: string) => matchGlob(p, relFromWorkspace))
                if (!isAllowed) continue
              }

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
