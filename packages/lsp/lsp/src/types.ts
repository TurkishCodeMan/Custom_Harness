import type { LspProviderId } from './brand.js'

export type LspOperation = 'goToDefinition' | 'findReferences' | 'goToImplementation' | 'hover'

export interface LspPosition {
  readonly line: number
  readonly character: number
}

export interface LspRange {
  readonly start: LspPosition
  readonly end: LspPosition
}

export interface LspQueryRequest {
  readonly operation: LspOperation
  readonly filePath: string
  readonly position: LspPosition
  readonly workspaceRoot: string
}

export interface LspProviderQuery extends LspQueryRequest {
  readonly languageId: string
}

export interface LspLocation {
  readonly uri: string
  readonly range: LspRange
}

export interface LspHover {
  readonly contents: string
  readonly range?: LspRange
}

export type LspQueryResult =
  | { readonly operation: 'goToDefinition'; readonly locations: readonly LspLocation[] }
  | { readonly operation: 'findReferences'; readonly locations: readonly LspLocation[] }
  | { readonly operation: 'goToImplementation'; readonly locations: readonly LspLocation[] }
  | { readonly operation: 'hover'; readonly hover: LspHover | null }

export interface LspProvider {
  readonly id: LspProviderId
  readonly extensions: ReadonlyMap<string, string>
  query(request: LspProviderQuery): Promise<LspQueryResult>
}

export interface LspService {
  registerProvider(provider: LspProvider): () => void
  query(request: LspQueryRequest): Promise<LspQueryResult>
}
