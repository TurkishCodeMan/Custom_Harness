import type { Context } from '@custom-harness/core-context'
import type { AgentRunOptions, ProviderModelResolution } from './types.js'

/**
 * Resolves the LLM provider and model based on options and available settings.
 * Fails fast with descriptive errors if a requested model or provider does not exist.
 */
export function resolveProviderAndModel(
  options: AgentRunOptions,
  settingsService: any
): ProviderModelResolution {
  if (!settingsService) {
    throw new Error("[AgentService] 'settings' servisi Context üzerinde bulunamadı.")
  }

  const settings = settingsService.getSettings ? settingsService.getSettings() : settingsService
  const providers = settings?.providers || {}

  let provider: any = undefined
  let model: any = undefined

  // 1. If explicit modelId requested, scan across all configured providers
  if (options.modelId) {
    const requested = options.modelId.trim()
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

    if (!model) {
      throw new Error(`[AgentService] İstenen model ('${options.modelId}') konfigüre edilmiş hiçbir sağlayıcıda (provider) bulunamadı.`)
    }
  }

  // 2. If providerId specified but not resolved yet
  if (!provider && options.providerId) {
    provider = providers[options.providerId]
    if (!provider) {
      throw new Error(`[AgentService] İstenen sağlayıcı ('${options.providerId}') konfigürasyonda bulunamadı.`)
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
