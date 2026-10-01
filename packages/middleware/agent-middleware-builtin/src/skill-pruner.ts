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
    // Mevcut konuşma bağlamındaki son kullanıcı mesajının indeksini bul
    let lastUserIndex = -1
    for (let i = ctx.messages.length - 1; i >= 0; i--) {
      if (ctx.messages[i]?.role === 'user') {
        lastUserIndex = i
        break
      }
    }

    // Tüm geçmişteki en son skill çağrısının indeksini bul
    let lastSkillIndex = -1
    for (let i = ctx.messages.length - 1; i >= 0; i--) {
      const m = ctx.messages[i]
      if (m?.role === 'tool' && (m.name === 'skill' || (m as any).toolName === 'skill')) {
        lastSkillIndex = i
        break
      }
    }

    ctx.messages = ctx.messages.map((msg: ChatMessage, idx: number) => {
      if (msg.role !== 'tool' || msg.name !== 'skill' || typeof msg.content !== 'string') {
        return msg
      }

      // 1. KURAL: Son turda / mevcut kullanıcı isteği bağlamında çağrılan veya en son aktif olan skill'i ASLA budama
      const isCurrentContext = lastUserIndex !== -1 && idx > lastUserIndex
      const isLatestSkillCall = idx === lastSkillIndex
      if (isCurrentContext || isLatestSkillCall) {
        return msg
      }

      // Zaten budanmış bir mesajsa tekrar işleme sokma
      if (msg.content.startsWith('[Skill ')) {
        return msg
      }

      // Extract skill label:
      // A) Öncelikle assistant'ın tool_calls argümanlarından skill adını al
      let skillLabel = ''
      if (msg.tool_call_id) {
        for (const m of ctx.messages) {
          if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
            const tc = m.tool_calls.find((c: any) => c.id === msg.tool_call_id)
            if (tc?.function?.arguments) {
              try {
                const args = typeof tc.function.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : tc.function.arguments
                skillLabel = args.skillName || args.skillId || args.name || ''
              } catch {
                // ignore json parse error
              }
            }
          }
        }
      }

      // B) Heading pattern'den beceri adını çıkart (Örn: "### ⚡ AKTİF BECERİ TALİMATLARI: (invoice-review-skill)")
      if (!skillLabel) {
        const nameMatch = msg.content.match(
          /###\s*(?:⚡\s*)?(?:AKTİF BECERİ TALİMATLARI.*?\(|Beceri Talimatları \()([^)]+)\)/i
        )
        if (nameMatch && nameMatch[1]) {
          skillLabel = nameMatch[1].trim()
        }
      }

      // NOT: /\(([^)]+)\)/ fallback'i kaldırıldı (karakter sayısı veya boyut bilgisini beceri adı sanmasın)
      if (!skillLabel || skillLabel.toLowerCase().includes('karakter')) {
        skillLabel = 'skill'
      }

      return {
        ...msg,
        content: `[Skill '${skillLabel}' önceki adımda yüklendi ve bağlantı/şema bilgileri uygulandı. Tekrar gerekirse: skill(skillName: '${skillLabel}')]`
      }
    })

    await next()
  }
})
