import fs from 'node:fs'
import path from 'node:path'
import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-rag'
export const inject = ['tools', 'rag', 'session']

export function apply(ctx: Context) {
  const getTenantContext = () => {
    const activeSession = (ctx as any).session?.getActiveSession?.()
    const userId = activeSession?.userId || 'user_admin'
    const isAdmin = userId === 'user_admin' || userId === 'admin'
    return { userId, isAdmin }
  }

  // 1. Tool: query_rag
  ctx.tools.register(
    defineTool({
      name: 'query_rag',
      description: 'Performs semantic vector similarity search across indexed code repositories, documents, and vision OCR knowledge bases using pgvector.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query or code snippet to search for semantically.'
          },
          topK: {
            type: 'number',
            description: 'Maximum number of relevant chunks to retrieve (default: 5).'
          },
          filePathPrefix: {
            type: 'string',
            description: 'Optional subfolder or file path prefix filter.'
          }
        },
        required: ['query']
      },
      async execute({ query, topK, filePathPrefix }: { query: string; topK?: number; filePathPrefix?: string }) {
        if (!ctx.rag) {
          return 'RAG service is not available.'
        }

        try {
          const { userId, isAdmin } = getTenantContext()
          const results = await ctx.rag.search({
            query,
            topK: topK || 5,
            filePathPrefix
          }, userId, isAdmin)

          if (results.length === 0) {
            return `No relevant information found for query: "${query}"`
          }

          const formatted = results.map((r, i) => {
            const sim = r.similarity !== undefined ? (r.similarity * 100).toFixed(1) + '%' : 'N/A'
            const docInfo = r.sourcePath || r.documentId || 'Unknown Document'
            return `### Match ${i + 1} (${sim} match) - ${docInfo}\n${r.content}`
          }).join('\n\n---\n\n')

          return `Found ${results.length} relevant passages:\n\n${formatted}`
        } catch (err: any) {
          return `RAG search error: ${err.message}`
        }
      }
    })
  )

  // 2. Tool: get_rag_status
  ctx.tools.register(
    defineTool({
      name: 'get_rag_status',
      description: 'Retrieves current pgvector database statistics, indexed folder paths, and knowledge base document counts.',
      parameters: {
        type: 'object',
        properties: {}
      },
      async execute() {
        if (!ctx.rag) {
          return 'RAG service is not available.'
        }

        try {
          const { userId, isAdmin } = getTenantContext()
          const status = await ctx.rag.getStatus(userId, isAdmin)
          const sources = status.sources.map(s => ` - 📁 ${s.path} (${s.fileCount} docs, ${s.chunkCount} chunks)`).join('\n')
          return `### RAG Status:\n- Total Documents: ${status.totalDocumentsCount}\n- Total Vectors: ${status.totalChunksCount}\n- Indexed Sources:\n${sources || ' (No sources indexed yet)'}`
        } catch (err: any) {
          return `Failed to get RAG status: ${err.message}`
        }
      }
    })
  )

  // 3. Tool: index_folder
  ctx.tools.register(
    defineTool({
      name: 'index_folder',
      description: 'Indexes a local workspace folder into pgvector knowledge base for semantic search, code understanding, and OCR visual retrieval.',
      parameters: {
        type: 'object',
        properties: {
          folderPath: {
            type: 'string',
            description: 'Absolute path to the folder on the filesystem to index.'
          },
          maxFiles: {
            type: 'number',
            description: 'Optional maximum number of files to index.'
          }
        },
        required: ['folderPath']
      },
      async execute({ folderPath, maxFiles }: { folderPath: string; maxFiles?: number }) {
        if (!ctx.rag) {
          return 'RAG service is not available.'
        }

        try {
          const { userId } = getTenantContext()
          const source = await ctx.rag.addAndIndexFolder(folderPath, maxFiles ? { maxFiles } : undefined, userId)
          return `Successfully started indexing folder: ${folderPath} (Source ID: ${source.id}). Status: ${source.status}`
        } catch (err: any) {
          return `Failed to index folder: ${err.message}`
        }
      }
    })
  )

  // 4. Tool: search_images (SigLIP Multimodal)
  ctx.tools.register(
    defineTool({
      name: 'search_images',
      description: 'Performs cross-modal semantic image and diagram search using SigLIP visual embeddings. Finds architecture charts, UI designs, and photos matching a natural language description or similar image.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language description of the image, diagram, UI screen, or chart to search for.'
          },
          imagePath: {
            type: 'string',
            description: 'Optional path to a local image to find visually similar images.'
          },
          topK: {
            type: 'number',
            description: 'Maximum number of images to return (default: 5).'
          }
        }
      },
      async execute({ query, imagePath, topK }: { query?: string; imagePath?: string; topK?: number }) {
        if (!ctx.rag) {
          return 'RAG service is not available.'
        }

        try {
          const { userId, isAdmin } = getTenantContext()
          const results = await ctx.rag.searchImages({
            textQuery: query,
            imagePath,
            topK: topK || 5
          }, userId, isAdmin)

          if (results.length > 0) {
            const formatted = results.map((r, i) => {
              const sim = (r.similarity * 100).toFixed(1) + '%'
              const ocr = r.ocrText ? `\n> **OCR Text:** ${r.ocrText.slice(0, 150)}...` : ''
              return `${i + 1}. 🖼️ **${r.filePath}** (Similarity: ${sim})${ocr}`
            }).join('\n\n')

            return `### Found ${results.length} relevant images:\n\n${formatted}`
          }

          // Fallback: search workspace and tenant uploads for image files matching keywords
          const fallbackImages: { filePath: string; similarity: number }[] = []
          const searchTerms = [
            ...(query ? query.toLowerCase().split(/[\s,.-]+/).filter(t => t.length > 2) : []),
            ...(imagePath ? [path.basename(imagePath).toLowerCase().replace(/\.[^.]+$/, '')] : [])
          ]

          const scanDirForImages = (dir: string, depth = 0) => {
            if (depth > 3 || !fs.existsSync(dir)) return
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true })
              for (const e of entries) {
                if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist') {
                  scanDirForImages(path.join(dir, e.name), depth + 1)
                } else if (e.isFile() && /\.(png|jpg|jpeg|webp|svg|gif|bmp)$/i.test(e.name)) {
                  const full = path.join(dir, e.name)
                  const lower = full.toLowerCase()
                  const matches = searchTerms.some(term => lower.includes(term))
                  if (matches || searchTerms.length === 0) {
                    fallbackImages.push({ filePath: full, similarity: 0.85 })
                  }
                }
              }
            } catch {}
          }

          const activeSession = (ctx as any).session?.getActiveSession?.()
          const wsDir = activeSession?.workspace || process.cwd()
          const uploadsDir = (ctx as any).session?.getUploadsDir?.(activeSession?.id, userId)

          if (uploadsDir) scanDirForImages(uploadsDir)
          if (wsDir) scanDirForImages(wsDir)

          if (fallbackImages.length > 0) {
            const uniqueMap = new Map<string, { filePath: string; similarity: number }>()
            for (const f of fallbackImages) {
              if (!uniqueMap.has(f.filePath)) uniqueMap.set(f.filePath, f)
            }
            const unique = Array.from(uniqueMap.values()).slice(0, topK || 5)
            const formatted = unique.map((fp, i) => `${i + 1}. 🖼️ **${fp.filePath}** (Yerel Dizin / Yüklemeler Eşleşmesi)`).join('\n\n')
            return `### pgvector indeksinde bulunamadı, ancak yerel çalışma alanında & yüklemelerde ${unique.length} görsel bulundu:\n\n${formatted}`
          }

          return `No matching images found for query: "${query || imagePath}". (İpucu: Görsel içeren klasörlerinizi 🧠 RAG modalından indeksleyebilirsiniz)`
        } catch (err: any) {
          return `Image search error: ${err.message}`
        }
      }
    })
  )
}
