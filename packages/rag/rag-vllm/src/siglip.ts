import fs from 'node:fs/promises'
import type { ImageSearchResult } from '@custom-harness/rag'

export interface SigLipConfig {
  endpoint?: string
  timeoutMs?: number
}

export class SigLipClient {
  private endpoint: string
  private timeoutMs: number

  constructor(config: SigLipConfig = {}) {
    this.endpoint = config.endpoint || 'http://localhost:8011'
    this.timeoutMs = config.timeoutMs || 30000
  }

  public setEndpoint(endpoint: string) {
    this.endpoint = endpoint
  }

  /**
   * Extracts a 768-dimensional SigLIP visual feature vector from a local image file.
   */
  public async extractImageEmbedding(filePath: string): Promise<number[] | null> {
    try {
      const buffer = await fs.readFile(filePath)
      const imageBase64 = buffer.toString('base64')

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(`${this.endpoint}/api/v1/embed/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64 }),
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        throw new Error(`SigLIP embed image failed (${res.status}): ${errorText}`)
      }

      const data = await res.json()
      if (Array.isArray(data.embedding)) {
        return data.embedding
      }
      return null
    } catch (err: any) {
      console.warn(`[SigLIP] Extract image embedding failed for "${filePath}":`, err.message)
      return null
    }
  }

  /**
   * Extracts a 768-dimensional SigLIP text feature vector from a natural language string.
   */
  public async extractTextEmbedding(text: string): Promise<number[] | null> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(`${this.endpoint}/api/v1/embed/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        throw new Error(`SigLIP embed text failed (${res.status}): ${errorText}`)
      }

      const data = await res.json()
      if (Array.isArray(data.embedding)) {
        return data.embedding
      }
      return null
    } catch (err: any) {
      console.warn(`[SigLIP] Extract text embedding failed for "${text}":`, err.message)
      return null
    }
  }

  /**
   * Reads a local image file, encodes to base64, and indexes it in SigLIP service.
   */
  public async indexImage(filePath: string, ocrText?: string): Promise<{ status: string; filepath: string }> {
    try {
      const buffer = await fs.readFile(filePath)
      const imageBase64 = buffer.toString('base64')

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(`${this.endpoint}/api/v1/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: filePath,
          image_base64: imageBase64,
          ocr_text: ocrText || null
        }),
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        throw new Error(`SigLIP index failed (${res.status}): ${errorText}`)
      }

      return await res.json()
    } catch (err: any) {
      console.warn(`[SigLIP] Indexing image failed for "${filePath}":`, err.message)
      return { status: 'error', filepath: filePath }
    }
  }

  /**
   * Cross-modal semantic search: Searches for images using a natural language text query.
   */
  public async searchByText(query: string, topK: number = 5): Promise<ImageSearchResult[]> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      // Try /api/v1/search_text (SigLIP service)
      const res = await fetch(`${this.endpoint}/api/v1/search_text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          top_k: topK
        }),
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        throw new Error(`SigLIP text search failed (${res.status}): ${errorText}`)
      }

      const data = await res.json()
      const list = Array.isArray(data) ? data : (data.results || [])

      return list.map((item: any) => ({
        filePath: item.filepath,
        similarity: typeof item.similarity === 'number' ? item.similarity : 0,
        ocrText: item.ocr_text || undefined,
        rrfScore: item.rrf_score || undefined
      }))
    } catch (err: any) {
      console.warn('[SigLIP] searchByText error:', err.message)
      return []
    }
  }

  /**
   * Visual image-to-image similarity search: Searches for images similar to an input image.
   */
  public async searchByImage(imageFilePath: string, ocrText?: string, topK: number = 5): Promise<ImageSearchResult[]> {
    try {
      const buffer = await fs.readFile(imageFilePath)
      const imageBase64 = buffer.toString('base64')

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(`${this.endpoint}/api/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          ocr_text: ocrText || null,
          top_k: topK
        }),
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        throw new Error(`SigLIP visual search failed (${res.status}): ${errorText}`)
      }

      const data = await res.json()
      const list = Array.isArray(data) ? data : (data.results || [])

      return list.map((item: any) => ({
        filePath: item.filepath,
        similarity: typeof item.similarity === 'number' ? item.similarity : 0,
        ocrText: item.ocr_text || undefined,
        rrfScore: item.rrf_score || undefined
      }))
    } catch (err: any) {
      console.warn('[SigLIP] searchByImage error:', err.message)
      return []
    }
  }

  /**
   * Removes an indexed image from SigLIP service.
   */
  public async deleteImage(filePath: string): Promise<void> {
    try {
      await fetch(`${this.endpoint}/api/v1/delete?filepath=${encodeURIComponent(filePath)}`, {
        method: 'DELETE'
      })
    } catch (err: any) {
      console.warn(`[SigLIP] Delete image failed for "${filePath}":`, err.message)
    }
  }
}
