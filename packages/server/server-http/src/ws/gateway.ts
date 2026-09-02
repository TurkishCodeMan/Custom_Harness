import type { Context } from '@custom-harness/core-context'
import { WebSocketServer, WebSocket } from 'ws'
import type http from 'node:http'
import path from 'node:path'
import { generateSessionTitle } from './title-generator.js'

export function setupWebSocketGateway(ctx: Context, server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server })
  wss.on('error', () => {})

  const activeRuns = new Map<WebSocket, AbortController>()
  const pendingQuestions = new Map<string, (ans: any) => void>()

  // Register user questions provider
  if (ctx.userQuestions?.registerProvider) {
    ctx.userQuestions.registerProvider({
      ask: (request) => {
        const reqId = `uq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        return new Promise((resolve) => {
          pendingQuestions.set(reqId, resolve)

          let sent = false
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: 'user_question_request',
                  id: reqId,
                  questions: request.questions
                })
              )
              sent = true
            }
          }

          if (!sent) {
            pendingQuestions.delete(reqId)
            resolve({
              answers: request.questions.map((q: any) => ({
                id: q.id,
                selected: q.options && q.options.length > 0 ? [q.options[0].label] : ['Confirmed']
              }))
            })
          }
        })
      }
    })
  }

  // Approval asked event listener
  ctx.on('approval/asked', (request: any) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'approval_request', request }))
      }
    }
  })

  // RAG progress event listener
  ctx.on('rag/progress' as any, (progress: any) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'rag_progress', progress }))
      }
    }
  })

  // Connection handler
  wss.on('connection', (ws) => {
    console.log('[WebSocket] İstemci başarıyla bağlandı!')
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'connected' }))
    }

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString())

        // 1. User question response
        if (msg.type === 'user_question_response') {
          const resolver = pendingQuestions.get(msg.id)
          if (resolver) {
            pendingQuestions.delete(msg.id)
            resolver({ answers: msg.answers || [] })
          }
          return
        }

        // 2. Get Context update
        if (msg.type === 'get_context') {
          const measurement = ctx.tokenMeter.measureSession(msg.sessionId)
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'context_update', measurement, sessionId: msg.sessionId }))
          }
          return
        }

        // 3. Approval response
        if (msg.type === 'approval_response') {
          if (ctx.approval) {
            ctx.approval.respond(msg.id, msg.outcome || 'allow_once')
          }
          return
        }

        // 4. Abort run
        if (msg.type === 'abort') {
          const controller = activeRuns.get(ws)
          if (controller) {
            controller.abort()
            activeRuns.delete(ws)
          }
          return
        }

        // 5. Chat message
        if (msg.type === 'chat') {
          const { sessionId, prompt, providerId, modelId, presetId, attachments, userId, enableThinking, thinkingBudgetTokens } = msg
          const controller = new AbortController()
          activeRuns.set(ws, controller)

          const sessionUserId = userId || 'user_admin'
          const activeSession =
            (sessionId && ctx.session.getSession(sessionId)) || ctx.session.createSession(undefined, undefined, sessionUserId, 'web')
          const activeSessionId = activeSession.id

          // Send active session id and initial context measurement immediately
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'session_init', sessionId: activeSessionId }))
            const initialMeasurement = ctx.tokenMeter.measureSession(activeSessionId)
            ws.send(JSON.stringify({ type: 'context_update', measurement: initialMeasurement, sessionId: activeSessionId }))
          }

          // Trigger Auto Title Generation on first turn in the background
          const isFirstTurn =
            !activeSession.messages || activeSession.messages.length <= 1 || activeSession.title === 'Yeni Sohbet' || activeSession.title.startsWith('Sohbet ')
          if (isFirstTurn && prompt && !prompt.startsWith('/')) {
            generateSessionTitle(ctx, activeSessionId, prompt, ws)
          }

          // Format attachments into prompt context
          let promptToSend = prompt
          if (Array.isArray(attachments) && attachments.length > 0) {
            const fileSummaries = attachments
              .map((att: any, idx: number) => {
                let s = `### [Ek Dosya ${idx + 1}] 📎 ${att.fileName || path.basename(att.filePath)}\n`
                s += `- **Yerel Dosya Yolu:** \`${att.filePath}\`\n`
                s += `- **Dosya Türü:** ${att.fileCategory || 'dosya'} (${typeof att.fileSize === 'number' ? (att.fileSize / 1024).toFixed(1) + ' KB' : ''})\n`
                if (att.schemaSummary) {
                  s += `\n**Şema / İçerik Özeti:**\n${att.schemaSummary}\n`
                }
                if (att.ocrText && !att.schemaSummary?.includes(att.ocrText.slice(0, 50))) {
                  s += `\n**Görsel OCR Metni:**\n${att.ocrText}\n`
                }
                if (att.fileCategory === 'spreadsheet') {
                  s += `\n> 💡 *İpucu:* Bu tablodan veri okumak, filtrelemek, toplamak veya grafik çizmek için Python (pandas, openpyxl, duckdb) komutlarını \`run_command\` ile çalıştırabilirsin.\n`
                } else if (att.fileCategory === 'image') {
                  s += `\n> 💡 *İpucu:* Kullanıcı benzer görselleri aramak isterse \`search_images\` aracını \`imagePath: "${att.filePath}"\` parametresiyle çağırabilirsin.\n`
                }
                return s
              })
              .join('\n\n---\n\n')

            promptToSend = `[KULLANICININ YÜKLEDİĞİ DOSYALAR]:\n\n${fileSummaries}\n\n========================================\n\n${prompt}`
          }

          let isAutonomous = false
          if (promptToSend.startsWith('/goal')) {
            isAutonomous = true
            const goalGoal = promptToSend.replace(/^\/goal\s*/, '').trim() || 'Proje ve kod tabanını analiz et'
            promptToSend = `[OTONOM HEDEF BAŞLATILDI]: Kullanıcı şu hedefi verdi: "${goalGoal}".\nDoğrudan araçları (list_dir, search_files, read_file, manage_goal) kullanarak çalışmaya başla ve görevi otonom olarak yürüt. Tekrar araç listeleme yapma, doğrudan işe koyul.`
          }

          try {
            const finalResponse = await ctx.agent.run({
              sessionId: activeSessionId,
              prompt: promptToSend,
              providerId,
              modelId,
              presetId,
              userId: sessionUserId,
              autonomous: isAutonomous,
              enableThinking: typeof enableThinking === 'boolean' ? enableThinking : undefined,
              thinkingBudgetTokens: typeof thinkingBudgetTokens === 'number' ? thinkingBudgetTokens : undefined,
              signal: controller.signal,
              onThought: (text: string) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'thought', text, sessionId: activeSessionId }))
                }
              },
              onChunk: (text: string) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'chunk', text, sessionId: activeSessionId }))
                }
              },
              onToolStart: (call: { id: string; name: string; args: any }) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'ensure_assistant', sessionId: activeSessionId }))
                  ws.send(JSON.stringify({ type: 'tool_start', call, sessionId: activeSessionId }))
                }
              },
              onToolResult: (result: { id: string; name: string; output: any }) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'tool_result', result, sessionId: activeSessionId }))
                  const toolMeasurement = ctx.tokenMeter.measureSession(activeSessionId)
                  ws.send(JSON.stringify({ type: 'context_update', measurement: toolMeasurement, sessionId: activeSessionId }))
                }
              },
              onCompaction: (info: { messageCount: number; summary: string }) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'compaction', info, sessionId: activeSessionId }))
                  const compMeasurement = ctx.tokenMeter.measureSession(activeSessionId)
                  ws.send(JSON.stringify({ type: 'context_update', measurement: compMeasurement, sessionId: activeSessionId }))
                }
              }
            })

            const measurement = ctx.tokenMeter.measureSession(activeSessionId)

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'done',
                  response: finalResponse,
                  sessionId: activeSessionId,
                  measurement
                })
              )
              ws.send(JSON.stringify({ type: 'context_update', measurement, sessionId: activeSessionId }))
            }
          } catch (err: any) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', error: err.message, sessionId: activeSessionId }))
            }
          } finally {
            activeRuns.delete(ws)
          }
        }
      } catch (err: any) {
        console.error('[WebSocket] Message error:', err)
      }
    })

    ws.on('close', () => {
      const controller = activeRuns.get(ws)
      if (controller) {
        controller.abort()
        activeRuns.delete(ws)
      }
    })
  })

  return wss
}
