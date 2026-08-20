export interface SplitterOptions {
  chunkSize?: number
  chunkOverlap?: number
}

export class TextSplitter {
  private chunkSize: number
  private chunkOverlap: number

  constructor(options?: SplitterOptions) {
    this.chunkSize = options?.chunkSize || 1000
    this.chunkOverlap = options?.chunkOverlap || 150
  }

  /**
   * Splits code or markdown text into structured chunks respecting line/block boundaries.
   */
  public splitText(text: string, filePath?: string): string[] {
    if (!text || text.trim().length === 0) return []
    if (text.length <= this.chunkSize) return [text.trim()]

    const lines = text.split('\n')
    const chunks: string[] = []
    let currentChunkLines: string[] = []
    let currentLength = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLen = line.length + 1

      if (currentLength + lineLen > this.chunkSize && currentChunkLines.length > 0) {
        const chunkText = currentChunkLines.join('\n').trim()
        if (chunkText.length > 0) {
          chunks.push(chunkText)
        }

        // Calculate overlap lines
        let overlapLength = 0
        const overlapLines: string[] = []
        for (let j = currentChunkLines.length - 1; j >= 0; j--) {
          if (overlapLength + currentChunkLines[j].length + 1 <= this.chunkOverlap) {
            overlapLines.unshift(currentChunkLines[j])
            overlapLength += currentChunkLines[j].length + 1
          } else {
            break
          }
        }

        currentChunkLines = [...overlapLines, line]
        currentLength = overlapLength + lineLen
      } else {
        currentChunkLines.push(line)
        currentLength += lineLen
      }
    }

    const minChunkLength = 40

    if (currentChunkLines.length > 0) {
      const lastChunk = currentChunkLines.join('\n').trim()
      if (lastChunk.length >= minChunkLength) {
        chunks.push(lastChunk)
      }
    }

    return chunks.filter(c => c.length >= minChunkLength)
  }
}
