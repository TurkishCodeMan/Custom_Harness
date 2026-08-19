export type LspProviderId = string & { readonly __brand: 'LspProviderId' }

export function LspProviderId(id: string): LspProviderId {
  if (!id || typeof id !== 'string') {
    throw new Error('LspProviderId must be a non-empty string')
  }
  return id as LspProviderId
}
