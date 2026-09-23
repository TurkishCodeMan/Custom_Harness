import type { Context } from '@custom-harness/core-context'
import { SpillService, type SpillEntry, type ProcessOutputResult } from '@custom-harness/spill'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash, randomBytes } from 'node:crypto'

export interface LocalSpillConfig {
  /** Threshold in characters after which output is spilled to file. Default: 4000 */
  thresholdChars?: number
  /** Number of characters to retain at the beginning of the preview. Default: 1400 */
  previewHeadChars?: number
  /** Number of characters to retain at the end of the preview. Default: 800 */
  previewTailChars?: number
  /** Root directory for spill files. Default: ~/.dsh/spills */
  root?: string
}

export class LocalSpillService extends SpillService {
  private storeMap = new Map<string, SpillEntry>()
  public thresholdChars: number
  public previewHeadChars: number
  public previewTailChars: number
  public root: string

  constructor(ctx: Context, config?: LocalSpillConfig) {
    super(ctx)
    this.thresholdChars = config?.thresholdChars ?? 4000
    this.previewHeadChars = config?.previewHeadChars ?? 1400
    this.previewTailChars = config?.previewTailChars ?? 800
    this.root = config?.root ? path.resolve(config.root) : path.join(os.homedir(), '.dsh', 'spills')
  }

  /**
   * Generates a session-scoped directory for spilled outputs
   */
  private getSessionDir(sessionId?: string): string {
    const safeSession = sessionId ? createHash('sha256').update(sessionId).digest('hex').slice(0, 12) : 'default'
    const dir = path.join(this.root, `session-${safeSession}`)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    }
    return dir
  }

  public async store(
    content: string,
    previewLimit: number = this.previewHeadChars + this.previewTailChars,
    options?: { sessionId?: string; toolName?: string }
  ): Promise<{ id: string; preview: string; length: number; filePath?: string }> {
    const id = `spill_${Date.now()}_${randomBytes(4).toString('hex')}`
    const dir = this.getSessionDir(options?.sessionId)
    const safeTool = (options?.toolName || 'output').replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `${Date.now()}_${safeTool}.txt`
    const filePath = path.join(dir, fileName)

    try {
      fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o600 })
    } catch (err: any) {
      console.error('[LocalSpillService] Failed to write spill file:', err.message)
    }

    const head = content.slice(0, this.previewHeadChars)
    const tail = content.slice(Math.max(0, content.length - this.previewTailChars))
    const preview = content.length > previewLimit
      ? `${head}\n\n... [kesildi / truncated] ...\n\n${tail}`
      : content

    const entry: SpillEntry = {
      id,
      content,
      length: content.length,
      preview,
      createdAt: Date.now(),
      filePath
    }
    this.storeMap.set(id, entry)

    return {
      id,
      preview,
      length: content.length,
      filePath
    }
  }

  public async get(id: string): Promise<string | undefined> {
    const entry = this.storeMap.get(id)
    if (entry?.content) return entry.content
    if (entry?.filePath && fs.existsSync(entry.filePath)) {
      return fs.readFileSync(entry.filePath, 'utf8')
    }
    return undefined
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

    const { id, filePath } = await this.store(text, undefined, { sessionId, toolName })
    const head = text.slice(0, this.previewHeadChars)
    const tail = text.slice(Math.max(0, text.length - this.previewTailChars))
    const omitted = length - (this.previewHeadChars + this.previewTailChars)

    const modelText = `[⚠️ ÇIKTI TAŞMASI - TAM ÇIKTI DOSYAYA AKTARILDI / TOOL OUTPUT SPILLED]
Araç çıktısı bağlam sınırını aştığı için (${length} karakter) tam metin oturum dosyasına kaydedildi:
📁 Dosya Yolu: ${filePath}

--- [ÖNİZLEME: BAŞLANGIÇ] ---
${head}

... [⚠️ ${omitted > 0 ? omitted : 0} karakter bağlam koruması amacıyla gizlendi / Output truncated] ...

--- [ÖNİZLEME: BİTİŞ] ---
${tail}
--------------------------------------------------------------------------------
💡 İPUCU: Çıktının tamamını veya aradığınız bölümlerini okumak için 'read_file' (line / offset parametreleriyle) veya 'grep_search' aracını yukarıdaki "${filePath}" dosya yolu üzerinde çalıştırabilirsiniz.`

    return {
      modelText,
      spilled: true,
      spillId: id,
      filePath,
      length
    }
  }

  /**
   * Deletes all spilled output files and memory references for a specific session.
   */
  public deleteSessionSpills(sessionId: string): void {
    if (!sessionId) return
    const dir = this.getSessionDir(sessionId)
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch (err: any) {
        console.error(`[LocalSpillService] Failed to remove session spills directory for "${sessionId}":`, err.message)
      }
    }

    const safeSession = createHash('sha256').update(sessionId).digest('hex').slice(0, 12)
    const sessionDirName = `session-${safeSession}`
    for (const [key, entry] of this.storeMap.entries()) {
      if (entry.filePath && entry.filePath.includes(sessionDirName)) {
        this.storeMap.delete(key)
      }
    }
  }
}

export const name = 'spill-local'

export function apply(ctx: Context, config?: LocalSpillConfig) {
  ctx.set('spillStore', new LocalSpillService(ctx, config))
}

export default LocalSpillService

