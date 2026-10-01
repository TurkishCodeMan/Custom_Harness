import { defineMiddleware } from '@custom-harness/agent-middleware'

/**
 * tool-guard (beforeTool, order: -100)
 *
 * Savunma derinliği (Defense-in-Depth) çalıştırma koruması:
 * Modelin yetkisiz bir aracı çalıştırmasını engeller.
 * Sadece preset enabledTools beyaz listesini (whitelist) denetler.
 */
export const toolGuardMiddleware = defineMiddleware({
  name: 'tool-guard',
  order: -100, // En başta çalışır
  beforeTool: async (ctx, next) => {
    const preset = ctx.preset as any
    if (!preset) {
      await next()
      return
    }

    // İzin verilen araçlar (Whitelist) kontrolü: Sadece açıkça enabledTools listesinde olan araçlar çalıştırılabilir
    const allowed = preset.enabledTools ?? preset.allowed_tools
    if (!Array.isArray(allowed) || !allowed.includes(ctx.toolName)) {
      ctx.skipExecution = true
      ctx.customOutput = `[Erişim Engeli / Tool Guard]: '${ctx.toolName}' aracı '${preset.name || preset.id}' rolü için yetkilendirilmemiştir. İzin verilen araçlar: ${Array.isArray(allowed) && allowed.length > 0 ? allowed.join(', ') : 'hiçbiri'}`
      return
    }

    await next()
  }
})
