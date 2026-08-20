import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import type { ChatMessageItem, ApprovalItem } from '@custom-harness/client-ui-conversation'
import type { SessionInfo } from '@custom-harness/client-ui-sidebar'
import type { TokenMeasurement } from '@custom-harness/client-ui-token-meter'
import type { ToastItem } from './ToastContainer.js'

export interface AgentContextValue {
  isConnected: boolean
  isStreaming: boolean
  workspace: string
  settings: any
  presets: any[]
  activePreset: any
  sessions: SessionInfo[]
  activeSessionId: string | null
  messages: ChatMessageItem[]
  tokenMeasurement: TokenMeasurement | null
  toasts: ToastItem[]
  pendingApproval: ApprovalItem | null
  pendingQuestion: any | null
  respondApproval: (id: string, outcome: 'allow_once' | 'allow_always' | 'deny') => void
  respondQuestion: (id: string, answers: any[]) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  sendMessage: (text: string) => void
  stopStreaming: () => void
  selectSession: (sessionId: string) => void
  createNewSession: () => void
  deleteSession: (sessionId: string) => void
  clearAllSessions: () => Promise<void>
  renameSession: (sessionId: string, newTitle: string) => void
  selectModel: (modelId: string) => void
  selectPreset: (presetNameOrId: string) => void
  saveSettings: (newSettings: any) => Promise<void>
  savePreset: (preset: any) => Promise<void>
  setDefaultPreset: (presetId: string) => Promise<void>
  togglePlugin: (pluginId: string, enabled: boolean) => Promise<void>
  setWorkspace: (newPath: string) => Promise<void>
}

const defaultContextValue: AgentContextValue = {
  isConnected: false,
  isStreaming: false,
  workspace: '/workspace',
  settings: { providers: {}, defaultProvider: 'vllm' },
  presets: [],
  activePreset: { name: 'Full-Stack Developer' },
  sessions: [],
  activeSessionId: null,
  messages: [],
  tokenMeasurement: null,
  toasts: [],
  pendingApproval: null,
  pendingQuestion: null,
  respondApproval: () => {},
  respondQuestion: () => {},
  showToast: () => {},
  sendMessage: () => {},
  stopStreaming: () => {},
  selectSession: () => {},
  createNewSession: () => {},
  deleteSession: () => {},
  clearAllSessions: async () => {},
  renameSession: () => {},
  selectModel: () => {},
  selectPreset: () => {},
  saveSettings: async () => {},
  savePreset: async () => {},
  setDefaultPreset: async () => {},
  togglePlugin: async () => {},
  setWorkspace: async () => {}
}

const AgentContext = createContext<AgentContextValue>(defaultContextValue)
const ContextProvider = AgentContext.Provider as any

export function AgentProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [workspace, setWorkspaceState] = useState('/workspace')
  const [settings, setSettings] = useState<any>({ providers: {}, defaultProvider: 'vllm' })
  const [presets, setPresets] = useState<any[]>([])
  const [activePreset, setActivePreset] = useState<any>({ name: 'Full-Stack Developer' })
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [tokenMeasurement, setTokenMeasurement] = useState<TokenMeasurement | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [pendingApproval, setPendingApproval] = useState<ApprovalItem | null>(null)
  const [pendingQuestion, setPendingQuestion] = useState<any | null>(null)

  const wsRef = useRef<WebSocket | null>(null)

  const respondApproval = (id: string, outcome: 'allow_once' | 'allow_always' | 'deny') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'approval_response', id, outcome }))
    }
    setPendingApproval(null)
  }

  const respondQuestion = (id: string, answers: any[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'user_question_response', id, answers }))
    }
    setPendingQuestion(null)
  }

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  // 1. Initial REST API Loaders
  const loadWorkspace = async () => {
    try {
      const res = await fetch('/api/workspace')
      const data = await res.json()
      if (data.cwd) setWorkspaceState(data.cwd)
    } catch {}
  }

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setSettings(data)
    } catch {}
  }

  const loadPresets = async () => {
    try {
      const res = await fetch('/api/presets')
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.presets || []
      setPresets(list)
      if (data.activePreset) {
        setActivePreset(data.activePreset)
      } else {
        const found = list.find((p: any) => p.isDefault) || list[0]
        if (found) setActivePreset(found)
      }
    } catch {}
  }

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : data.sessions || [])
    } catch {}
  }

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
      }
      fetchMeasurement(sessionId)
    } catch (e) {
      console.error('Failed to load session messages:', e)
    }
  }

  const fetchMeasurement = async (sessionId?: string) => {
    try {
      const url = sessionId ? `/api/context/measure?sessionId=${sessionId}` : '/api/context/measure'
      const res = await fetch(url)
      const data = await res.json()
      if (data && (data.totalTokens !== undefined || data.contextPressure !== undefined)) {
        setTokenMeasurement(data)
      }
    } catch {}
  }

  // 2. WebSocket Stream Client with Auto-Reconnect
  useEffect(() => {
    loadWorkspace()
    loadSettings()
    loadPresets()
    loadSessions()
    fetchMeasurement()

    let ws: WebSocket | null = null
    let reconnectTimeout: any = null
    let isCleanedUp = false

    const connectWs = () => {
      if (isCleanedUp) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}`
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!isCleanedUp) setIsConnected(true)
      }

      ws.onclose = () => {
        if (!isCleanedUp) {
          setIsConnected(false)
          reconnectTimeout = setTimeout(connectWs, 2000)
        }
      }

      ws.onerror = () => {
        if (!isCleanedUp) setIsConnected(false)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'connected') {
            if (!isCleanedUp) setIsConnected(true)
            return
          }
          handleServerMessage(data)
        } catch (err) {
          console.error('[WS Parse Error]:', err)
        }
      }
    }

    connectWs()

    return () => {
      isCleanedUp = true
      clearTimeout(reconnectTimeout)
      ws?.close()
    }
  }, [])

  const handleServerMessage = (msg: any) => {
    if (msg.type === 'user_question_request') {
      setPendingQuestion({ id: msg.id, questions: msg.questions })
    }

    if (msg.type === 'approval_request' && msg.request) {
      setPendingApproval(msg.request)
    }

    if (msg.sessionId) {
      setActiveSessionId(msg.sessionId)
    }

    if (msg.measurement) {
      setTokenMeasurement(msg.measurement)
    }

    if (msg.type === 'thought') {
      setTokenMeasurement((prev) => {
        const tok = Math.max(1, Math.ceil(msg.text.length / 4))
        const sys = prev ? (prev.systemPromptTokens ?? (prev as any).contextBreakdown?.systemTokens ?? 120) : 120
        const tools = prev ? (prev.toolsTokens ?? (prev as any).contextBreakdown?.toolsTokens ?? 650) : 650
        const hist = (prev ? (prev.historyTokens ?? (prev as any).contextBreakdown?.messageTokens ?? 0) : 0) + tok
        const total = sys + tools + hist
        const cw = (prev ? (prev.contextWindow ?? (prev as any).contextPressure?.contextWindow ?? 24576) : 24576)
        return {
          ...(prev || {}),
          systemPromptTokens: sys,
          toolsTokens: tools,
          historyTokens: hist,
          totalTokens: total,
          contextWindow: cw,
          percentage: Math.min(100, Math.round((total / cw) * 100))
        }
      })
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              reasoning_content: (last.reasoning_content || '') + msg.text,
              isStreaming: true
            }
          ]
        }
        return [
          ...prev,
          {
            role: 'assistant',
            reasoning_content: msg.text,
            isStreaming: true
          }
        ]
      })
    } else if (msg.type === 'chunk') {
      setTokenMeasurement((prev) => {
        const tok = Math.max(1, Math.ceil(msg.text.length / 4))
        const sys = prev ? (prev.systemPromptTokens ?? (prev as any).contextBreakdown?.systemTokens ?? 120) : 120
        const tools = prev ? (prev.toolsTokens ?? (prev as any).contextBreakdown?.toolsTokens ?? 650) : 650
        const hist = (prev ? (prev.historyTokens ?? (prev as any).contextBreakdown?.messageTokens ?? 0) : 0) + tok
        const total = sys + tools + hist
        const cw = (prev ? (prev.contextWindow ?? (prev as any).contextPressure?.contextWindow ?? 24576) : 24576)
        return {
          ...(prev || {}),
          systemPromptTokens: sys,
          toolsTokens: tools,
          historyTokens: hist,
          totalTokens: total,
          contextWindow: cw,
          percentage: Math.min(100, Math.round((total / cw) * 100))
        }
      })
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: (last.content || '') + msg.text,
              isStreaming: true
            }
          ]
        }
        return [
          ...prev,
          {
            role: 'assistant',
            content: msg.text,
            isStreaming: true
          }
        ]
      })
    } else if (msg.type === 'tool_start') {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          const currentTools = last.toolResults || []
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolResults: [
                ...currentTools,
                {
                  id: msg.call.id,
                  name: msg.call.name,
                  args: msg.call.args,
                  status: 'running'
                }
              ]
            }
          ]
        }
        return prev
      })
    } else if (msg.type === 'tool_result') {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && last.toolResults) {
          const updated = [...last.toolResults]
          const target = updated[updated.length - 1]
          if (target) {
            target.output = msg.result.output
            target.status = 'done'
          }
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolResults: updated
            }
          ]
        }
        return prev
      })
    } else if (msg.type === 'compaction') {
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          compactionInfo: msg.info
        }
      ])
    } else if (msg.type === 'done') {
      setIsStreaming(false)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              isStreaming: false
            }
          ]
        }
        return prev
      })
      loadSessions()
      if (msg.sessionId) fetchMeasurement(msg.sessionId)
    } else if (msg.type === 'error') {
      setIsStreaming(false)
      showToast('LLM Hatası: ' + msg.error, 'error')
    }
  }

  const sendMessage = (text: string) => {
    if (!text.trim() || isStreaming) return

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      showToast('Sunucuya bağlanılıyor, lütfen 1-2 saniye sonra tekrar deneyin...', 'info')
      return
    }

    // Append user message locally
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: text
      }
    ])

    // Optimistically update context bar on user prompt
    setTokenMeasurement((prev) => {
      const userTok = Math.max(1, Math.ceil(text.length / 4))
      const sys = prev ? (prev.systemPromptTokens ?? (prev as any).contextBreakdown?.systemTokens ?? 120) : 120
      const tools = prev ? (prev.toolsTokens ?? (prev as any).contextBreakdown?.toolsTokens ?? 650) : 650
      const hist = (prev ? (prev.historyTokens ?? (prev as any).contextBreakdown?.messageTokens ?? 0) : 0) + userTok
      const total = sys + tools + hist
      const cw = (prev ? (prev.contextWindow ?? (prev as any).contextPressure?.contextWindow ?? 24576) : 24576)
      return {
        ...(prev || {}),
        systemPromptTokens: sys,
        toolsTokens: tools,
        historyTokens: hist,
        totalTokens: total,
        contextWindow: cw,
        percentage: Math.min(100, Math.round((total / cw) * 100))
      }
    })

    setIsStreaming(true)

    wsRef.current.send(
      JSON.stringify({
        type: 'chat',
        sessionId: activeSessionId || undefined,
        prompt: text,
        providerId: settings.defaultProvider,
        modelId: settings.defaultModel
      })
    )
  }

  const stopStreaming = () => {
    if (wsRef.current && isStreaming) {
      wsRef.current.send(JSON.stringify({ type: 'abort', sessionId: activeSessionId }))
      setIsStreaming(false)
      showToast('İşlem durduruldu', 'info')
    }
  }

  const selectSession = (sessionId: string) => {
    setActiveSessionId(sessionId)
    setPendingApproval(null)
    loadSessionMessages(sessionId)
  }

  const createNewSession = () => {
    setActiveSessionId(null)
    setMessages([])
    setPendingApproval(null)
    setTokenMeasurement((prev) => {
      const sys = prev ? (prev.systemPromptTokens ?? (prev as any).contextBreakdown?.systemTokens ?? 120) : 120
      const tools = prev ? (prev.toolsTokens ?? (prev as any).contextBreakdown?.toolsTokens ?? 650) : 650
      const total = sys + tools
      const cw = prev?.contextWindow || 24576
      const pct = Math.min(100, Math.round((total / cw) * 100))
      return {
        ...(prev || {}),
        modelId: prev?.modelId || 'default-model',
        contextWindow: cw,
        systemPromptTokens: sys,
        toolsTokens: tools,
        historyTokens: 0,
        totalTokens: total,
        percentage: pct,
        contextBreakdown: {
          systemTokens: sys,
          toolsTokens: tools,
          messageTokens: 0,
          systemPercent: Math.round((sys / total) * 100),
          toolsPercent: Math.round((tools / total) * 100),
          messagePercent: 0
        },
        contextPressure: {
          usedTokens: total,
          contextWindow: cw,
          percent: pct,
          projectedTokens: total
        }
      }
    })
    fetchMeasurement('')
  }

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      showToast('Sohbet silindi', 'info')
      loadSessions()
      if (activeSessionId === sessionId) {
        createNewSession()
      }
    } catch {
      showToast('Sohbet silinemedi', 'error')
    }
  }

  const clearAllSessions = async () => {
    try {
      await fetch('/api/sessions/clear', { method: 'POST' })
      setSessions([])
      setMessages([])
      createNewSession()
      showToast('Tüm geçmiş sohbetler temizlendi', 'info')
    } catch {
      showToast('Sohbetler temizlenemedi', 'error')
    }
  }

  const saveSettings = async (newSettings: any) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })
      const saved = await res.json()
      setSettings(saved)
      showToast('Ayarlar kaydedildi', 'success')
    } catch (e: any) {
      showToast('Ayarlar kaydedilemedi: ' + e.message, 'error')
    }
  }

  const savePreset = async (preset: any) => {
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset)
      })
      const saved = await res.json()
      showToast(`Preset kaydedildi: ${saved.name}`, 'success')
      loadPresets()
    } catch (e: any) {
      showToast('Preset kaydedilemedi: ' + e.message, 'error')
    }
  }

  const setDefaultPreset = async (presetId: string) => {
    try {
      await fetch('/api/presets/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId })
      })
      const found = presets.find((p) => p.id === presetId)
      if (found) setActivePreset(found)
    } catch {}
  }

  const togglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/plugins/${pluginId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })
      const data = await res.json()
      showToast(`Eklenti ${pluginId} ${enabled ? 'açıldı' : 'kapatıldı'}`, 'success')
      loadSettings()
    } catch (e: any) {
      showToast('Eklenti durumu değiştirilemedi: ' + e.message, 'error')
    }
  }

  const setWorkspace = async (newPath: string) => {
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath, sessionId: activeSessionId })
      })
      const data = await res.json()
      if (data.success && data.workspace) {
        setWorkspaceState(data.workspace)
        showToast(`Çalışma alanı güncellendi: ${data.workspace}`, 'success')
        loadWorkspace()
        loadSettings()
      } else if (data.error) {
        showToast(`Hata: ${data.error}`, 'error')
      }
    } catch (e: any) {
      showToast(`Hata: ${e.message}`, 'error')
    }
  }

  const renameSession = (sessionId: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s))
    showToast('Sohbet başlığı güncellendi', 'info')
  }

  const selectModel = async (modelId: string) => {
    const updated = { ...settings, defaultModel: modelId }
    setSettings(updated)
    await saveSettings(updated)
    showToast(`Aktif Model: ${modelId}`, 'info')
  }

  const selectPreset = (presetNameOrId: string) => {
    const found = presets.find((p) => p.id === presetNameOrId || p.name === presetNameOrId)
    if (found) {
      setActivePreset(found)
      showToast(`Ajan Rolü: ${found.name}`, 'info')
    }
  }

  return (
    <ContextProvider
      value={{
        isConnected,
        isStreaming,
        workspace,
        settings,
        presets,
        activePreset,
        sessions,
        activeSessionId,
        messages,
        tokenMeasurement,
        toasts,
        pendingApproval,
        pendingQuestion,
        respondApproval,
        respondQuestion,
        showToast,
        sendMessage,
        stopStreaming,
        selectSession,
        createNewSession,
        deleteSession,
        clearAllSessions,
        renameSession,
        selectModel,
        selectPreset,
        saveSettings,
        savePreset,
        setDefaultPreset,
        togglePlugin,
        setWorkspace
      }}
    >
      {children}
    </ContextProvider>
  )
}

export function useAgent(): AgentContextValue {
  const context = useContext<AgentContextValue>(AgentContext)
  if (!context) {
    return defaultContextValue
  }
  return context
}
