import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-rag'
export const inject = ['tools', 'rag']

export function apply(ctx: Context) {
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
          const results = await ctx.rag.search({
            query,
            topK: topK || 5,
            filePathPrefix
          })

          if (results.length === 0) {
            return `No semantic matches found in RAG index for query: "${query}"`
          }

          const formatted = results.map((r, i) => {
            const sim = r.similarity !== undefined ? (r.similarity * 100).toFixed(1) + '%' : 'N/A'
            return `### [Sonuç ${i + 1}] 📄 ${r.sourcePath} (Benzerlik Skoru: ${sim})\n\n${r.content}`
          }).join('\n\n---\n\n')

          return `Semantik RAG aramasında "${query}" için ${results.length} ilgili içerik bulundu:\n\n${formatted}`
        } catch (err: any) {
          return `RAG arama hatası: ${err.message}`
        }
      }
    })
  )

  // 2. Tool: add_rag_folder
  ctx.tools.register(
    defineTool({
      name: 'add_rag_folder',
      description: 'Recursively scans, parses (including OCR on images), generates vLLM embeddings, and indexes a folder into pgvector.',
      parameters: {
        type: 'object',
        properties: {
          folderPath: {
            type: 'string',
            description: 'Absolute or relative folder path to index.'
          }
        },
        required: ['folderPath']
      },
      async execute({ folderPath }: { folderPath: string }) {
        if (!ctx.rag) {
          return 'RAG service is not available.'
        }

        try {
          const res = await ctx.rag.addAndIndexFolder(folderPath)
          return `Successfully indexed folder: "${res.path}" (${res.fileCount} files, ${res.chunkCount} vector chunks stored).`
        } catch (err: any) {
          return `Failed to index folder "${folderPath}": ${err.message}`
        }
      }
    })
  )

  // 3. Tool: list_rag_sources
  ctx.tools.register(
    defineTool({
      name: 'list_rag_sources',
      description: 'Lists all knowledge base folders currently indexed and available in the pgvector RAG system.',
      parameters: {
        type: 'object',
        properties: {}
      },
      async execute() {
        if (!ctx.rag) {
          return 'RAG service is not available.'
        }

        try {
          const status = await ctx.rag.getStatus()
          if (status.sources.length === 0) {
            return 'No folders have been indexed in the RAG knowledge base yet.'
          }

          const list = status.sources.map(s => {
            const dateStr = new Date(s.lastIndexedAt).toLocaleString()
            return `- **${s.path}**: ${s.fileCount} files, ${s.chunkCount} chunks [Status: ${s.status}] (Last indexed: ${dateStr})`
          }).join('\n')

          return `### Indexed RAG Knowledge Sources (${status.totalDocumentsCount} total docs, ${status.totalChunksCount} chunks):\n${list}`
        } catch (err: any) {
          return `Error listing RAG sources: ${err.message}`
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
          const results = await ctx.rag.searchImages({
            textQuery: query,
            imagePath,
            topK: topK || 5
          })

          if (results.length === 0) {
            return `No matching images found for query: "${query || imagePath}"`
          }

          const formatted = results.map((r, i) => {
            const sim = (r.similarity * 100).toFixed(1) + '%'
            const ocr = r.ocrText ? `\n> **OCR Text:** ${r.ocrText.slice(0, 150)}...` : ''
            return `${i + 1}. 🖼️ **${r.filePath}** (Visual Similarity: ${sim})${ocr}`
          }).join('\n\n')

          return `### Found ${results.length} relevant images:\n\n${formatted}`
        } catch (err: any) {
          return `Image search error: ${err.message}`
        }
      }
    })
  )
}

