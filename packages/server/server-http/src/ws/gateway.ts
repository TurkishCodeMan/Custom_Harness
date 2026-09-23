import type { Context } from '@custom-harness/core-context'
import { WebSocketServer, WebSocket } from 'ws'
import type http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { ScheduleService } from '@custom-harness/schedule'
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

  // Schedule triggered & completed broadcast
  ctx.on('schedule/triggered', ({ record, sessionId }: any) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'schedule_triggered',
            record,
            sessionId,
            message: `⏰ [Zamanlayıcı] Görev tetiklendi: [${record?.id || 'sch'}] (${record?.preset || 'Genel'})`
          })
        )
      }
    }
  })

  ctx.on('schedule/completed', ({ record, sessionId, result }: any) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'schedule_completed',
            record,
            sessionId,
            result,
            message: `✅ [Zamanlayıcı] Görev tamamlandı: [${record?.id || 'sch'}] (${record?.preset || 'Genel'})`
          })
        )
      }
    }
  })

  // Subagent spawn & completed broadcast + audit logging
  ctx.on('subagent/spawn' as any, (task: any) => {
    try {
      ;(ctx as any).auditLog?.write?.({
        actionType: 'subagent_spawn',
        positionId: task?.preset,
        positionTitle: task?.preset,
        traceId: task?.traceId,
        sessionId: task?.sessionId,
        summary: `🤖 Alt Ajan başlatıldı: "${task?.taskName}" (${task?.preset || 'default'})`,
        details: { taskId: task?.id, taskName: task?.taskName, preset: task?.preset }
      })
    } catch {}
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'subagent_spawn',
            task,
            traceId: task?.traceId,
            sessionId: task?.sessionId,
            message: `🤖 [Alt Ajan] Yeni görev başlatıldı: "${task?.taskName}" (${task?.preset || 'default'})`
          })
        )
      }
    }
  })

  ctx.on('subagent/completed' as any, (task: any) => {
    try {
      ;(ctx as any).auditLog?.write?.({
        actionType: 'subagent_completed',
        positionId: task?.preset,
        positionTitle: task?.preset,
        traceId: task?.traceId,
        sessionId: task?.sessionId,
        summary: `✅ Alt Ajan tamamlandı: "${task?.taskName}" (${task?.status})`,
        details: { taskId: task?.id, status: task?.status, toolCallsCount: task?.toolCalls?.length || 0 }
      })
    } catch {}
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'subagent_completed',
            task,
            traceId: task?.traceId,
            sessionId: task?.sessionId,
            message: `✅ [Alt Ajan] Görev tamamlandı: "${task?.taskName}"`
          })
        )
      }
    }
  })

  ;(ctx as any).on?.('subagent/tool_start', ({ taskId, traceId, toolCall }: any) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'subagent_tool_start',
            taskId,
            traceId,
            toolCall
          })
        )
      }
    }
  })

  ;(ctx as any).on?.('subagent/tool_result', ({ taskId, traceId, result }: any) => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'subagent_tool_result',
            taskId,
            traceId,
            result
          })
        )
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
          const measurement = ctx.tokenMeter?.measureSession ? ctx.tokenMeter.measureSession(msg.sessionId) : null
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

        // 3.1 Approval policy
        if (msg.type === 'approval_policy') {
          const approvalSvc = (ctx as any).approval || (ctx as any).get?.('approval') || (ctx as any).root?.approval
          if (approvalSvc && typeof approvalSvc.setPolicy === 'function') {
            approvalSvc.setPolicy(msg.policy)
            console.log(`🛡️ [Approval] Yetki politikası güncellendi: ${msg.policy}`)
          }
          return
        }

        // 3.2 Trigger routine immediately / unstick lock
        if (msg.type === 'schedule_trigger') {
          const scheduleSvc = (ctx as any).schedule || (ctx as any).get?.('schedule') || (ctx as any).root?.schedule || ScheduleService.getInstance(ctx)
          if (scheduleSvc && typeof scheduleSvc.triggerNow === 'function') {
            scheduleSvc.triggerNow(msg.id)
            console.log(`⚡ [Schedule] Manuel tetikleme isteği işlendi: [${msg.id}]`)
          } else {
            console.warn(`⚠️ [Schedule] triggerNow çağrılamadı, scheduleSvc bulunamadı`)
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
          const { sessionId, prompt, providerId, modelId, presetId, attachments, userId, enableThinking, thinkingBudgetTokens, workspace: clientWorkspace } = msg
          const controller = new AbortController()
          activeRuns.set(ws, controller)

          const sessionUserId = userId || 'user_admin'
          const activeSession =
            (sessionId && ctx.session.getSession(sessionId)) || ctx.session.createSession(undefined, clientWorkspace, sessionUserId, 'web')
          const activeSessionId = activeSession.id

          // If client explicitly sent a workspace and it differs, update activeSession workspace immediately
          if (clientWorkspace && clientWorkspace !== activeSession.workspace && fs.existsSync(clientWorkspace)) {
            activeSession.workspace = clientWorkspace
            if (ctx.session?.setSessionWorkspace) {
              ctx.session.setSessionWorkspace(activeSessionId, clientWorkspace)
            }
          }

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
                ctx.emit('agent/tool_start', { sessionId: activeSessionId, call })
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'ensure_assistant', sessionId: activeSessionId }))
                  ws.send(JSON.stringify({ type: 'tool_start', call, sessionId: activeSessionId }))
                }
              },
              onToolResult: (result: { id: string; name: string; output: any }) => {
                ctx.emit('agent/tool_result', { sessionId: activeSessionId, result })
                try {
                  ;(ctx as any).auditLog?.write?.({
                    actionType: 'tool_call',
                    sessionId: activeSessionId,
                    positionId: presetId,
                    positionTitle: presetId,
                    summary: `Araç çalıştırıldı: ${result.name}`,
                    details: {
                      toolName: result.name,
                      outputPreview: typeof result.output === 'string' ? result.output.slice(0, 300) : result.output
                    }
                  })
                } catch {}
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'tool_result', result, sessionId: activeSessionId }))
                  const toolMeasurement = ctx.tokenMeter?.measureSession ? ctx.tokenMeter.measureSession(activeSessionId) : null
                  if (toolMeasurement) {
                    ws.send(JSON.stringify({ type: 'context_update', measurement: toolMeasurement, sessionId: activeSessionId }))
                  }
                }
              },
              onCompaction: (info: { messageCount: number; summary: string }) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'compaction', info, sessionId: activeSessionId }))
                  const compMeasurement = ctx.tokenMeter?.measureSession ? ctx.tokenMeter.measureSession(activeSessionId) : null
                  if (compMeasurement) {
                    ws.send(JSON.stringify({ type: 'context_update', measurement: compMeasurement, sessionId: activeSessionId }))
                  }
                }
              },
              onUsage: (usage) => {
                if (ws.readyState === WebSocket.OPEN) {
                  const updatedMeasurement = ctx.tokenMeter?.measureSession ? ctx.tokenMeter.measureSession(activeSessionId) : null
                  ws.send(JSON.stringify({
                    type: 'token_usage',
                    usage,
                    measurement: updatedMeasurement,
                    sessionId: activeSessionId
                  }))
                  if (updatedMeasurement) {
                    ws.send(JSON.stringify({ type: 'context_update', measurement: updatedMeasurement, sessionId: activeSessionId }))
                  }
                }
              }
            })

            const measurement = ctx.tokenMeter?.measureSession ? ctx.tokenMeter.measureSession(activeSessionId) : null
            ctx.emit('agent/done', { sessionId: activeSessionId, response: finalResponse, measurement })

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'done',
                  response: finalResponse,
                  sessionId: activeSessionId,
                  measurement
                })
              )
              if (measurement) {
                ws.send(JSON.stringify({ type: 'context_update', measurement, sessionId: activeSessionId }))
              }
            }

          } catch (err: any) {
            ctx.emit('agent/error', { sessionId: activeSessionId, error: err.message })
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
