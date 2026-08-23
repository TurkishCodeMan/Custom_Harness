import { defineMiddleware } from '@custom-harness/agent-middleware'

export const autoSummaryMiddleware = defineMiddleware({
  name: 'auto-summary',
  order: 100, // Runs late in afterChat pipeline
  afterChat: async (ctx, next) => {
    // If assistant message content is empty (e.g. only thought was emitted, or silent tool completion on turn 1)
    const content = ctx.assistantMessage.content?.trim()
    if (!content) {
      ctx.shouldContinue = true
      ctx.continuationPrompt = '[SİSTEM BİLGİLENDİRMESİ]: Lütfen yapılan işlemleri, araç sonuçlarını veya sorunun yanıtını kullanıcıya net, anlaşılır ve doğrudan bir Türkçe mesaj olarak açıklayın.'
      return
    }
    await next()
  }

})
