import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export const name = 'toolResultPruner'

export interface PrunerConfig {
  thresholdChars?: number
  headChars?: number
  tailChars?: number
}

export class ToolResultPrunerService extends Service {
  declare ctx: Context
  public config: Required<PrunerConfig>

  constructor(ctx: Context, config?: PrunerConfig) {
    super(ctx, 'toolResultPruner')
    this.config = {
      thresholdChars: config?.thresholdChars ?? 4000,
      headChars: config?.headChars ?? 1400,
      tailChars: config?.tailChars ?? 1400
    }
  }

  /**
   * Prunes overly long tool outputs preserving head, tail, and prune marker
   */
  public prune(text: string): { text: string; pruned: boolean; originalLength: number } {
    if (!text || text.length <= this.config.thresholdChars) {
      return { text, pruned: false, originalLength: text?.length || 0 }
    }

    const { headChars, tailChars } = this.config
    const head = text.slice(0, headChars)
    const tail = text.slice(text.length - tailChars)
    const prunedCount = text.length - (headChars + tailChars)

    const prunedText = `${head}\n\n... [⚠️ Çıktı çok uzun olduğu için ${prunedCount} karakter bağlam koruması amacıyla budandı / Output truncated] ...\n\n${tail}`

    return {
      text: prunedText,
      pruned: true,
      originalLength: text.length
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('toolResultPruner', new ToolResultPrunerService(ctx))
}
