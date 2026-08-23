import type { ChatMessage } from '@custom-harness/core-types'
import { defineMiddleware } from '@custom-harness/agent-middleware'

/**
 * skill-reminder (beforeChat, order: -80, presets: ['test'])
 *
 * Active only for the Analysis SQL Agent preset.
 *
 * On the FIRST turn of every conversation, injects a hidden `system` note into
 * the message history that lists every active skill the agent can load.
 * This prevents the model from hallucinating tool names or missing relevant skills.
 *
 * The injected message is tagged so skill-pruner will NOT accidentally prune it.
 *
 * Format injected into ctx.messages:
 *   { role: 'system', content: '[SKILL_REMINDER]: ...' }
 */
export const skillReminderMiddleware = defineMiddleware({
  name: 'skill-reminder',
  order: -80, // After skill-pruner (-100) and tool-filter (-90), before sending to LLM
  presets: ['test'],
  beforeChat: async (ctx, next) => {
    const skills = ctx.availableSkills ?? []
    if (skills.length === 0) {
      await next()
      return
    }


    const skillList = skills
      .map(s => `  • **${s.name}** (yüklemek için: skill(skillName: '${s.id}'))\n    ${s.description}`)
      .join('\n')

    const reminderMsg: ChatMessage = {
      role: 'system',
      content:
        '[SKILL_REMINDER / ZORUNLU BAŞLANGIÇ KONTROLÜ]:\n' +
        'Yeni bir konuşma başladı. Kullanıcının isteğini yerine getirmeden önce aşağıdaki aktif becerileri incele:\n\n' +
        skillList +
        '\n\n' +
        '⚡ KURAL: Kullanıcının isteği bu becerilerden herhangi biriyle ilgiliyse, ' +
        'ÖNCE o beceriyi yükle (skill aracını kullan), ardından talimatları uygula. ' +
        'Beceri yüklenmeden SQL sorgusu yazma, model kurma veya bağlantı denemesi yapma.'
    }

    // Push to the beginning of messages so it appears right before the user's first message
    ctx.messages = [reminderMsg, ...ctx.messages]

    await next()
  }
})
