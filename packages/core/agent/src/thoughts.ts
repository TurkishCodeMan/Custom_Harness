import type { ExtractedThoughts } from './types.js'

/**
 * Extracts embedded <thought>, <think>, or <commentary> XML tags from model content,
 * returning the cleaned user-facing content and the extracted reasoning string.
 */
export function extractThoughts(rawContent: string, rawThinking: string = ''): ExtractedThoughts {
  let cleanContent = rawContent || ''
  let finalThinking = rawThinking || ''

  // 1. Properly closed thought XML tags: <think>...</think>, <thought>...</thought>, <commentary>...</commentary>
  // Do NOT match if preceded or followed by backticks (e.g. `<think>` in markdown code)
  const closedTagRegex = /(?<!`)<(?:thought|think|commentary)(?:>|[\s\n\r])([\s\S]*?)<\/(?:thought|think|commentary)>(?!`)/gi
  const extracted: string[] = []
  let match: RegExpExecArray | null
  while ((match = closedTagRegex.exec(cleanContent)) !== null) {
    if (match[1]?.trim()) {
      extracted.push(match[1].trim())
    }
  }

  if (extracted.length > 0) {
    finalThinking = finalThinking ? `${finalThinking}\n\n${extracted.join('\n\n')}` : extracted.join('\n\n')
    cleanContent = cleanContent.replace(closedTagRegex, '').trim()
  }

  // 2. Unclosed thought tags: ONLY if the message actually started with a thought tag at the very beginning
  // and ran out of tokens before closing. Never treat a mention of <think> in the middle of a sentence as an unclosed tag.
  const trimmed = cleanContent.trim()
  if (/^<(?:thought|think|commentary)(?:>|[\s\n\r])/i.test(trimmed)) {
    const unclosedMatch = trimmed.match(/^<(?:thought|think|commentary)(?:>|[\s\n\r])([\s\S]*)$/i)
    if (unclosedMatch && unclosedMatch[1]?.trim()) {
      finalThinking = finalThinking ? `${finalThinking}\n\n${unclosedMatch[1].trim()}` : unclosedMatch[1].trim()
      cleanContent = ''
    }
  }

  return { cleanContent, finalThinking }
}
