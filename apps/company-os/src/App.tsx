import React, { useState, useEffect, useRef } from 'react'
import type { Position, Routine, ActivityReceipt, NavView, ApprovalItem, ChatThread, ExecutionActionCard, ExecutionActionItem, ThreadMessage, TokenMeasurement } from './types.js'
import { Sidebar } from './components/Sidebar.js'
import { AssistantPage } from './pages/AssistantPage.js'
import { ApprovalsPage } from './pages/ApprovalsPage.js'
import { DashboardPage } from './pages/DashboardPage.js'
import { IntegrationsPage } from './pages/IntegrationsPage.js'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage.js'
import { SkillsPage } from './pages/SkillsPage.js'
import { WorkflowsPage } from './pages/WorkflowsPage.js'
import { AgentsPage } from './pages/AgentsPage.js'
import { TasksPage } from './pages/TasksPage.js'
import { InspectorPage } from './pages/InspectorPage.js'
import { OrgChart } from './components/OrgChart.js'
import { ExecutionDagViewer, type DagNode } from './components/ExecutionDagViewer.js'
import { PositionDrawer } from './components/PositionDrawer.js'
import { DirectiveModal } from './components/DirectiveModal.js'
import { RoutinesView } from './components/RoutinesView.js'
import { ActivityStream } from './components/ActivityStream.js'
import { NewPositionModal } from './components/NewPositionModal.js'
import { ReportViewerModal } from './components/ReportViewerModal.js'
import { CompanyWorkspaceModal } from './components/CompanyWorkspaceModal.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { fetchSchedules, createSchedule, deleteSchedule, triggerSchedule, createSession, fetchSessions, fetchSession, deleteSession, clearAllSessions, setWorkspaceApi, fetchSessionContext } from './api.js'
import { wsClient } from './ws.js'
import { usePositions } from './hooks/usePositions.js'
import { useApprovals } from './hooks/useApprovals.js'
import { groupMessagesByRound } from './messageGrouping.js'
import { FlowIcon, OrganizationIcon } from './components/Icons.js'

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<NavView>('assistant')
  const sessionToPositionRef = useRef<Map<string, string>>(new Map())

  const [companyName, setCompanyName] = useState<string>(() => {
    try {
      return localStorage.getItem('company_os_name') || 'COMPANY_ABC'
    } catch {
      return 'COMPANY_ABC'
    }
  })
  const [companyWorkspace, setCompanyWorkspace] = useState<string>(() => {
    try {
      return localStorage.getItem('company_os_workspace') || '/home/huseyina/code_mode/COMPANY_ABC'
    } catch {
      return '/home/huseyina/code_mode/COMPANY_ABC'
    }
  })
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)

  const {
    positions,
    setPositions,
    updatePositionStatus,
    handleAddPosition: hookAddPosition,
    handleUpdatePosition: hookUpdatePosition,
    handleDeletePosition: hookDeletePosition
  } = usePositions()

  const {
    approvals,
    setApprovals,
    approvalPolicy,
    handleSelectApprovalPolicy,
    handleApprove,
    handleDeny
  } = useApprovals()

  const [dagNodes, setDagNodes] = useState<DagNode[]>([])
  const [activeTraceId, setActiveTraceId] = useState<string | undefined>()
  const [companySubTab, setCompanySubTab] = useState<'chart' | 'dag'>('dag')

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [isDirectiveModalOpen, setIsDirectiveModalOpen] = useState(false)
  const [isNewPositionModalOpen, setIsNewPositionModalOpen] = useState(false)
  const [selectedReportPath, setSelectedReportPath] = useState<string | null>(null)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [receipts, setReceipts] = useState<ActivityReceipt[]>(() => {
    try {
      const saved = localStorage.getItem('company_os_receipts_v2')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isConnected, setIsConnected] = useState(false)
  const [isDirectiveRunning, setIsDirectiveRunning] = useState(false)
  const [isRoutinesLoading, setIsRoutinesLoading] = useState(false)
  const [lastDirectivePrompt, setLastDirectivePrompt] = useState<string>('')

  useEffect(() => {
    try {
      localStorage.setItem('company_os_receipts_v2', JSON.stringify(receipts))
    } catch {}
  }, [receipts])

  // Real Chat Threads State (Loaded from backend /api/sessions)
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string>('')
  const activeThreadIdRef = useRef<string>('')
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId
  }, [activeThreadId])

  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [streamingText, setStreamingText] = useState<string>('')
  const [streamingThought, setStreamingThought] = useState<string>('')
  const [sessionMeasurement, setSessionMeasurement] = useState<TokenMeasurement | undefined>(undefined)
  const streamingTextRef = useRef<string>('')
  const streamingThoughtRef = useRef<string>('')

  // Helper to load canonical messages of a session
  const loadSessionMessages = async (sessionId: string) => {
    if (!sessionId) {
      setMessages([])
      setSessionMeasurement(undefined)
      return
    }
    try {
      const data = await fetchSession(sessionId)
      if (data && Array.isArray(data.messages)) {
        const rawMessages = data.messages
        const mapped: ThreadMessage[] = groupMessagesByRound(rawMessages, positions)
        setMessages(mapped)

        // Backend session.presetId — kaynak gerçek
        if (data.presetId) {
          sessionToPositionRef.current.set(sessionId, data.presetId)
          setChatThreads(prev =>
            prev.map(t =>
              t.id === sessionId && !t.targetPositionId
                ? { ...t, targetPositionId: data.presetId }
                : t
            )
          )
        }
      }

      // Fetch TokenMeter measurement from backend
      fetchSessionContext(sessionId).then(measurement => {
        if (measurement) {
          setSessionMeasurement(measurement)
        }
      }).catch(() => {})
    } catch (err) {
      console.warn('Session messages yüklenemedi:', err)
    }
  }

  // Load real sessions from backend
  const loadRealSessions = async () => {
    try {
      const realSessions = await fetchSessions()
      if (Array.isArray(realSessions) && realSessions.length > 0) {
        const now = Date.now()
        const oneDayMs = 86400000

        // Filter out redundant empty 'Yeni Sohbet' ghost sessions from sidebar
        const validSessions = realSessions.filter((s: any) => {
          if (!s.title) return false
          const t = s.title.trim()
          if ((t === 'Yeni Sohbet' || t === 'Yeni Oturum') && s.id !== activeThreadId) {
            return false
          }
          return true
        })

        const mapped: ChatThread[] = validSessions.map((s: any) => {
          const time = s.updatedAt || s.createdAt || now
          const diff = now - time
          const period: ChatThread['period'] = diff < oneDayMs ? 'today' : diff < 2 * oneDayMs ? 'yesterday' : 'last_7_days'
          
          const displayTitle = s.title || `Oturum ${s.id.slice(-6)}`

          // Backend'den gelen presetId — bu kaynak gerçektir
          if (s.presetId) {
            sessionToPositionRef.current.set(s.id, s.presetId)
          }

          return {
            id: s.id,
            title: displayTitle,
            period,
            timestamp: time,
            sessionId: s.id,
            targetPositionId: s.presetId
          }
        })
        mapped.sort((a, b) => b.timestamp - a.timestamp)
        setChatThreads(mapped)
        if (!activeThreadId && mapped.length > 0) {
          setActiveThreadId(mapped[0].id)
        }
      }
    } catch (err) {
      console.warn('Real sessions yüklenemedi:', err)
    }
  }

  useEffect(() => {
    loadRealSessions()
  }, [])

  // Load messages whenever activeThreadId changes
  useEffect(() => {
    loadSessionMessages(activeThreadId)
  }, [activeThreadId])

  // Delete a single chat session
  const handleDeleteThread = async (threadId: string) => {
    try {
      await deleteSession(threadId)
    } catch (e) {
      console.warn('Oturum silinirken hata:', e)
    }
    setChatThreads(prev => {
      const filtered = prev.filter(t => t.id !== threadId)
      if (activeThreadId === threadId) {
        if (filtered.length > 0) {
          setActiveThreadId(filtered[0].id)
        } else {
          setActiveThreadId('')
          setMessages([])
          setStreamingText('')
          setStreamingThought('')
          setActionCards([])
        }
      }
      return filtered
    })
  }

  // Clear all chat sessions
  const handleClearAllThreads = async () => {
    if (!window.confirm('Tüm sohbet geçmişini silmek istediğinize emin misiniz?')) return
    try {
      await clearAllSessions()
    } catch (e) {
      console.warn('Tüm oturumlar silinirken hata:', e)
    }
    setChatThreads([])
    setActiveThreadId('')
    setMessages([])
    setStreamingText('')
    setStreamingThought('')
    setActionCards([])
  }

  // Real Action Cards (Populated dynamically during execution)
  const [actionCards, setActionCards] = useState<ExecutionActionCard[]>([])
  const actionCardsRef = useRef<ExecutionActionCard[]>([])

  useEffect(() => {
    actionCardsRef.current = actionCards
  }, [actionCards])

  const toggleCard = (cardId: string) => {
    setActionCards(prev => prev.map(c => c.id === cardId ? { ...c, isExpanded: !c.isExpanded } : c))
  }

  // Load schedules / routines
  const loadRoutines = async () => {
    setIsRoutinesLoading(true)
    try {
      const data = await fetchSchedules()
      setRoutines(data)
    } catch (err) {
      console.error('Routines yüklenemedi:', err)
    } finally {
      setIsRoutinesLoading(false)
    }
  }

  useEffect(() => {
    loadRoutines()
    setPositions(prev => prev.map(p => {
      if (p.status === 'executing' || p.status === 'thinking') {
        return {
          ...p,
          status: p.lastReport ? 'completed' : 'idle',
          currentAction: p.lastReport ? 'Rapor başarıyla oluşturuldu' : 'Hazır / Boşta'
        }
      }
      return p
    }))
  }, [])

  useEffect(() => {
    if (['tasks', 'recurring', 'dashboard'].includes(currentView)) {
      loadRoutines()
    }
  }, [currentView])

  // Helper for adding receipts
  const addReceipt = (receipt: Omit<ActivityReceipt, 'id' | 'timestamp'>) => {
    const newReceipt: ActivityReceipt = {
      ...receipt,
      id: `rcpt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now()
    }
    setReceipts(prev => [newReceipt, ...prev.slice(0, 199)])
  }

  // WebSocket listeners for live real observability
  useEffect(() => {
    const unsubConn = wsClient.on('connection/change', ({ connected }) => {
      setIsConnected(connected)
      if (connected) {
        wsClient.send('approval_policy', { policy: approvalPolicy })
      }
    })

    const getTargetPosition = (data: any): Position | undefined => {
      if (data.sessionId) {
        const posId = sessionToPositionRef.current.get(data.sessionId)
        if (posId) {
          const found = positions.find(p => p.id === posId)
          if (found) return found
        }
      }
      if (data.preset || data.presetId) {
        const pId = data.preset || data.presetId
        const found = positions.find(p => p.presetId === pId || p.id === pId)
        if (found) return found
      }
      const executing = positions.filter(p => p.status === 'executing')
      if (executing.length === 1) {
        return executing[0]
      }
      return positions.find(p => p.id === 'ceo') || positions[0]
    }

    // Listen for WebSocket Approval Requests
    const handleApproval = (data: any) => {
      const req = data.request || data
      const targetPos = getTargetPosition(req)

      const newApproval: ApprovalItem = {
        id: req.id || `appr_${Date.now()}`,
        sessionId: req.sessionId,
        toolName: req.toolName || req.action || 'Tool Execution',
        title: req.title || `${targetPos ? targetPos.title : 'Ajan'}: ${req.toolName || req.action}`,
        status: 'pending',
        details: req.details || req.args,
        to: req.args?.to,
        subject: req.args?.subject,
        body: req.args?.body,
        timeoutSeconds: req.timeout || 120,
        createdAt: req.createdAt || Date.now()
      }

      setApprovals(prev => [newApproval, ...prev])

      addReceipt({
        positionId: targetPos?.id || 'system',
        positionTitle: targetPos?.title || 'Sistem Güvenliği',
        actionType: 'tool_call',
        summary: `🛡️ Araç çalıştırma onayı istendi: ${newApproval.title}`,
        details: req
      })
    }

    const unsubApproval = wsClient.on('approval_request', handleApproval)

    // Listen for real tool starts (support both tool_start and tool/start)
    const handleToolStart = (data: any) => {
      const targetPos = getTargetPosition(data)
      const call = data.call || data
      const toolCallId = call.id || data.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const toolName = call.name || data.name || data.toolName || 'tool'
      const args = call.args || data.args || {}
      const argStr = typeof args === 'object' ? JSON.stringify(args) : String(args)
      const detail = args.command || args.path || args.query || args.taskName || args.prompt || (argStr.length > 70 ? argStr.slice(0, 70) + '...' : argStr)

      const newItem: ExecutionActionItem = {
        id: toolCallId,
        label: toolName,
        status: 'running',
        detail: String(detail || ''),
        input: args,
        startedAt: Date.now()
      }

      if (targetPos) {
        updatePositionStatus(targetPos.id, 'executing', `Araç çalıştırılıyor: ${toolName}`)

        addReceipt({
          positionId: targetPos.id,
          positionTitle: targetPos.title,
          actionType: 'tool_call',
          summary: `🛠️ ${targetPos.title} "${toolName}" aracını çalıştırdı.`,
          details: args
        })

        setActionCards(prev => {
          const cardId = targetPos.id
          const existing = prev.find(c => c.id === cardId)
          let nextCards: ExecutionActionCard[]
          if (existing) {
            nextCards = prev.map(c => c.id === cardId ? {
              ...c,
              badgeText: `${c.items.length + 1} eylem`,
              items: [newItem, ...c.items]
            } : c)
          } else {
            nextCards = [{
              id: cardId,
              name: `${targetPos.title}`,
              icon: targetPos.icon,
              badgeText: '1 eylem yürütülüyor',
              isExpanded: false,
              items: [newItem]
            }, ...prev]
          }
          actionCardsRef.current = nextCards
          return nextCards
        })
      } else {
        setActionCards(prev => {
          const cardId = 'agent'
          const existing = prev.find(c => c.id === cardId)
          let nextCards: ExecutionActionCard[]
          if (existing) {
            nextCards = prev.map(c => c.id === cardId ? {
              ...c,
              badgeText: `${c.items.length + 1} eylem`,
              items: [newItem, ...c.items]
            } : c)
          } else {
            nextCards = [{
              id: cardId,
              name: 'Ajan Aksiyonları',
              icon: '⚡',
              badgeText: '1 eylem yürütülüyor',
              isExpanded: false,
              items: [newItem]
            }, ...prev]
          }
          actionCardsRef.current = nextCards
          return nextCards
        })
      }
    }

    const unsubToolStart1 = wsClient.on('tool_start', handleToolStart)
    const unsubToolStart2 = wsClient.on('tool/start', handleToolStart)

    // Listen for real tool results (support both tool_result and tool/result)
    const handleToolResult = (data: any) => {
      const targetPos = getTargetPosition(data)
      const resultObj = data.result || data
      const toolCallId = resultObj.id || data.id || data.callId
      const toolName = resultObj.name || data.name || data.toolName || 'tool'
      const toolArgs = data.call?.args || data.args || {}
      const rawOutput = resultObj.output !== undefined
        ? resultObj.output
        : (resultObj.result !== undefined ? resultObj.result : (data.output !== undefined ? data.output : resultObj))

      setActionCards(prev => {
        let matched = false
        const nextCards = prev.map(c => {
          if (!targetPos || c.id === targetPos.id || c.id === 'agent') {
            return {
              ...c,
              items: c.items.map(it => {
                const isMatch = (!matched) && (
                  (toolCallId && it.id === toolCallId) ||
                  (!toolCallId && it.label === toolName && it.status === 'running') ||
                  (it.label === toolName && it.status === 'running')
                )
                if (isMatch) {
                  matched = true
                  return {
                    ...it,
                    status: 'completed' as const,
                    output: rawOutput,
                    durationMs: it.startedAt ? (Date.now() - it.startedAt) : undefined
                  }
                }
                return it
              })
            }
          }
          return c
        })
        actionCardsRef.current = nextCards
        return nextCards
      })

      if (toolName.startsWith('schedule_')) {
        loadRoutines()
      }

      if (targetPos) {
        const isReportWrite = toolName === 'write_file' && (
          (toolArgs?.path && String(toolArgs.path).includes('raporlar')) ||
          (resultObj && String(resultObj).includes('raporlar'))
        )

        if (isReportWrite) {
          const reportPath = toolArgs?.path || 'raporlar/durum_raporu.md'
          updatePositionStatus(targetPos.id, 'completed', 'Rapor başarıyla oluşturuldu.', {
            title: `Durum Raporu (${new Date().toLocaleDateString('tr-TR')})`,
            path: reportPath,
            date: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          })

          const matchedSessionId = data?.sessionId || activeThreadId || (targetPos ? [...sessionToPositionRef.current.entries()].find(([sId, pId]) => pId === targetPos.id)?.[0] : undefined)

          addReceipt({
            positionId: targetPos.id,
            positionTitle: targetPos.title,
            actionType: 'report_generated',
            summary: `📄 ${targetPos.title} rapor oluşturdu: ${reportPath}`,
            details: { path: reportPath, sessionId: matchedSessionId }
          })
        }
      }
    }

    const unsubToolResult1 = wsClient.on('tool_result', handleToolResult)
    const unsubToolResult2 = wsClient.on('tool/result', handleToolResult)

    const unsubThought = wsClient.on('thought', (data: any) => {
      const txt = data.text || ''
      streamingThoughtRef.current += txt
      setStreamingThought(streamingThoughtRef.current)
    })

    const unsubChunk = wsClient.on('chunk', (data: any) => {
      const txt = data.text || ''
      streamingTextRef.current += txt
      setStreamingText(streamingTextRef.current)
    })

    // Listen for agent completion (support both done and chat/done)
    const handleDone = (data: any) => {
      const targetPos = getTargetPosition(data)
      const responseText = data.response || data.finalResponse || streamingTextRef.current
      const thoughtText = streamingThoughtRef.current

      // Backend bizim için presetId'yi kaydetti ve done event'inde gönderdi
      // sessionToPositionRef ve chatThreads'i bununla güncelle
      if (data.presetId && data.sessionId) {
        sessionToPositionRef.current.set(data.sessionId, data.presetId)
        setChatThreads(prev =>
          prev.map(t =>
            t.id === data.sessionId ? { ...t, targetPositionId: data.presetId } : t
          )
        )
      }

      const targetSessionId = data.sessionId || activeThreadIdRef.current
      if (targetSessionId) {
        // Single Source of Truth: Doğrudan backend'deki kanonik oturum mesajlarını çek
        loadSessionMessages(targetSessionId)
      } else if (responseText) {
        const finalActionCards = actionCardsRef.current.length > 0 ? [...actionCardsRef.current] : undefined
        setMessages(prev => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            role: 'assistant',
            content: responseText,
            reasoning_content: thoughtText || undefined,
            presetName: data.presetId || targetPos?.presetId || targetPos?.id,
            actionCards: finalActionCards,
            timestamp: Date.now()
          }
        ])
      }

      if (targetPos) {
        updatePositionStatus(targetPos.id, 'completed', 'Görev başarıyla tamamlandı.')
        const matchedSessionId = data?.sessionId || activeThreadId || (targetPos ? [...sessionToPositionRef.current.entries()].find(([sId, pId]) => pId === targetPos.id)?.[0] : undefined)
        addReceipt({
          positionId: targetPos.id,
          positionTitle: targetPos.title,
          actionType: 'report_generated',
          summary: `🏁 ${targetPos.title} görevi başarıyla tamamladı.`,
          details: {
            reportText: typeof responseText === 'string' ? responseText : JSON.stringify(responseText),
            sessionId: matchedSessionId
          }
        })
      }

      if (data.measurement) {
        setSessionMeasurement(data.measurement)
      }

      streamingTextRef.current = ''
      streamingThoughtRef.current = ''
      setStreamingText('')
      setStreamingThought('')
      actionCardsRef.current = []
      setActionCards([])
      setIsDirectiveRunning(false)
      loadRealSessions()
      loadRoutines()
    }

    const unsubDone1 = wsClient.on('done', handleDone)
    const unsubDone2 = wsClient.on('chat/done', handleDone)

    const unsubContextUpdate = wsClient.on('context_update', (data: any) => {
      if (data?.measurement) {
        setSessionMeasurement(data.measurement)
      }
    })

    const unsubTokenUsage = wsClient.on('token_usage', (data: any) => {
      if (data?.measurement) {
        setSessionMeasurement(data.measurement)
      }
    })

    // Listen for AI-generated session title
    const unsubSessionTitle = wsClient.on('session_title', (data: any) => {
      if (data.sessionId && data.title) {
        setChatThreads(prev => prev.map(t => t.id === data.sessionId ? { ...t, title: data.title } : t))
      }
    })

    // Listen for schedule triggers
    const unsubScheduleTrigger = wsClient.on('schedule_triggered', (data: any) => {
      const record = data?.record
      const targetPos = positions.find(p => p.presetId === record?.preset || p.id === record?.preset)
      if (targetPos) {
        updatePositionStatus(targetPos.id, 'executing', `Rutin denetleniyor: ${record?.prompt?.slice(0, 40)}...`)
      }
      addReceipt({
        positionId: targetPos?.id || 'system',
        positionTitle: targetPos?.title || 'Zamanlayıcı Servisi',
        actionType: 'directive_issued',
        summary: data.message || `⏰ [Rutin Tetiklendi] ${targetPos?.title || 'Ajan'}: [${record?.id || 'sch'}]`,
        details: data
      })
      const targetSessionId = data?.sessionId || record?.sessionId
      if (targetSessionId && targetSessionId === activeThreadIdRef.current) {
        loadSessionMessages(targetSessionId)
      }
      loadRoutines()
      loadRealSessions()
    })

    const unsubScheduleComplete = wsClient.on('schedule_completed', (data: any) => {
      const record = data?.record
      const targetPos = positions.find(p => p.presetId === record?.preset || p.id === record?.preset)
      const reportText = data?.result?.response || data?.result?.finalResponse || (typeof data?.result === 'string' ? data?.result : '')

      if (targetPos) {
        updatePositionStatus(targetPos.id, 'completed', 'Rutin denetimi tamamlandı.', {
          title: `${targetPos.title} Denetim Raporu`,
          path: `raporlar/${targetPos.id}_denetim.md`,
          date: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        })
      }

      const snippet = reportText ? reportText.replace(/^[#\s*•-]+/, '').split('\n')[0]?.slice(0, 90) : ''
      addReceipt({
        positionId: targetPos?.id || 'system',
        positionTitle: targetPos?.title || 'Zamanlayıcı Servisi',
        actionType: 'report_generated',
        summary: `📄 ${targetPos?.title || 'Ajan'} denetim raporu sundu: ${snippet || record?.prompt?.slice(0, 60)}...`,
        details: {
          ...data,
          reportText,
          sessionId: data?.sessionId
        }
      })
      const targetSessionId = data?.sessionId || record?.sessionId
      if (targetSessionId && targetSessionId === activeThreadIdRef.current) {
        loadSessionMessages(targetSessionId)
      }
      loadRoutines()
      loadRealSessions()
    })

    // Listen for subagent spawn
    const handleSubagentSpawn = (data: any) => {
      const task = data.task || data
      const targetPos = getTargetPosition(task)
      if (task.traceId) {
        setActiveTraceId(task.traceId)
      }
      setDagNodes((prev) => {
        const existingIdx = prev.findIndex((n) => n.id === task.id)
        const newNode: DagNode = {
          id: task.id,
          traceId: task.traceId || data.traceId || 'trace-main',
          label: task.taskName,
          description: task.taskDescription,
          preset: task.preset,
          positionTitle: targetPos?.title || task.preset,
          positionIcon: targetPos?.icon,
          status: 'running',
          startedAt: task.startedAt || Date.now(),
          toolCalls: [],
          sessionId: task.sessionId || data.sessionId,
          parentId: task.parentSessionId
        }
        if (existingIdx >= 0) {
          const updated = [...prev]
          updated[existingIdx] = { ...updated[existingIdx], ...newNode }
          return updated
        }
        return [...prev, newNode]
      })

      if (targetPos) {
        updatePositionStatus(targetPos.id, 'executing', `Alt ajan çalışıyor: ${task.taskName}`)
      }

      addReceipt({
        positionId: targetPos?.id || 'system',
        positionTitle: targetPos?.title || 'Alt Ajan',
        actionType: 'subagent_spawn',
        summary: `🤖 Alt Ajan başlatıldı: "${task.taskName}" (${task.preset || 'default'})`,
        details: task,
        sessionId: task.sessionId || data.sessionId,
        traceId: task.traceId || data.traceId
      })
    }

    const unsubSubagentSpawn = wsClient.on('subagent_spawn', handleSubagentSpawn)

    // Listen for subagent completed
    const handleSubagentCompleted = (data: any) => {
      const task = data.task || data
      const targetPos = getTargetPosition(task)
      setDagNodes((prev) =>
        prev.map((n) => {
          if (n.id === task.id) {
            return {
              ...n,
              status: task.status === 'completed' ? 'completed' : 'failed',
              completedAt: task.completedAt || Date.now(),
              result: task.result,
              sessionId: task.sessionId || data.sessionId || n.sessionId
            }
          }
          return n
        })
      )

      if (targetPos) {
        updatePositionStatus(targetPos.id, 'completed', `Alt ajan tamamlandı: ${task.taskName}`)
      }

      addReceipt({
        positionId: targetPos?.id || 'system',
        positionTitle: targetPos?.title || 'Alt Ajan',
        actionType: 'subagent_completed',
        summary: `✅ Alt Ajan tamamlandı: "${task.taskName}" (${task.status})`,
        details: { result: task.result, toolCallsCount: task.toolCalls?.length || 0 },
        sessionId: task.sessionId || data.sessionId,
        traceId: task.traceId || data.traceId
      })
    }

    const unsubSubagentCompleted = wsClient.on('subagent_completed', handleSubagentCompleted)

    // Listen for subagent tool execution
    const handleSubagentToolStart = (data: any) => {
      const { taskId, toolCall } = data
      setDagNodes((prev) =>
        prev.map((n) => {
          if (n.id === taskId) {
            const newToolCall = {
              toolName: toolCall?.toolName || 'tool',
              status: 'running' as const,
              args: toolCall?.args,
              timestamp: toolCall?.timestamp || Date.now()
            }
            return {
              ...n,
              toolCalls: [...(n.toolCalls || []), newToolCall]
            }
          }
          return n
        })
      )
    }

    const unsubSubagentToolStart = wsClient.on('subagent_tool_start', handleSubagentToolStart)

    const handleSubagentToolResult = (data: any) => {
      const { taskId, result } = data
      setDagNodes((prev) =>
        prev.map((n) => {
          if (n.id === taskId) {
            const toolName = result?.name || 'tool'
            return {
              ...n,
              toolCalls: (n.toolCalls || []).map((t) =>
                t.toolName === toolName && t.status === 'running'
                  ? {
                      ...t,
                      status: 'completed' as const,
                      result: typeof result?.output === 'string' ? result.output : JSON.stringify(result?.output)
                    }
                  : t
              )
            }
          }
          return n
        })
      )
    }

    const unsubSubagentToolResult = wsClient.on('subagent_tool_result', handleSubagentToolResult)

    return () => {
      unsubConn()
      unsubApproval()
      unsubToolStart1()
      unsubToolStart2()
      unsubToolResult1()
      unsubToolResult2()
      unsubThought()
      unsubChunk()
      unsubDone1()
      unsubDone2()
      unsubContextUpdate()
      unsubTokenUsage()
      unsubSessionTitle()
      unsubScheduleTrigger()
      unsubScheduleComplete()
      unsubSubagentSpawn()
      unsubSubagentCompleted()
      unsubSubagentToolStart()
      unsubSubagentToolResult()
    }
  }, [positions])

  // Handle Directives
  const handleExecuteDirective = async (params: {
    prompt: string
    targetPositionIds: string[]
    scheduleType: 'instant' | 'after' | 'cron'
    afterSeconds?: number
    cron?: string
    attachments?: any[]
  }) => {
    setIsDirectiveRunning(true)
    setLastDirectivePrompt(params.prompt)

    addReceipt({
      positionId: 'ceo',
      positionTitle: 'Genel Müdür (CEO)',
      actionType: 'directive_issued',
      summary: `Kurumsal Direktif Yayınlandı: "${params.prompt}" ➔ ${params.targetPositionIds.length} Departman`,
      details: params
    })

    const isMultiAgentDeliberation = (
      params.targetPositionIds.length > 1 ||
      params.prompt.toLowerCase().includes('toplantı') ||
      params.prompt.toLowerCase().includes('koordinasyon') ||
      params.prompt.toLowerCase().includes('tutanağı')
    )

    // 🏛️ Multi-Agent Deliberation (Executive Meeting Mode)
    if (params.scheduleType === 'instant' && (isMultiAgentDeliberation && params.targetPositionIds.length > 1)) {
      const moderator = positions.find(p => p.id === 'ceo' || p.level === 1) ||
        positions.find(p => p.id === params.targetPositionIds[0]) ||
        positions[0]

      const participantPositions = params.targetPositionIds
        .map(id => positions.find(p => p.id === id))
        .filter(Boolean) as Position[]

      const participantNames = participantPositions
        .map(p => `${p.icon} ${p.title}`)
        .join(', ')

      const cleanSummary = params.prompt.replace(/@[^\s]+/g, '').trim().slice(0, 32) || 'Yuvarlak Masa Müzakeresi'
      const sessionTitle = `🏛️ [Toplantı] ${cleanSummary}`

      const meetingPrompt = `[KURUMSAL İCRA KURULU TOPLANTISI & ÇAPRAZ DEPARTMAN MÜZAKERESİ]
Sen bu toplantının icra kurulu başkanı ve moderatörüsün (${moderator.title}).

KULLANICI DİREKTİFİ VE TOPLANTI GÜNDEMİ:
"${params.prompt}"

TOPLANTI MASASINDAKİ DEPARTMANLAR:
${participantPositions.map(p => `- ${p.icon} ${p.title} (Preset: '${p.presetId}', Koltuk ID: '${p.id}', Görev: ${p.role})`).join('\n')}

GÖREVİN VE TOPLANTI PROTOKOLÜ (MÜZAKERE ADIMLARI):
1. AŞAMA (Görüş ve Veri Alma):
   - 'invoke_subagent' aracını kullanarak sırasıyla masadaki departmanları (${participantPositions.map(p => `'${p.presetId}'`).join(', ')}) toplantıya çağır.
   - Her departmana gündem konusunu ilet; kendi uzmanlık alanı, departman çalışma alanındaki gerçek dosyalar (bütçe, stok, sözleşme, iade verileri) çerçevesinde resmi görüşünü ve gerekçelerini talep et.
2. AŞAMA (Çapraz Müzakere & Çelişki Çözümü):
   - Departmanların sunduğu verileri masaya ser. Çelişen noktaları (örn: Tedarik'in maliyet/hız önceliği vs. Kalite'nin kusur riski veya CFO'nun bütçe tavanı) açıkça ortaya koy ve tarafları müzakere ettir.
3. AŞAMA (Nihai Ortak İcra Kararı & Tutanağı):
   - Toplantının sonunda yöneticinin masasına bölümlere ayrılmış, net ve bağlayıcı bir "TOPLANTI KARAR TUTANAĞI" çıkar:
     * 📌 GÜNDEM ÖZETİ
     * 🗣️ DEPARTMAN GÖRÜŞLERİ VE ANALİZLERİ
     * ⚖️ ÇAPRAZ DEĞERLENDİRME VE UZLAŞMA NOKTASI
     * 🎯 OY BİRLİĞİYLE ALINAN NİHAİ İCRA KARARI
     * 📋 SOMUT GÖREV DAĞILIMI VE EYLEM PLANI (Hangi departman ne yapacak?)`

      updatePositionStatus(moderator.id, 'executing', `Toplantı yönetiliyor: ${cleanSummary}...`)

      try {
        const session = await createSession(sessionTitle, moderator.workspace)
        sessionToPositionRef.current.set(session.id, moderator.id)

        const newThread: ChatThread = {
          id: session.id,
          title: `👑 ${moderator.title.split('&')[0].trim()} • ${sessionTitle}`,
          period: 'today',
          timestamp: Date.now(),
          sessionId: session.id,
          targetPositionId: moderator.id
        }
        setChatThreads(prev => [newThread, ...prev.filter(t => t.id !== session.id)])
        setActiveThreadId(session.id)

        wsClient.sendDirective({
          sessionId: session.id,
          prompt: meetingPrompt,
          preset: moderator.presetId,
          workspace: moderator.workspace,
          attachments: params.attachments
        })

        addReceipt({
          positionId: moderator.id,
          positionTitle: moderator.title,
          actionType: 'directive_issued',
          summary: `🏛️ ${moderator.title} liderliğinde ortak icra toplantısı başlatıldı (${participantNames})`,
          details: { ...params, sessionId: session.id }
        })
      } catch (err: any) {
        console.error(`Toplantı başlatılamadı [${moderator.id}]:`, err)
        updatePositionStatus(moderator.id, 'error', `Hata: ${err.message}`)
      }
      return
    }

    const effectivePrompt = params.prompt

    for (const posId of params.targetPositionIds) {
      const pos = positions.find(p => p.id === posId)
      if (!pos) continue

      if (params.scheduleType === 'instant') {
        updatePositionStatus(pos.id, 'executing', `Direktif yürütülüyor: ${params.prompt.slice(0, 30)}...`)

        try {
          const session = await createSession(
            `[${pos.title}] ${params.prompt.slice(0, 30)}...`,
            pos.workspace
          )
          sessionToPositionRef.current.set(session.id, pos.id)

          // Add real thread
          const newThread: ChatThread = {
            id: session.id,
            title: `[${pos.title}] ${params.prompt.slice(0, 24)}...`,
            period: 'today',
            timestamp: Date.now(),
            sessionId: session.id,
            targetPositionId: pos.id
          }
          setChatThreads(prev => [newThread, ...prev.filter(t => t.id !== session.id)])
          setActiveThreadId(session.id)

          wsClient.sendDirective({
            sessionId: session.id,
            prompt: effectivePrompt,
            preset: pos.presetId,
            workspace: pos.workspace,
            attachments: params.attachments
          })

          addReceipt({
            positionId: pos.id,
            positionTitle: pos.title,
            actionType: 'directive_issued',
            summary: `⚡ ${pos.title} direktifi yürütmeye başladı: "${params.prompt.slice(0, 80)}..."`,
            details: { ...params, sessionId: session.id }
          })
        } catch (err: any) {
          console.error(`Direktif gönderilemedi [${pos.id}]:`, err)
          updatePositionStatus(pos.id, 'error', `Hata: ${err.message}`)
        }
      } else {
        try {
          await createSchedule({
            prompt: effectivePrompt,
            preset: pos.presetId,
            workspace: pos.workspace,
            after_seconds: params.scheduleType === 'after' ? params.afterSeconds : undefined,
            cron: params.scheduleType === 'cron' ? params.cron : undefined
          })
        } catch (err: any) {
          console.error(`Plan oluşturulamadı [${pos.id}]:`, err)
        }
      }
    }

    if (params.scheduleType !== 'instant') {
      loadRoutines()
      setIsDirectiveRunning(false)
    }
  }

  // Abort running agent execution
  const handleAbort = () => {
    wsClient.abort()
    setIsDirectiveRunning(false)
    setStreamingText('')
    setStreamingThought('')
    streamingTextRef.current = ''
    streamingThoughtRef.current = ''
  }

  // Handle send message from Assistant chat
  const handleSendMessage = (text: string, targets: string[], attachments?: any[]) => {
    let displayContent = text
    if (attachments && attachments.length > 0) {
      const attNames = attachments.map(a => `📎 ${a.fileName}`).join(', ')
      displayContent = text ? `${text}\n\n[Eklenen Dosyalar: ${attNames}]` : `[Eklenen Dosyalar: ${attNames}]`
    }

    const userMsg: ThreadMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: displayContent,
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMsg])
    setStreamingText('')
    setStreamingThought('')
    streamingTextRef.current = ''
    streamingThoughtRef.current = ''
    setActionCards([])

    const effectivePrompt = text.trim() || (attachments && attachments.length > 0 ? `Lütfen ekteki ${attachments.map(a => a.fileName).join(', ')} dosyasını incele.` : 'Merhaba')

    // CASE 1: If user already has an active conversation thread open, continue inside it!
    if (activeThreadId) {
      const existingThread = chatThreads.find(t => t.id === activeThreadId)
      let targetPos: Position | undefined

      // 1. Explicit @ mention
      if (targets.length > 0) {
        targetPos = positions.find(p => p.id === targets[0] || p.presetId === targets[0])
      }

      // 2. Backend session'dan gelen presetId (kaynak gerçek)
      if (!targetPos && existingThread?.targetPositionId) {
        const pid = existingThread.targetPositionId
        targetPos = positions.find(p => p.id === pid || p.presetId === pid)
      }

      // 3. sessionToPositionRef (backend seed)
      if (!targetPos && sessionToPositionRef.current.has(activeThreadId)) {
        const pid = sessionToPositionRef.current.get(activeThreadId)!
        targetPos = positions.find(p => p.id === pid || p.presetId === pid)
      }

      // 4. Son çare: CEO veya ilk pozisyon
      if (!targetPos) {
        targetPos = positions.find(p => p.id === 'ceo' || p.level === 1) || positions[0]
      }

      if (targetPos) {
        setIsDirectiveRunning(true)
        updatePositionStatus(targetPos.id, 'executing', `Yürütülüyor: ${effectivePrompt.slice(0, 30)}...`)
        wsClient.sendDirective({
          sessionId: activeThreadId,
          prompt: effectivePrompt,
          preset: targetPos.presetId || targetPos.id,
          workspace: targetPos.workspace,
          attachments
        })
        addReceipt({
          positionId: targetPos.id,
          positionTitle: targetPos.title,
          actionType: 'directive_issued',
          summary: `💬 ${targetPos.title} oturumuna mesaj iletildi: "${displayContent.slice(0, 80)}..."`,
          details: { sessionId: activeThreadId, prompt: displayContent }
        })
        return
      }
    }

    // CASE 2: Fresh chat - start new meeting or directive
    handleExecuteDirective({
      prompt: effectivePrompt,
      targetPositionIds: targets,
      scheduleType: 'instant',
      attachments
    })
  }

  // Handle single position instruction from drawer
  const handleSendSingleInstruction = async (pos: Position, prompt: string) => {
    updatePositionStatus(pos.id, 'executing', `Talimat yürütülüyor: ${prompt.slice(0, 30)}...`)

    const effectivePrompt = prompt

    try {
      const session = await createSession(`[${pos.title}] ${prompt.slice(0, 30)}...`, pos.workspace)
      sessionToPositionRef.current.set(session.id, pos.id)

      const newThread: ChatThread = {
        id: session.id,
        title: `[${pos.title}] ${prompt.slice(0, 24)}...`,
        period: 'today',
        timestamp: Date.now(),
        sessionId: session.id,
        targetPositionId: pos.id
      }
      setChatThreads(prev => [newThread, ...prev.filter(t => t.id !== session.id)])
      setActiveThreadId(session.id)

      wsClient.sendDirective({
        sessionId: session.id,
        prompt: effectivePrompt,
        preset: pos.presetId,
        workspace: pos.workspace
      })
    } catch (err: any) {
      updatePositionStatus(pos.id, 'error', `Hata: ${err.message}`)
    }
  }

  // Add Position
  const handleAddPosition = async (newPosData: Omit<Position, 'status' | 'currentAction' | 'lastActive'>) => {
    const newPos: Position = {
      ...newPosData,
      systemPrompt: newPosData.systemPrompt || '',
      status: 'idle',
      currentAction: 'Yeni eklendi, hazır'
    }
    await hookAddPosition(newPos)
    addReceipt({
      positionId: newPos.id,
      positionTitle: newPos.title,
      actionType: 'directive_issued',
      summary: `Yeni koltuk oluşturuldu: ${newPos.title} (Level ${newPos.level})`,
      details: newPos
    })
  }

  // Update Position
  const handleUpdatePosition = async (updated: Position) => {
    await hookUpdatePosition(updated)
    setSelectedPosition(updated)
    addReceipt({
      positionId: updated.id,
      positionTitle: updated.title,
      actionType: 'directive_issued',
      summary: `Koltuk yetki ve tanımları güncellendi: ${updated.title}`,
      details: updated
    })
  }

  // Delete Position
  const handleDeletePosition = async (posId: string) => {
    const pos = positions.find(p => p.id === posId)
    await hookDeletePosition(posId)
    setSelectedPosition(null)
    addReceipt({
      positionId: posId,
      positionTitle: pos?.title || posId,
      actionType: 'directive_issued',
      summary: `Koltuk organizasyondan kaldırıldı: ${pos?.title || posId}`
    })
  }

  // Delete Routine
  const handleDeleteRoutine = async (id: string) => {
    try {
      setRoutines(prev => prev.filter(r => r.id !== id))
      await deleteSchedule(id)
      await loadRoutines()
      addReceipt({
        positionId: 'system',
        positionTitle: 'Zamanlayıcı',
        actionType: 'directive_issued',
        summary: `Zamanlanmış kural iptal edildi: [${id}]`
      })
    } catch (err) {
      console.error('Rutin silinemedi:', err)
      loadRoutines()
    }
  }

  // Delete Receipt / Completed Task Output
  const handleDeleteReceipt = (receiptId: string) => {
    setReceipts(prev => prev.filter(r => r.id !== receiptId))
  }

  // Update Routine Interval (e.g. set to 60s)
  const handleUpdateRoutineInterval = async (id: string, everySeconds: number) => {
    try {
      const current = routines.find(r => r.id === id)
      if (!current) return
      await deleteSchedule(id)
      await createSchedule({
        prompt: current.prompt,
        preset: current.preset,
        workspace: current.workspace,
        every_seconds: everySeconds
      })
      await loadRoutines()
      addReceipt({
        positionId: current.preset || 'system',
        positionTitle: 'Zamanlayıcı',
        actionType: 'directive_issued',
        summary: `Rutin periyodu güncellendi: [${id}] ➔ ${everySeconds} saniyede bir (${Math.round(everySeconds / 60)} dk)`
      })
    } catch (err) {
      console.error('Rutin güncellenemedi:', err)
    }
  }

  // Trigger Routine Immediately
  const handleTriggerRoutine = async (id: string) => {
    try {
      wsClient.send('schedule_trigger', { id })
      await triggerSchedule(id)
      const current = routines.find(r => r.id === id)
      addReceipt({
        positionId: current?.preset || 'system',
        positionTitle: 'Zamanlayıcı',
        actionType: 'directive_issued',
        summary: `⚡ Rutin tetiklendi: [${id}]`
      })
      setTimeout(() => {
        loadRoutines()
      }, 800)
    } catch (err) {
      console.error('Rutin tetiklenemedi:', err)
    }
  }

  // Update Company Workspace
  const handleUpdateCompanyWorkspace = (name: string, rootWorkspace: string, updateAllPositions: boolean) => {
    setCompanyName(name)
    setCompanyWorkspace(rootWorkspace)
    try {
      localStorage.setItem('company_os_name', name)
      localStorage.setItem('company_os_workspace', rootWorkspace)
    } catch {}

    // Synchronize workspace with backend server (isolated per user / global admin)
    setWorkspaceApi(rootWorkspace, activeThreadId, true)

    if (updateAllPositions) {
      setPositions(prev => prev.map(p => {
        if (p.id === 'full-stack' || p.presetId === 'full-stack') return p
        return { ...p, workspace: rootWorkspace }
      }))
    }

    addReceipt({
      positionId: 'ceo',
      positionTitle: 'Genel Müdür (CEO)',
      actionType: 'directive_issued',
      summary: `🏢 Şirket çalışma alanı güncellendi: "${name}" (${rootWorkspace})`,
      details: { name, workspace: rootWorkspace, updateAllPositions }
    })
  }

  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length

  return (
    <div className="atlantic-layout">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        companyName={companyName}
        onOpenCompanyWorkspace={() => setCurrentView('settings')}
        pendingApprovalsCount={pendingApprovalsCount}
        chatThreads={chatThreads}
        activeThreadId={activeThreadId}
        onSelectThread={(t) => {
          setActiveThreadId(t.id)
          setCurrentView('assistant')
        }}
        onNewChat={() => {
          setActiveThreadId('')
          setMessages([])
          setStreamingText('')
          setStreamingThought('')
          setActionCards([])
          setCurrentView('assistant')
        }}
        onDeleteThread={(threadId, e) => {
          e.stopPropagation()
          handleDeleteThread(threadId)
        }}
        onClearAllThreads={handleClearAllThreads}
      />

      {/* 2. Main Content Area */}
      <div className="main-content-area">
        {/* Topbar inside Viewport */}
        <header className="viewport-topbar">
          <div className="topbar-left-breadcrumb">
            <span className="breadcrumb-root">{companyName}</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">
              {currentView === 'dashboard' && 'Dashboard'}
              {currentView === 'assistant' && 'Command Center'}
              {currentView === 'cases' && 'Cases & Runs'}
              {currentView === 'tasks' && 'Tasks & Directives'}
              {currentView === 'recurring' && 'Scheduled Jobs'}
              {currentView === 'approvals' && 'Approvals'}
              {currentView === 'workflows' && 'Workflows & DAG'}
              {currentView === 'agents' && 'Positions'}
              {currentView === 'positions' && 'Positions'}
              {currentView === 'company' && 'Organization Graph'}
              {currentView === 'org-graph' && 'Organization Graph'}
              {currentView === 'knowledge' && 'Knowledge'}
              {currentView === 'skills' && 'Skills'}
              {currentView === 'integrations' && 'Integrations'}
              {currentView === 'roi' && 'Decision Ledger'}
              {currentView === 'inspector' && 'Agent Debug'}
              {currentView === 'settings' && 'System Settings'}
            </span>
          </div>

          <div className="topbar-actions">
            <div className="status-pill">
              <div className="status-pulse-dot" />
              <span>{isConnected ? 'Sistem Çevrimiçi' : 'Bağlanıyor...'}</span>
            </div>

            <button
              type="button"
              className="btn-add-pos-quick"
              onClick={() => setIsNewPositionModalOpen(true)}
            >
              <span>➕</span>
              <span>Koltuk Ekle</span>
            </button>

            <button
              type="button"
              className="btn-directive-quick"
              onClick={() => setIsDirectiveModalOpen(true)}
            >
              <span>⚡</span>
              <span>Direktif Ver</span>
            </button>
          </div>
        </header>

        {/* Viewport Dynamic Page Content */}
        <div className="viewport-scroll-body">
          {currentView === 'dashboard' && (
            <DashboardPage
              positions={positions}
              routines={routines}
              receipts={receipts}
              approvals={approvals}
              onOpenDirective={() => setIsDirectiveModalOpen(true)}
              onSelectPosition={(pos) => setSelectedPosition(pos)}
              onNavigateView={(v) => setCurrentView(v)}
              companyName={companyName}
            />
          )}

          {/* Always Keep AssistantPage Mounted to Prevent Interrupted Live Streaming & Lost Input State */}
          <div style={{
            display: currentView === 'assistant' ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            position: 'relative'
          }}>
            <AssistantPage
              positions={positions}
              messages={messages}
              onSendMessage={handleSendMessage}
              onAbort={handleAbort}
              isExecuting={isDirectiveRunning}
              streamingText={streamingText}
              streamingThought={streamingThought}
              actionCards={actionCards}
              onToggleCard={toggleCard}
              onOpenReport={(path) => setSelectedReportPath(path)}
              activeSessionId={activeThreadId || undefined}
              activeSessionTitle={chatThreads.find(t => t.id === activeThreadId)?.title}
              onDeleteActiveSession={() => {
                if (activeThreadId) {
                  handleDeleteThread(activeThreadId)
                }
              }}
              onRefreshSession={() => {
                if (activeThreadId) {
                  loadSessionMessages(activeThreadId)
                }
              }}
              companyWorkspace={companyWorkspace}
              tokenMeasurement={sessionMeasurement}
            />
          </div>

          {currentView === 'approvals' && (
            <ApprovalsPage
              approvals={approvals}
              policy={approvalPolicy}
              onSelectPolicy={handleSelectApprovalPolicy}
              onApprove={handleApprove}
              onDeny={handleDeny}
              onRefresh={() => {
                console.log('Approvals refreshed')
              }}
              onOpenChat={() => setCurrentView('assistant')}
            />
          )}

          {/* Positions — koltuk listesi (eski 'agents') */}
          {(currentView === 'agents' || currentView === 'positions') && (
            <AgentsPage
              positions={positions}
              onSelectPosition={(pos) => setSelectedPosition(pos)}
              onDirectDirective={(pos) => setSelectedPosition(pos)}
              onViewReport={(reportPath) => setSelectedReportPath(reportPath)}
              onAddNewPosition={() => setIsNewPositionModalOpen(true)}
              onOpenChatWithAgent={(_pos) => {
                setCurrentView('assistant')
              }}
              isDirectiveRunning={isDirectiveRunning}
            />
          )}

          {/* Cases & Runs (eski 'tasks') */}
          {(currentView === 'tasks' || currentView === 'cases') && (
            <TasksPage
              positions={positions}
              receipts={receipts}
              routines={routines}
              chatThreads={chatThreads}
              approvals={approvals}
              onOpenDirective={() => setIsDirectiveModalOpen(true)}
              onViewReport={(reportPath) => setSelectedReportPath(reportPath)}
              onSelectThread={(t) => {
                setActiveThreadId(t.id)
                setCurrentView('assistant')
              }}
              onRefresh={() => loadRoutines()}
              onDeleteRoutine={handleDeleteRoutine}
              onDeleteReceipt={handleDeleteReceipt}
              onUpdateRoutineInterval={handleUpdateRoutineInterval}
              onTriggerRoutine={handleTriggerRoutine}
              isDirectiveRunning={isDirectiveRunning}
            />
          )}

          {/* Organization Graph — sadece OrgChart hiyerarşisi */}
          {(currentView === 'company' || currentView === 'org-graph') && (
            <OrgChart
              positions={positions}
              onSelectPosition={(pos) => setSelectedPosition(pos)}
              onDirectDirective={(pos) => setSelectedPosition(pos)}
              onViewReport={(reportPath) => setSelectedReportPath(reportPath)}
              isDirectiveRunning={isDirectiveRunning}
            />
          )}

          {currentView === 'recurring' && (
            <RoutinesView
              routines={routines}
              positions={positions}
              onDeleteRoutine={handleDeleteRoutine}
              onCreateRoutine={async (payload) => {
                await createSchedule(payload)
                loadRoutines()
              }}
              isLoading={isRoutinesLoading}
            />
          )}

          {currentView === 'roi' && (
            <ActivityStream
              receipts={receipts}
              positions={positions}
              onClearReceipts={() => setReceipts([])}
              onOpenSession={(sId) => {
                setActiveThreadId(sId)
                setCurrentView('assistant')
              }}
            />
          )}

          {currentView === 'integrations' && (
            <IntegrationsPage />
          )}

          {currentView === 'knowledge' && (
            <KnowledgeBasePage
              companyWorkspace={companyWorkspace}
              companyName={companyName}
              onOpenFile={(path) => setSelectedReportPath(path)}
            />
          )}

          {currentView === 'skills' && (
            <SkillsPage
              companyWorkspace={companyWorkspace}
              companyName={companyName}
            />
          )}

          {currentView === 'workflows' && (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: '600px' }}>
              {/* DAG Viewer — canlı execution ağacı */}
              {dagNodes.length > 0 && (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(15,23,42,0.5)' }}>
                    <FlowIcon size={14} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Live Execution DAG</span>
                    {dagNodes.some(n => n.status === 'running') && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fbbf24', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                    )}
                    <button className="btn-secondary" style={{ marginLeft: 'auto', fontSize: '11px', padding: '4px 10px' }} onClick={() => setDagNodes([])}>
                      Clear
                    </button>
                  </div>
                  <ExecutionDagViewer
                    nodes={dagNodes}
                    activeTraceId={activeTraceId}
                    positions={positions}
                    onOpenSession={(sId) => {
                      setActiveThreadId(sId)
                      setCurrentView('assistant')
                    }}
                    onClearGraph={() => setDagNodes([])}
                  />
                </div>
              )}
              {/* Workflow Şablonları */}
              <WorkflowsPage
                positions={positions}
                onRunWorkflow={(title, targetIds) => {
                  handleExecuteDirective({
                    prompt: `[İş Akışı Başlatıldı]: ${title}. İlgili tüm adımları sırayla işletip konsolide durum raporunu masaya koyun.`,
                    targetPositionIds: targetIds,
                    scheduleType: 'instant'
                  })
                  setCurrentView('assistant')
                }}
                isExecuting={isDirectiveRunning}
              />
            </div>
          )}

          {currentView === 'inspector' && (
            <InspectorPage
              chatThreads={chatThreads}
              activeSessionId={activeThreadId || undefined}
              companyWorkspace={companyWorkspace}
            />
          )}

          {currentView === 'settings' && (
            <SettingsPage
              companyName={companyName}
              companyWorkspace={companyWorkspace}
              positions={positions}
              onSaveWorkspace={handleUpdateCompanyWorkspace}
              threadsCount={chatThreads.length}
            />
          )}
        </div>
      </div>

      {/* Position Drawer */}
      <PositionDrawer
        position={selectedPosition}
        onClose={() => setSelectedPosition(null)}
        onSendInstruction={handleSendSingleInstruction}
        onViewReport={(path) => setSelectedReportPath(path)}
        receipts={receipts}
        isExecuting={selectedPosition?.status === 'executing'}
        onUpdatePosition={handleUpdatePosition}
        onDeletePosition={handleDeletePosition}
        companyWorkspace={companyWorkspace}
        allPositions={positions}
      />

      {/* Directive Modal */}
      {isDirectiveModalOpen && (
        <DirectiveModal
          isOpen={isDirectiveModalOpen}
          onClose={() => setIsDirectiveModalOpen(false)}
          positions={positions}
          onExecuteDirective={handleExecuteDirective}
        />
      )}

      {/* New Position Modal */}
      {isNewPositionModalOpen && (
        <NewPositionModal
          isOpen={isNewPositionModalOpen}
          onClose={() => setIsNewPositionModalOpen(false)}
          positions={positions}
          onAddPosition={handleAddPosition}
        />
      )}

      {/* Company Workspace Modal */}
      {isCompanyModalOpen && (
        <CompanyWorkspaceModal
          isOpen={isCompanyModalOpen}
          onClose={() => setIsCompanyModalOpen(false)}
          companyName={companyName}
          companyWorkspace={companyWorkspace}
          positions={positions}
          onSave={handleUpdateCompanyWorkspace}
        />
      )}

      {/* Report Viewer Modal */}
      <ReportViewerModal
        reportPath={selectedReportPath}
        onClose={() => setSelectedReportPath(null)}
      />
    </div>
  )
}
