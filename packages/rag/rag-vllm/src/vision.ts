import fs from 'node:fs/promises'
import path from 'node:path'

export interface VllmVisionOptions {
  endpoint?: string
  model?: string
  apiKey?: string
  timeoutMs?: number
}

export class VllmVisionOcrClient {
  private endpoint: string
  private model: string
  private apiKey?: string
  private timeoutMs: number

  constructor(options?: VllmVisionOptions) {
    this.endpoint = (options?.endpoint || process.env.VLLM_VISION_URL || 'http://localhost:8010').replace(/\/+$/, '')
    this.model = options?.model || 'zai-org/GLM-OCR'
    this.apiKey = options?.apiKey
    this.timeoutMs = options?.timeoutMs || 120000
  }

  public updateConfig(options: Partial<VllmVisionOptions>) {
    if (options.endpoint) this.endpoint = options.endpoint.replace(/\/+$/, '')
    if (options.model) this.model = options.model
    if (options.apiKey !== undefined) this.apiKey = options.apiKey
  }

  /**
   * Extracts text from an image or scanned PDF file directly via GLM-OCR microservice on port 8010.
   */
  public async extractTextFromImage(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const mimeType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    
    const fileBuffer = await fs.readFile(filePath)
    const baseUrl = this.endpoint.replace(/\/v1\/?$/, '')
    const processUrl = `${baseUrl}/process`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const formData = new FormData()
      const blob = new Blob([fileBuffer], { type: mimeType })
      formData.append('file', blob, path.basename(filePath))

      const res = await fetch(processUrl, {
        method: 'POST',
        headers: {
          'x-filename': path.basename(filePath)
        },
        body: formData,
        signal: controller.signal
      })

      if (res.ok) {
        const data: any = await res.json()
        if (Array.isArray(data) && data[0]?.page_content) {
          const text = data.map((d: any) => d.page_content).join('\n').trim()
          if (text && text !== 'No file data found' && text !== 'vLLM process not started') {
            return text
          }
        }
      }
      return ''
    } catch (e: any) {
      console.warn(`[OCR:Process] 8010 /process error for "${filePath}":`, e.message)
      return ''
    } finally {
      clearTimeout(timer)
    }
  }
}
