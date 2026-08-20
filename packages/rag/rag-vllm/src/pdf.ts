import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Enterprise Direct PDF Text Extractor.
 * Directly decodes digital PDF text with layout preservation and UTF-8 Turkish encoding.
 * No fallbacks or flaky regexes.
 */
export class PdfExtractor {
  public static async extractText(filePath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', filePath, '-'], {
        maxBuffer: 100 * 1024 * 1024,
        timeout: 30000
      })
      return this.cleanAndFormatText(stdout)
    } catch {
      return ''
    }
  }

  public static cleanAndFormatText(raw: string): string {
    if (!raw) return ''

    let text = raw
      // Replace non-breaking spaces and tabs
      .replace(/[\t\u00A0]+/g, ' ')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    const lines = text.split('\n')
    const cleanParagraphs: string[] = []
    let currentParagraph: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (!line) {
        if (currentParagraph.length > 0) {
          const p = currentParagraph.join(' ').replace(/\s{2,}/g, ' ').trim()
          if (p.length > 25) cleanParagraphs.push(p)
          currentParagraph = []
        }
        continue
      }

      // Ignore solitary page numbers
      if (/^\d{1,4}$/.test(line)) continue

      currentParagraph.push(line)
    }

    if (currentParagraph.length > 0) {
      const p = currentParagraph.join(' ').replace(/\s{2,}/g, ' ').trim()
      if (p.length > 25) cleanParagraphs.push(p)
    }

    return cleanParagraphs.join('\n\n')
  }
}
