import type { Context } from '@custom-harness/core-context'
import type { AgentRunOptions, ProviderModelResolution } from './types.js'

/**
 * Resolves the LLM provider and model based on options and available settings.
 * Fails fast with descriptive errors if a requested model or provider does not exist.
 */
export function resolveProviderAndModel(
  options: AgentRunOptions,
  settingsService: any,
  activePreset?: any
): ProviderModelResolution {
  if (!settingsService) {
    throw new Error("[AgentService] 'settings' servisi Context üzerinde bulunamadı.")
  }

  const settings = settingsService.getSettings ? settingsService.getSettings() : settingsService
  const providers = settings?.providers || {}

  let provider: any = undefined
  let model: any = undefined

  const requestedProviderId = options.providerId || activePreset?.providerId
  const requestedModelId = options.modelId || activePreset?.modelId

  // 1. If explicit providerId requested and exists in configuration
  if (requestedProviderId && providers[requestedProviderId]) {
    const targetProvider = providers[requestedProviderId]
    if (requestedModelId) {
      const requested = requestedModelId.trim()
      const found = targetProvider.models?.find((m: any) =>
        m.id === requested ||
        m.name === requested ||
        m.id?.toLowerCase() === requested.toLowerCase() ||
        m.name?.toLowerCase() === requested.toLowerCase() ||
        m.id?.toLowerCase()?.includes(requested.toLowerCase()) ||
        m.name?.toLowerCase()?.includes(requested.toLowerCase())
      )
      if (found) {
        provider = targetProvider
        model = found
      }
    } else {
      provider = targetProvider
      model = targetProvider.models?.[0]
    }
  }

  // 2. If provider not resolved yet and explicit modelId requested
  if (!provider && requestedModelId) {
    const requested = requestedModelId.trim()
    const activeProvider = settingsService.getActiveProvider
      ? settingsService.getActiveProvider()
      : (settings.defaultProvider ? providers[settings.defaultProvider] : undefined)

    if (activeProvider) {
      const found = activeProvider.models?.find((m: any) =>
        m.id === requested ||
        m.name === requested ||
        m.id?.toLowerCase() === requested.toLowerCase() ||
        m.name?.toLowerCase() === requested.toLowerCase() ||
        m.id?.toLowerCase()?.includes(requested.toLowerCase()) ||
        m.name?.toLowerCase()?.includes(requested.toLowerCase())
      )
      if (found) {
        provider = activeProvider
        model = found
      }
    }

    if (!provider) {
      for (const [, pConfig] of Object.entries<any>(providers)) {
        const found = pConfig.models?.find((m: any) =>
          m.id === requested ||
          m.name === requested ||
          m.id?.toLowerCase() === requested.toLowerCase() ||
          m.name?.toLowerCase() === requested.toLowerCase() ||
          m.id?.toLowerCase()?.includes(requested.toLowerCase()) ||
          m.name?.toLowerCase()?.includes(requested.toLowerCase())
        )
        if (found) {
          provider = pConfig
          model = found
          break
        }
      }
    }

    if (!model) {
      throw new Error(`[AgentService] İstenen model ('${requestedModelId}') konfigüre edilmiş hiçbir sağlayıcıda (provider) bulunamadı.`)
    }
  }

  // 3. If providerId specified but not resolved yet
  if (!provider && requestedProviderId) {
    provider = providers[requestedProviderId]
    if (!provider) {
      throw new Error(`[AgentService] İstenen sağlayıcı ('${requestedProviderId}') konfigürasyonda bulunamadı.`)
    }
  }

  // 3. Fallback to active provider and model from settings
  if (!provider) {
    provider = settingsService.getActiveProvider ? settingsService.getActiveProvider() : undefined
  }

  if (!model) {
    model = settingsService.getActiveModel ? settingsService.getActiveModel() : undefined
  }

  if (!provider) {
    throw new Error('[AgentService] Aktif LLM sağlayıcısı (provider) bulunamadı veya tanımlı değil.')
  }

  if (!model) {
    throw new Error('[AgentService] Aktif LLM modeli bulunamadı veya tanımlı değil.')
  }

  return { provider, model }
}

/**
 * Resolves the active preset configuration for the given user and session.
 * Fails fast if an explicitly requested preset cannot be resolved.
 */
export function resolveActivePreset(
  options: AgentRunOptions,
  session: any,
  settings: any,
  userSettings: any,
  ctx: Context,
  userId?: string
): any {
  const presetId =
    options.presetId ||
    (typeof options.preset === 'string' ? options.preset : options.preset?.id) ||
    userSettings?.defaultPreset ||
    settings?.defaultPreset

  if (presetId) {
    const fromPresets = ctx.agentPresets?.get?.(presetId, userId)
    if (fromPresets) return fromPresets

    const fromSettings = ctx.settings?.getPreset?.(presetId)
    if (fromSettings) return fromSettings

    const active = ctx.agentPresets?.getActive?.(userId) ?? ctx.settings?.getActivePreset?.()
    if (active && (active.id === presetId || !presetId)) return active

    throw new Error(`[AgentService] İstenen preset ('${presetId}') tanımlı değil veya bulunamadı.`)
  }

  const fallbackPreset = ctx.agentPresets?.getActive?.(userId) ?? ctx.settings?.getActivePreset?.()
  return fallbackPreset
}
