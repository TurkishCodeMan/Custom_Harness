import type { ExtractedThoughts } from './types.js'

/**
 * Extracts embedded <thought>, <think>, or <commentary> XML tags from model content,
 * returning the cleaned user-facing content and the extracted reasoning string.
 */
export function extractThoughts(rawContent: string, rawThinking: string = ''): ExtractedThoughts {
  let cleanContent = rawContent || ''
  let finalThinking = rawThinking || ''

  if (cleanContent.includes('<thought>') || cleanContent.includes('<think>') || cleanContent.includes('<commentary>')) {
    const extracted: string[] = []
    const regex = /<(?:thought|think|commentary)(?:>|[\s\n\r])([\s\S]*?)(?:<\/(?:thought|think|commentary)>|$)/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(cleanContent)) !== null) {
      if (match[1]?.trim()) {
        extracted.push(match[1].trim())
      }
    }
    if (extracted.length > 0) {
      finalThinking = finalThinking ? `${finalThinking}\n\n${extracted.join('\n\n')}` : extracted.join('\n\n')
      cleanContent = cleanContent.replace(/<(?:thought|think|commentary)(?:>|[\s\n\r])[\s\S]*?(?:<\/(?:thought|think|commentary)>|$)/gi, '').trim()
    }
  }

  return { cleanContent, finalThinking }
}
