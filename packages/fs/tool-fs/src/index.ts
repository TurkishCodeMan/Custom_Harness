import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'
import fs from 'node:fs'
import path from 'node:path'

export const name = 'tool-fs'
export const inject = ['tools', 'fs']

function resolvePath(targetPath: string, cwd?: string): string {
  if (!targetPath) return cwd || process.cwd()
  if (path.isAbsolute(targetPath)) return targetPath
  return path.resolve(cwd || process.cwd(), targetPath)
}

function applyReplacement(content: string, oldStr: string, newStr: string, replaceAll = false): { success: boolean; result: string; error?: string } {
  const normalizedContent = content.replace(/\r\n/g, '\n')
  const normalizedOld = oldStr.replace(/\r\n/g, '\n')
  const normalizedNew = newStr.replace(/\r\n/g, '\n')

  if (normalizedOld === '') {
    return { success: true, result: normalizedNew }
  }

  // 1. Direct exact match
  if (normalizedContent.includes(normalizedOld)) {
    const occurrences = normalizedContent.split(normalizedOld).length - 1
    if (occurrences === 1 || replaceAll) {
      const result = replaceAll 
        ? normalizedContent.split(normalizedOld).join(normalizedNew)
        : normalizedContent.replace(normalizedOld, normalizedNew)
      return { success: true, result }
    }
    if (occurrences > 1) {
      return { success: false, result: content, error: `old_string appears ${occurrences} times in file. Provide more unique surrounding lines or set replace_all to true.` }
    }
  }

  // 2. Line-by-line whitespace-tolerant match
  const contentLines = normalizedContent.split('\n')
  const oldLines = normalizedOld.split('\n').map(l => l.trimEnd())
  
  let matchIndex = -1
  let matchCount = 0

  for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
    let matches = true
    for (let j = 0; j < oldLines.length; j++) {
      if (contentLines[i + j].trimEnd() !== oldLines[j]) {
        matches = false
        break
      }
    }
    if (matches) {
      matchIndex = i
      matchCount++
    }
  }

  if (matchCount === 1 && matchIndex !== -1) {
    const newLines = normalizedNew.split('\n')
    contentLines.splice(matchIndex, oldLines.length, ...newLines)
    return { success: true, result: contentLines.join('\n') }
  }

  if (matchCount > 1 && !replaceAll) {
    return { success: false, result: content, error: `old_string appears ${matchCount} times in file. Provide more unique context.` }
  }

  // 3. Relaxed Trimmed Substring Match (handles slight indentation mismatches)
  const trimmedOld = normalizedOld.trim()
  if (trimmedOld.length > 10) {
    let relaxedMatches = 0
    let relaxedIndex = -1
    let matchedLength = 0

    for (let i = 0; i < contentLines.length; i++) {
      for (let len = 1; len <= Math.min(oldLines.length + 3, contentLines.length - i); len++) {
        const candidate = contentLines.slice(i, i + len).join('\n').trim()
        if (candidate === trimmedOld) {
          relaxedMatches++
          relaxedIndex = i
          matchedLength = len
          break
        }
      }
    }

    if (relaxedMatches === 1 && relaxedIndex !== -1) {
      const newLines = normalizedNew.split('\n')
      contentLines.splice(relaxedIndex, matchedLength, ...newLines)
      return { success: true, result: contentLines.join('\n') }
    }
  }

  return {
    success: false,
    result: content,
    error: `old_string was not found in file. Check exact indentation and whitespace.`
  }
}

export function apply(ctx: Context) {
  // 1. read / read_file
  const readHandler = async (args: any, context: any) => {
    const targetFile = args.file_path || args.path
    if (!targetFile) throw new Error('file_path parameter is required.')
    
    const fullPath = resolvePath(targetFile, context?.cwd)
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${targetFile}`)
    }
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${targetFile}`)
    }

    const content = fs.readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')
    const totalLines = lines.length

    const offset = Math.max(1, args.offset || args.start_line || 1)
    const limit = args.limit || (args.end_line !== undefined ? args.end_line - offset + 1 : 2000)

    const startIdx = offset - 1
    const endIdx = Math.min(totalLines, startIdx + limit)
    const sliced = lines.slice(startIdx, endIdx)

    const formattedLines = sliced.map((l, idx) => {
      const lineNum = (startIdx + idx + 1).toString().padStart(6, ' ')
      return `${lineNum} | ${l}`
    }).join('\n')

    return `File: ${targetFile} (${totalLines} lines total, showing ${offset}-${endIdx}):\n${formattedLines}`
  }

  ctx.tools.register(defineTool({
    name: 'read',
    description: 'Read a UTF-8 text file and return line-numbered content.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to read.' },
        offset: { type: 'number', description: '1-based first line to return (defaults to 1).' },
        limit: { type: 'number', description: 'Maximum number of lines to return (defaults to 2000).' }
      },
      required: ['file_path']
    },
    execute: readHandler
  }))

  ctx.tools.register(defineTool({
    name: 'read_file',
    description: 'Read the contents of a file with optional line windowing.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file.' },
        start_line: { type: 'number', description: 'Starting line number (1-based).' },
        end_line: { type: 'number', description: 'Ending line number.' }
      },
      required: ['path']
    },
    execute: readHandler
  }))

  // 2. edit / edit_file
  const editHandler = async (args: any, context: any) => {
    const targetFile = args.file_path || args.path
    if (!targetFile) throw new Error('file_path parameter is required.')

    const fullPath = resolvePath(targetFile, context?.cwd)
    const oldStr = args.old_string ?? args.old_str ?? args.old_content
    const newStr = args.new_string ?? args.new_str ?? args.new_content ?? ''
    const replaceAll = args.replace_all ?? false

    if (!fs.existsSync(fullPath)) {
      if (oldStr === '' || oldStr === undefined) {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true })
        fs.writeFileSync(fullPath, newStr, 'utf8')
        return `The file ${targetFile} has been created successfully.`
      }
      throw new Error(`File not found: ${targetFile}`)
    }

    if (oldStr === undefined) {
      throw new Error('old_string parameter is required to perform an edit.')
    }

    const content = fs.readFileSync(fullPath, 'utf8')
    const res = applyReplacement(content, oldStr, newStr, replaceAll)
    if (!res.success) {
      throw new Error(res.error || `Failed to replace old_string in ${targetFile}`)
    }

    fs.writeFileSync(fullPath, res.result, 'utf8')
    return `The file ${targetFile} has been updated successfully.`
  }

  ctx.tools.register(defineTool({
    name: 'edit',
    description: 'Edit an existing UTF-8 text file by replacing literal old_string with new_string.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file to edit.' },
        old_string: { type: 'string', description: 'Literal text to replace.' },
        new_string: { type: 'string', description: 'Literal replacement text.' },
        replace_all: { type: 'boolean', description: 'Whether to replace all occurrences (defaults to false).' }
      },
      required: ['file_path', 'old_string', 'new_string']
    },
    execute: editHandler
  }))

  ctx.tools.register(defineTool({
    name: 'edit_file',
    description: 'Edit a file by replacing old_str with new_str.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to edit.' },
        old_str: { type: 'string', description: 'Exact string or block to replace.' },
        new_str: { type: 'string', description: 'Replacement string or block.' },
        old_content: { type: 'string', description: 'Alternative for old_str.' },
        new_content: { type: 'string', description: 'Alternative for new_str.' }
      },
      required: ['path']
    },
    execute: editHandler
  }))

  // 3. write / write_file
  const writeHandler = async (args: any, context: any) => {
    const targetFile = args.file_path || args.path
    if (!targetFile) throw new Error('file_path parameter is required.')

    const fullPath = resolvePath(targetFile, context?.cwd)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, args.content || '', 'utf8')
    return `The file ${targetFile} has been written successfully.`
  }

  ctx.tools.register(defineTool({
    name: 'write',
    description: 'Create or overwrite a file with given content.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file to write.' },
        content: { type: 'string', description: 'Content to write.' }
      },
      required: ['file_path', 'content']
    },
    execute: writeHandler
  }))

  ctx.tools.register(defineTool({
    name: 'write_file',
    description: 'Create or write to a file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file.' },
        content: { type: 'string', description: 'Content to write.' }
      },
      required: ['path', 'content']
    },
    execute: writeHandler
  }))

  // 4. str_replace_editor (Anthropic / DeepSeek standard)
  ctx.tools.register(defineTool({
    name: 'str_replace_editor',
    description: 'Custom editing tool for viewing, creating, and editing files.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: ['view', 'create', 'str_replace', 'insert', 'undo_edit'], description: 'Command to run.' },
        path: { type: 'string', description: 'Path to the file.' },
        old_str: { type: 'string', description: 'Old string to replace.' },
        new_str: { type: 'string', description: 'New string to substitute.' },
        file_text: { type: 'string', description: 'Content for create command.' },
        view_range: { type: 'array', items: { type: 'number' }, description: 'Line range [start, end] for view command.' }
      },
      required: ['command', 'path']
    },
    execute: async (args: any, context: any) => {
      const fullPath = resolvePath(args.path, context?.cwd)

      if (args.command === 'view') {
        if (!fs.existsSync(fullPath)) throw new Error(`Path does not exist: ${args.path}`)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          const files = fs.readdirSync(fullPath)
          return `Directory listing for ${args.path}:\n${files.join('\n')}`
        }
        const content = fs.readFileSync(fullPath, 'utf8')
        const lines = content.split('\n')
        let start = 1
        let end = lines.length
        if (args.view_range && args.view_range.length === 2) {
          start = Math.max(1, args.view_range[0])
          end = Math.min(lines.length, args.view_range[1])
        }
        const sliced = lines.slice(start - 1, end).map((l, i) => `${start + i}\t${l}`).join('\n')
        return `File: ${args.path}\n${sliced}`
      }

      if (args.command === 'create') {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true })
        fs.writeFileSync(fullPath, args.file_text || '', 'utf8')
        return `File created successfully at: ${args.path}`
      }

      if (args.command === 'str_replace') {
        if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${args.path}`)
        const content = fs.readFileSync(fullPath, 'utf8')
        const res = applyReplacement(content, args.old_str || '', args.new_str || '')
        if (!res.success) throw new Error(res.error || `Failed to replace in ${args.path}`)
        fs.writeFileSync(fullPath, res.result, 'utf8')
        return `The file ${args.path} has been updated successfully.`
      }

      throw new Error(`Unsupported command: ${args.command}`)
    }
  }))

  // 5. list_dir
  ctx.tools.register(defineTool({
    name: 'list_dir',
    description: 'List contents of a directory. Supports optional recursive listing.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list.' },
        recursive: { type: 'boolean', description: 'Whether to list subdirectories recursively (max depth 2).' }
      },
      required: ['path']
    },
    execute: async (args: { path?: string; recursive?: boolean }, context) => {
      const fullPath = resolvePath(args.path || '.', context?.cwd)
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Directory not found: ${args.path || '.'}`)
      }

      function scan(dir: string, depth = 0): any[] {
        if (depth > 2) return []
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        const results: any[] = []
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue
          const itemPath = path.join(dir, entry.name)
          const rel = path.relative(fullPath, itemPath)
          if (entry.isDirectory()) {
            results.push({ name: rel, type: 'directory' })
            if (args.recursive) {
              results.push(...scan(itemPath, depth + 1))
            }
          } else {
            const stat = fs.statSync(itemPath)
            results.push({ name: rel, type: 'file', sizeBytes: stat.size })
          }
        }
        return results
      }

      const items = scan(fullPath)
      return JSON.stringify(items, null, 2)
    }
  }))

  // 6. grep_search
  ctx.tools.register(defineTool({
    name: 'grep_search',
    description: 'Search for a string or regex pattern across files in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Pattern or text to search for.' },
        path: { type: 'string', description: 'Directory or file to search in (defaults to .).' }
      },
      required: ['query']
    },
    execute: async (args: { query: string; path?: string }, context) => {
      const cwd = context?.cwd || process.cwd()
      const searchPath = args.path || '.'
      try {
        const { execSync } = await import('node:child_process')
        const output = execSync(`grep -rnI --exclude-dir=.git --exclude-dir=node_modules -m 30 "${args.query.replace(/"/g, '\\"')}" ${searchPath}`, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 5 })
        return output || 'No matches found.'
      } catch (err: any) {
        return 'No matches found.'
      }
    }
  }))

  // 7. git_diff
  ctx.tools.register(defineTool({
    name: 'git_diff',
    description: 'View the git diff of all changes made to the repository.',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async (_args, context) => {
      const cwd = context?.cwd || process.cwd()
      try {
        const { execSync } = await import('node:child_process')
        const diff = execSync('git diff', { cwd, encoding: 'utf8' })
        return diff || 'No changes in git.'
      } catch (err: any) {
        return `git diff error: ${err.message}`
      }
    }
  }))

  // 8. finish_task
  ctx.tools.register(defineTool({
    name: 'finish_task',
    description: 'Call this tool when you have finished inspecting, modifying, and verifying the code in the repository to conclude your work.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Brief summary of the fix or changes made.' }
      },
      required: ['summary']
    },
    execute: async (args: { summary: string }) => {
      return `Task successfully finished: ${args.summary}`
    }
  }))
}
