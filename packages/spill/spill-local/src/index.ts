import type { Context } from '@custom-harness/core-context'
import { SpillService, type SpillEntry, type ProcessOutputResult } from '@custom-harness/spill'

export interface LocalSpillConfig {
  thresholdChars?: number
  previewLimit?: number
}

export class LocalSpillService extends SpillService {
  private storeMap = new Map<string, SpillEntry>()
  public thresholdChars: number
  public previewLimit: number

  constructor(ctx: Context, config?: LocalSpillConfig) {
    super(ctx)
    this.thresholdChars = config?.thresholdChars ?? 12000
    this.previewLimit = config?.previewLimit ?? 3000
  }

  public async store(content: string, previewLimit: number = this.previewLimit): Promise<{ id: string; preview: string; length: number }> {
    const id = `spill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const preview = content.length > previewLimit ? content.slice(0, previewLimit) + '\n... [truncated / kesildi]' : content
    
    this.storeMap.set(id, {
      id,
      content,
      length: content.length,
      preview,
      createdAt: Date.now()
    })

    return {
      id,
      preview,
      length: content.length
    }
  }

  public async get(id: string): Promise<string | undefined> {
    return this.storeMap.get(id)?.content
  }

  public async getPreview(id: string): Promise<string | undefined> {
    return this.storeMap.get(id)?.preview
  }

  public async processOutput(output: any, sessionId?: string, toolName?: string): Promise<ProcessOutputResult> {
    const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
    const length = text?.length || 0

    if (length <= this.thresholdChars) {
      return {
        modelText: text,
        spilled: false,
        length
      }
    }

    const { id, preview } = await this.store(text, this.previewLimit)
    const modelText = `${preview}\n\n... [⚠️ Çıktı çok uzun (${length} karakter) olduğu için taşma deposuna (SpillStore ID: ${id}) aktarıldı / Output exceeded threshold and spilled to storage]`

    return {
      modelText,
      spilled: true,
      spillId: id,
      length
    }
  }
}

export const name = 'spill-local'

export function apply(ctx: Context) {
  ctx.set('spillStore', new LocalSpillService(ctx))
}

export default LocalSpillService
