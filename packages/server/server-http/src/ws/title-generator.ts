import type { Context } from '@custom-harness/core-context'
import { WebSocket } from 'ws'

export async function generateSessionTitle(
  ctx: Context,
  sessionId: string,
  userPrompt: string,
  clientWs: WebSocket
): Promise<void> {
  try {
    const settings = ctx.settings.getSettings()
    const ui = settings.ui || {}
    const titlePrompt =
      ui.defaultTitlePrompt ||
      'Sen profesyonel bir başlık üreticisisin. Verilen ilk kullanıcı iletisini analiz et ve bu sohbet konusu için net, sade, anlaşılır ve en fazla 3-5 kelimelik Türkçe bir başlık üret. Tırnak işareti, "Başlık:" ön eki veya noktalama işareti ekleme, yalnızca başlık metnini döndür.'

    const titleMessages = [
      { role: 'system' as const, content: titlePrompt },
      { role: 'user' as const, content: `Kullanıcı Mesajı: "${userPrompt.slice(0, 300)}"` }
    ]

    const activeProvider = ctx.settings.getActiveProvider()
    const activeModel = ctx.settings.getActiveModel()

    let generatedTitle = ''
    if (ctx.llm?.streamChat) {
      for await (const ev of ctx.llm.streamChat(titleMessages, {
        provider: activeProvider,
        model: activeModel,
        enableThinking: false
      })) {
        if (ev.type === 'chunk' && ev.content) {
          generatedTitle += ev.content
        }
      }
    }

    let cleanTitle = generatedTitle
      .replace(/["'`«»„“”]/g, '')
      .replace(/^başlık\s*:\s*/i, '')
      .replace(/^title\s*:\s*/i, '')
      .replace(/\n.*/g, '')
      .trim()

    if (cleanTitle.length > 45) {
      cleanTitle = cleanTitle.slice(0, 42) + '...'
    }

    if (cleanTitle && cleanTitle.length >= 2) {
      ctx.session.renameSession(sessionId, cleanTitle)
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'session_rename', sessionId, title: cleanTitle }))
      }
    }
  } catch (err: any) {
    console.warn('[AutoTitle Notice]:', err.message)
  }
}
