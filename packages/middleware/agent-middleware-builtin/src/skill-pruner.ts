import type { ChatMessage } from '@custom-harness/core-types'
import { defineMiddleware } from '@custom-harness/agent-middleware'

/**
 * skill-pruner (beforeChat, order: -100)
 *
 * Replaces historical skill tool-result messages with a short placeholder.
 * Prevents large skill documentation from re-consuming context budget on
 * subsequent turns once the skill has already been applied.
 */
export const skillPrunerMiddleware = defineMiddleware({
  name: 'skill-pruner',
  order: -100,
  beforeChat: async (ctx, next) => {
    ctx.messages = ctx.messages.map((msg: ChatMessage) => {
      if (msg.role !== 'tool' || msg.name !== 'skill' || typeof msg.content !== 'string') {
        return msg
      }

      // Extract skill label from common heading patterns
      const nameMatch =
        msg.content.match(/###\s*(?:⚡\s*)?(?:AKTİF BECERİ TALİMATLARI.*?\(|Beceri Talimatları \()([^)]+)\)/) ||
        msg.content.match(/Far Trans Demo DB SQL|pandas-plotly-sklearn-ml-models-skill/) ||
        msg.content.match(/\(([^)]+)\)/)

      const skillLabel = nameMatch ? (nameMatch[1] ?? nameMatch[0]) : 'skill'

      return {
        ...msg,
        content: `[Skill '${skillLabel}' önceki adımda yüklendi ve bağlantı/şema bilgileri uygulandı. Tekrar gerekirse: skill(skillName: '${skillLabel}')]`
      }
    })

    await next()
  }
})
