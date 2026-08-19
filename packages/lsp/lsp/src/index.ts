import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { LspProvider, LspQueryRequest, LspQueryResult, LspService } from './types.js'
import path from 'node:path'

export { LspProviderId } from './brand.js'
export type * from './types.js'

export class LspError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'LspError'
  }
}

export function finalExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return ext
}

export const name = 'lsp'

export class LspServiceImpl extends Service implements LspService {
  private providers = new Map<string, LspProvider>()
  private extMap = new Map<string, LspProvider>()

  constructor(ctx: Context) {
    super(ctx, 'lsp')
  }

  public registerProvider(provider: LspProvider): () => void {
    if (this.providers.has(provider.id)) {
      throw new LspError(`LSP provider already registered: ${provider.id}`, 'LSP_CONFLICT')
    }

    this.providers.set(provider.id, provider)
    for (const ext of provider.extensions.keys()) {
      this.extMap.set(ext.toLowerCase(), provider)
    }

    return () => {
      this.providers.delete(provider.id)
      for (const ext of provider.extensions.keys()) {
        if (this.extMap.get(ext.toLowerCase()) === provider) {
          this.extMap.delete(ext.toLowerCase())
        }
      }
    }
  }

  public async query(request: LspQueryRequest): Promise<LspQueryResult> {
    const ext = finalExtension(request.filePath)
    const provider = this.extMap.get(ext)

    if (!provider) {
      throw new LspError(`No LSP provider registered for extension '${ext}'`, 'LSP_UNAVAILABLE')
    }

    const languageId = provider.extensions.get(ext) || 'plaintext'
    return provider.query({ ...request, languageId })
  }
}

export function apply(ctx: Context) {
  ctx.set('lsp', new LspServiceImpl(ctx))
}

export default LspServiceImpl
