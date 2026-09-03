import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import type { ChatMessageItem, ApprovalItem, UploadedAttachment } from '@custom-harness/client-ui-conversation'
import type { SessionInfo } from '@custom-harness/client-ui-sidebar'
import type { TokenMeasurement } from '@custom-harness/client-ui-token-meter'
import type { User, UserRole } from '@custom-harness/core-types'
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
  attachments: UploadedAttachment[]
  isUploading: boolean
  currentUser: User | null
  users: User[]
  isAdmin: boolean
  token: string | null
  login: (credentials: { username: string; password?: string }) => Promise<void>
  register: (dto: { username: string; name: string; email?: string; password?: string; role?: UserRole; avatar?: string }) => Promise<void>
  logout: () => Promise<void>
  switchUser: (userId: string) => Promise<void>
  createUser: (dto: { username: string; name: string; email?: string; role: UserRole; avatar?: string }) => Promise<void>
  updateUserRole: (userId: string, role: UserRole) => Promise<void>
  deleteUser: (userId: string) => Promise<void>
  uploadFiles: (files: File[]) => Promise<void>
  attachFile: (file: UploadedAttachment) => void
  removeAttachment: (id: string) => void
  clearAttachments: () => void
  clearMessages: () => void
  respondApproval: (id: string, outcome: 'allow_once' | 'allow_always' | 'deny') => void
  respondQuestion: (id: string, answers: any[]) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  sendMessage: (text: string, atts?: UploadedAttachment[]) => void
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
  deletePreset: (presetId: string) => Promise<void>
  setDefaultPreset: (presetId: string) => Promise<void>

  togglePlugin: (pluginId: string, enabled: boolean) => Promise<void>
  setWorkspace: (newPath: string) => Promise<void>
  sandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access'
  setSandboxMode: (mode: 'read-only' | 'workspace-write' | 'danger-full-access') => Promise<void>
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
  attachments: [],
  isUploading: false,
  currentUser: null,
  users: [],
  isAdmin: false,
  token: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  switchUser: async () => {},
  createUser: async () => {},
  updateUserRole: async () => {},
  deleteUser: async () => {},
  uploadFiles: async () => {},
  attachFile: () => {},
  removeAttachment: () => {},
  clearAttachments: () => {},
  clearMessages: () => {},
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
  deletePreset: async () => {},
  setDefaultPreset: async () => {},

  togglePlugin: async () => {},
  setWorkspace: async () => {},
  sandboxMode: 'workspace-write',
  setSandboxMode: async () => {}
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
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('artificax_jwt_token')
    } catch {
      return null
    }
  })

  const wsRef = useRef<WebSocket | null>(null)
  const activePresetRef = useRef<any>(activePreset)
  activePresetRef.current = activePreset
  const settingsRef = useRef<any>(settings)
  settingsRef.current = settings

  const isAdmin = currentUser?.role === 'admin'

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
  const loadAuth = async () => {
    try {
      const savedToken = localStorage.getItem('artificax_jwt_token')
      const savedUserId = localStorage.getItem('artificax_user_id')
      if (!savedToken && !savedUserId) {
        setCurrentUser(null)
        return
      }
      const headers: Record<string, string> = {}
      if (savedUserId) headers['X-User-Id'] = savedUserId
      if (savedToken) headers['Authorization'] = `Bearer ${savedToken}`

      const res = await fetch('/api/auth/me', { headers })
      if (!res.ok) {
        setCurrentUser(null)
        return
      }
      const data = await res.json()
      if (data.user) {
        setCurrentUser(data.user)
        localStorage.setItem('artificax_user_id', data.user.id)
      } else {
        setCurrentUser(null)
      }
    } catch {
      setCurrentUser(null)
    }
  }

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/auth/users')
      const data = await res.json()
      if (Array.isArray(data.users)) {
        setUsers(data.users)
      }
    } catch {}
  }

  const login = async (credentials: { username: string; password?: string }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Giriş yapılamadı')
    }
    if (data.token) {
      setToken(data.token)
      localStorage.setItem('artificax_jwt_token', data.token)
    }
    if (data.user) {
      setCurrentUser(data.user)
      localStorage.setItem('artificax_user_id', data.user.id)
      showToast(`Hoş geldiniz, ${data.user.name}!`, 'success')
      const newToken = data.token || null
      loadSessions(data.user.id, newToken)
      loadSettings(data.user.id, newToken)
      loadPresets(data.user.id, newToken)
      loadWorkspace(data.user.id, newToken)
      setActiveSessionId(null)
      setMessages([])
      setAttachments([])
    }
  }

  const register = async (dto: { username: string; name: string; email?: string; password?: string; role?: UserRole; avatar?: string }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Kayıt başarısız')
    }
    if (data.token) {
      setToken(data.token)
      localStorage.setItem('artificax_jwt_token', data.token)
    }
    if (data.user) {
      setCurrentUser(data.user)
      localStorage.setItem('artificax_user_id', data.user.id)
      showToast(`Kiracı hesabı oluşturuldu: ${data.user.name}`, 'success')
      const newToken = data.token || null
      loadSessions(data.user.id, newToken)
      loadSettings(data.user.id, newToken)
      loadPresets(data.user.id, newToken)
      loadWorkspace(data.user.id, newToken)
      setActiveSessionId(null)
      setMessages([])
      setAttachments([])
    }
    loadUsers()
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    setToken(null)
    setCurrentUser(null)
    setSessions([])
    setMessages([])
    setActiveSessionId(null)
    localStorage.removeItem('artificax_jwt_token')
    localStorage.removeItem('artificax_user_id')
    showToast('Oturum kapatıldı. Lütfen giriş yapın.', 'info')
  }

  const switchUser = async (userId: string) => {
    try {
      const res = await fetch('/api/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      const data = await res.json()
      if (data.user) {
        setCurrentUser(data.user)
        localStorage.setItem('artificax_user_id', data.user.id)
        if (data.token) {
          setToken(data.token)
          localStorage.setItem('artificax_jwt_token', data.token)
        }
        showToast(`Kullanıcı değiştirildi: ${data.user.name} (${data.user.role === 'admin' ? 'Yönetici' : 'Kullanıcı'})`, 'success')
        // Reload sessions & settings & presets & workspace for the new tenant
        const newToken = data.token || null
        loadSessions(data.user.id, newToken)
        loadSettings(data.user.id, newToken)
        loadPresets(data.user.id, newToken)
        loadWorkspace(data.user.id, newToken)
        setActiveSessionId(null)
        setMessages([])
        setAttachments([])
      }
    } catch (err: any) {
      showToast(`Kullanıcı değiştirilemedi: ${err.message}`, 'error')
    }
  }

  const createUser = async (dto: { username: string; name: string; email?: string; role: UserRole; avatar?: string }) => {
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUser?.id || 'user_admin'
      },
      body: JSON.stringify(dto)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Kullanıcı oluşturulamadı')
    loadUsers()
  }

  const updateUserRole = async (userId: string, role: UserRole) => {
    const res = await fetch(`/api/auth/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUser?.id || 'user_admin'
      },
      body: JSON.stringify({ role })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Rol güncellenemedi')
    loadUsers()
    if (currentUser?.id === userId) {
      setCurrentUser(data.user)
    }
    showToast('Kullanıcı rolü güncellendi', 'success')
  }

  const deleteUser = async (userId: string) => {
    const res = await fetch(`/api/auth/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'X-User-Id': currentUser?.id || 'user_admin'
      }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Kullanıcı silinemedi')
    loadUsers()
    showToast('Kullanıcı silindi', 'success')
  }

  const loadWorkspace = async (userIdOverride?: string, tokenOverride?: string) => {
    try {
      const uid = userIdOverride || currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      const headers: Record<string, string> = { 'X-User-Id': uid }
      const currentToken = tokenOverride || (userIdOverride ? null : token) || localStorage.getItem('artificax_jwt_token')
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

      const res = await fetch('/api/workspace', { headers })
      const data = await res.json()
      if (data.cwd) setWorkspaceState(data.cwd)
    } catch {}
  }

  const loadSettings = async (userIdOverride?: string, tokenOverride?: string) => {
    try {
      const uid = userIdOverride || currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      const headers: Record<string, string> = { 'X-User-Id': uid }
      const currentToken = tokenOverride || (userIdOverride ? null : token) || localStorage.getItem('artificax_jwt_token')
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

      const res = await fetch('/api/settings', { headers })
      const data = await res.json()
      setSettings(data)
    } catch {}
  }

  const loadPresets = async (userIdOverride?: string, tokenOverride?: string) => {
    try {
      const uid = userIdOverride || currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      const headers: Record<string, string> = { 'X-User-Id': uid }
      const currentToken = tokenOverride || (userIdOverride ? null : token) || localStorage.getItem('artificax_jwt_token')
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

      const res = await fetch('/api/presets', { headers })
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

  const loadSessions = async (userIdOverride?: string, tokenOverride?: string) => {
    try {
      const uid = userIdOverride || currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      const headers: Record<string, string> = { 'X-User-Id': uid }
      const currentToken = tokenOverride || (userIdOverride ? null : token) || localStorage.getItem('artificax_jwt_token')
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

      const res = await fetch('/api/sessions', { headers })
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
      if (data.workspace) {
        setWorkspaceState(data.workspace)
      } else {
        loadWorkspace()
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
    loadAuth()
    loadUsers()
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

    if (msg.type === 'session_rename' && msg.sessionId && msg.title) {
      setSessions((prev) =>
        prev.map((s) => (s.id === msg.sessionId ? { ...s, title: msg.title } : s))
      )
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
            presetName: activePresetRef.current?.name || activePresetRef.current?.id || 'Full-Stack Developer',
            modelName: settingsRef.current?.defaultModel || 'Qwen3.8-27B',
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
              presetName: last.presetName || activePresetRef.current?.name || activePresetRef.current?.id || 'Full-Stack Developer',
              modelName: last.modelName || settingsRef.current?.defaultModel || 'Qwen3.8-27B',
              isStreaming: true
            }
          ]
        }
        return [
          ...prev,
          {
            role: 'assistant',
            content: msg.text,
            presetName: activePresetRef.current?.name || activePresetRef.current?.id || 'Full-Stack Developer',
            modelName: settingsRef.current?.defaultModel || 'Qwen3.8-27B',
            isStreaming: true
          }
        ]
      })
    } else if (msg.type === 'ensure_assistant') {
      // Server sends this before every tool_start to guarantee the UI has a CURRENT (streaming) assistant row.
      // IMPORTANT: A completed (isStreaming:false) assistant row from a previous turn must NOT be reused.
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        // Only reuse if last message is an actively-streaming assistant row
        if (last && last.role === 'assistant' && last.isStreaming) return prev
        // Otherwise create a new streaming assistant row for this turn's tool cards
        return [
          ...prev,
          {
            role: 'assistant' as const,
            content: '',
            presetName: activePresetRef.current?.name || activePresetRef.current?.id || 'Full-Stack Developer',
            modelName: settingsRef.current?.defaultModel || 'Qwen3.8-27B',
            isStreaming: true,
            toolResults: []
          }
        ]
      })
    } else if (msg.type === 'tool_start') {
      setMessages((prev) => {
        const newTool = {
          id: msg.call?.id || `tool-${Date.now()}`,
          name: msg.call?.name || 'unknown_tool',
          status: 'running' as const,
          args: msg.call?.args
        }

        // Find the last STREAMING assistant message — do NOT attach to completed previous turns
        const lastStreamingIdx = [...prev].reverse().findIndex(m => m.role === 'assistant' && m.isStreaming)
        const idx = lastStreamingIdx === -1 ? -1 : prev.length - 1 - lastStreamingIdx

        // No streaming assistant row → create one (fallback if ensure_assistant wasn't processed yet)
        if (idx === -1) {
          return [
            ...prev,
            {
              role: 'assistant' as const,
              content: '',
              presetName: activePresetRef.current?.name || activePresetRef.current?.id || 'Full-Stack Developer',
              modelName: settingsRef.current?.defaultModel || 'Qwen3.8-27B',
              isStreaming: true,
              toolResults: [newTool]
            }
          ]
        }

        const target = prev[idx]
        const currentTools = target.toolResults || []
        const updated = [...prev]
        updated[idx] = { ...target, toolResults: [...currentTools, newTool] }
        return updated
      })

    } else if (msg.type === 'tool_result') {
      setMessages((prev) => {
        // Find the last STREAMING assistant message that has toolResults (current turn only)
        let lastAssistantIdx = [...prev].reverse().findIndex(m => m.role === 'assistant' && m.isStreaming && m.toolResults && m.toolResults.length > 0)
        // Fallback: any assistant with toolResults
        if (lastAssistantIdx === -1) lastAssistantIdx = [...prev].reverse().findIndex(m => m.role === 'assistant' && m.toolResults && m.toolResults.length > 0)
        const idx = lastAssistantIdx === -1 ? -1 : prev.length - 1 - lastAssistantIdx
        if (idx === -1) return prev
        const target = prev[idx]
        const updatedTools = [...(target.toolResults || [])]
        // Find matching tool by id, or fall back to last running tool
        const toolIdx = msg.result?.id ? updatedTools.findIndex(t => t.id === msg.result.id) : -1
        const resolvedIdx = toolIdx !== -1 ? toolIdx : updatedTools.length - 1
        if (resolvedIdx >= 0 && updatedTools[resolvedIdx]) {
          updatedTools[resolvedIdx] = {
            ...updatedTools[resolvedIdx],
            output: msg.result.output,
            status: 'done'
          }
        }
        const updated = [...prev]
        updated[idx] = { ...target, toolResults: updatedTools }
        return updated
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
              presetName: last.presetName || activePresetRef.current?.name || activePresetRef.current?.id || 'Full-Stack Developer',
              modelName: last.modelName || settingsRef.current?.defaultModel || 'Qwen3.8-27B',
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

  const uploadFiles = async (files: File[]) => {
    if (!files || files.length === 0) return
    setIsUploading(true)
    showToast(`${files.length} dosya işleniyor...`, 'info')
    try {
      const filePayloads = await Promise.all(
        files.map(async (f) => {
          return new Promise<{ name: string; data: string; type: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              resolve({
                name: f.name,
                data: reader.result as string,
                type: f.type
              })
            }
            reader.onerror = () => reject(new Error(`${f.name} okunamadı`))
            reader.readAsDataURL(f)
          })
        })
      )

      const sid = activeSessionId || 'default'
      const uid = currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      const res = await fetch(`/api/upload/${sid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': uid
        },
        body: JSON.stringify({ files: filePayloads })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `Yükleme başarısız (${res.status})`)
      }

      const data = await res.json()
      if (data.files && Array.isArray(data.files) && data.files.length > 0) {
        setAttachments((prev) => [...prev, ...data.files])
        showToast(`✓ ${data.files.length} dosya eklendi`, 'success')
      } else {
        showToast('Dosya işlendi', 'info')
      }
    } catch (err: any) {
      console.error('[Upload Error]:', err)
      showToast(`Yükleme hatası: ${err.message}`, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const attachFile = (file: UploadedAttachment) => {
    setAttachments((prev) => {
      if (prev.some((a) => a.filePath === file.filePath)) return prev
      return [...prev, file]
    })
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const clearAttachments = () => {
    setAttachments([])
  }

  const clearMessages = () => {
    setMessages([])
    showToast('🧹 Sohbet ekranı temizlendi', 'info')
  }

  const sendMessage = (text: string, atts?: UploadedAttachment[]) => {
    const currentAttachments = atts || attachments
    const trimmed = text.trim()

    // 1. Client-Side Slash Command Interceptors
    if (trimmed === '/clear') {
      clearMessages()
      return
    }

    if (trimmed.startsWith('/think')) {
      const arg = trimmed.replace('/think', '').trim().toLowerCase()
      const currentThinking = !!(settings?.thinkingEnabled)
      const nextThinking = arg === 'on' || arg === '1' || arg === 'true'
        ? true
        : arg === 'off' || arg === '0' || arg === 'false'
        ? false
        : !currentThinking

      const newSettings = { ...settings, thinkingEnabled: nextThinking }
      setSettings(newSettings)
      saveSettings(newSettings)
      showToast(`💭 Model düşünme modu: ${nextThinking ? 'AÇIK (Derin Akıl Yürütme Aktif)' : 'KAPALI'}`, 'success')
      return
    }

    if (trimmed === '/compact') {
      if (!activeSessionId) {
        showToast('Özetlenecek aktif bir sohbet bulunmuyor.', 'info')
        return
      }
      showToast('📦 Sohbet geçmişi sıkıştırılıyor...', 'info')
      fetch(`/api/sessions/${activeSessionId}/compact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(currentUser?.id ? { 'X-User-Id': currentUser.id } : {})
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.compacted) {
            setMessages(data.messages || [])
            if (data.measurement) setTokenMeasurement(data.measurement)
            showToast(`📦 Sohbet geçmişi sıkıştırıldı (${data.prunedCount || 0} mesaj özetlendi)`, 'success')
          } else {
            showToast(data.message || 'Sohbet geçmişi henüz sıkıştırma eşiğine ulaşmadı.', 'info')
          }
        })
        .catch(err => {
          showToast(`Sıkıştırma hatası: ${err.message}`, 'error')
        })
      return
    }

    if (trimmed === '/tokens') {
      const used = tokenMeasurement?.totalTokens || 0
      const max = tokenMeasurement?.contextWindow || 32768
      const pct = Math.round((used / max) * 100)
      showToast(`📊 Canlı Token: ${used.toLocaleString()} / ${max.toLocaleString()} (%${pct} dolu)`, 'info')
      return
    }

    if (trimmed === '/help') {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `### ⚡ ArtificaX Komut ve Kısayol Rehberi\n\n` +
            `Aşağıdaki komutları doğrudan sohbet kutusuna yazarak veya **+** butonuna basarak kullanabilirsiniz:\n\n` +
            `- **\`/files\`**: 📁 **Dosyalarım** - Daha önce yüklediğiniz Excel, PDF ve görselleri sohbete bağlayın.\n` +
            `- **\`/think on|off\`**: 💭 **Düşünme Modu** - Modelin derin akıl yürütme yeteneğini açıp kapatın.\n` +
            `- **\`/rag\`**: 🧠 **RAG Bilgi Bankası** - pgvector bilgi bankası ve kaynak klasörleri yönetin.\n` +
            `- **\`/skills\`**: ✨ **Beceriler** - Özel uzmanlık talimatlarını ve izinleri yönetin.\n` +
            `- **\`/workspace\`**: 📂 **Çalışma Alanı** - Aktif proje dizinini değiştirin.\n` +
            `- **\`/goal <hedef>\`**: 🎯 **Otonom Hedef** - Modele kendi kendine çalışan bir hedef verin.\n` +
            `- **\`/compact\`**: 📦 **Bağlamı Sıkıştır** - Uzun sohbet geçmişini özetleyin.\n` +
            `- **\`/tokens\`**: 📊 **Token Sayacı** - Anlık token ve bağlam tüketimini ölçün.\n` +
            `- **\`/clear\`**: 🧹 **Ekranı Temizle** - Sohbet ekranını sıfırlayın.\n` +
            `- **\`/help\`**: ❓ **Yardım** - Bu komut rehberini tekrar görüntüleyin.\n\n` +
            `**Klavye Kısayolları:**\n` +
            `- <kbd>Enter</kbd>: Mesajı Gönder\n` +
            `- <kbd>Shift+Enter</kbd>: Yeni Satır\n` +
            `- <kbd>Ctrl+V</kbd>: Panodan Görsel Yapıştır\n` +
            `- <kbd>+</kbd> veya <kbd>/</kbd>: Hızlı İşlemler Menüsü`
        }
      ])
      return
    }

    if ((!trimmed && currentAttachments.length === 0) || isStreaming) return

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      showToast('Sunucuya bağlanılıyor, lütfen 1-2 saniye sonra tekrar deneyin...', 'info')
      return
    }

    // Append user message locally
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: text,
        attachments: currentAttachments.length > 0 ? [...currentAttachments] : undefined
      }
    ])

    // Clear attachments tray
    setAttachments([])

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
        workspace,
        prompt: text,
        providerId: settings.defaultProvider,
        modelId: settings.defaultModel,
        presetId: activePreset?.id || settings.defaultPreset,
        userId: currentUser?.id || 'user_admin',
        attachments: currentAttachments,
        enableThinking: !!(settings?.thinkingEnabled),
        thinkingBudgetTokens: settings?.thinkingEnabled ? 2048 : undefined
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
    loadWorkspace()
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
      const uid = currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': uid
        },
        body: JSON.stringify(newSettings)
      })
      const saved = await res.json()
      if (!res.ok || saved.error) {
        showToast(saved.error || 'Ayarlar kaydedilemedi', 'error')
        return
      }
      setSettings(saved)
      if (saved.workspace) {
        setWorkspaceState(saved.workspace)
      }
      showToast('Ayarlar kaydedildi', 'success')
    } catch (e: any) {
      showToast('Ayarlar kaydedilemedi: ' + e.message, 'error')
    }
  }

  const savePreset = async (preset: any) => {
    try {
      const uid = currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': uid
        },
        body: JSON.stringify(preset)
      })
      const saved = await res.json()
      if (!res.ok || saved.error) {
        showToast(saved.error || 'Preset kaydedilemedi', 'error')
        return
      }
      showToast(`Preset kaydedildi: ${saved.preset?.name || preset.name || 'Önayar'}`, 'success')
      loadPresets()
    } catch (e: any) {
      showToast('Preset kaydedilemedi: ' + e.message, 'error')
    }
  }

  const deletePreset = async (presetId: string) => {
    try {
      const uid = currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      const res = await fetch(`/api/presets/${encodeURIComponent(presetId)}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': uid
        }
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        showToast(data.error || 'Preset silinemedi', 'error')
        return
      }
      showToast('Ajan profili başarıyla silindi', 'success')
      await loadPresets()
    } catch (e: any) {
      showToast('Preset silinemedi: ' + e.message, 'error')
    }
  }

  const setDefaultPreset = async (presetId: string) => {

    try {
      const uid = currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      await fetch('/api/presets/default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': uid
        },
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
      const uid = currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
      const currentToken = token || localStorage.getItem('artificax_jwt_token')
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-User-Id': uid
      }
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          path: newPath,
          sessionId: activeSessionId,
          global: currentUser?.role === 'admin'
        })
      })
      const data = await res.json()
      if (data.success && data.workspace) {
        setWorkspaceState(data.workspace)
        showToast(`Çalışma alanı güncellendi: ${data.workspace}`, 'success')
        loadWorkspace(uid)
        loadSettings(uid)
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
    let targetProviderId = settings.defaultProvider || 'gemma-local'
    if (settings.providers) {
      for (const [pId, pConfig] of Object.entries<any>(settings.providers)) {
        if (
          pConfig.models?.some((m: any) =>
            m.id === modelId ||
            m.name === modelId ||
            m.id?.toLowerCase() === modelId.toLowerCase() ||
            m.name?.toLowerCase() === modelId.toLowerCase() ||
            m.id?.toLowerCase()?.includes(modelId.toLowerCase()) ||
            m.name?.toLowerCase()?.includes(modelId.toLowerCase())
          ) ||
          pId.toLowerCase().includes(modelId.toLowerCase().split(/[-_]/)[0])
        ) {
          targetProviderId = pId
          break
        }
      }
    }

    const updated = { ...settings, defaultModel: modelId, defaultProvider: targetProviderId }
    setSettings(updated)
    await saveSettings(updated)
    showToast(`Aktif Model: ${modelId} (${targetProviderId})`, 'info')
  }

  const selectPreset = async (presetNameOrId: string) => {
    let found = presets.find((p) =>
      p.id === presetNameOrId ||
      p.name === presetNameOrId ||
      p.id?.toLowerCase() === presetNameOrId?.toLowerCase() ||
      p.name?.toLowerCase() === presetNameOrId?.toLowerCase()
    )
    if (!found) {
      found = {
        id: presetNameOrId,
        name: presetNameOrId,
        description: '',
        icon: '👤'
      }
    }
    setActivePreset(found)
    setSettings(prev => ({ ...prev, defaultPreset: found!.id }))
    showToast(`Ajan Rolü: ${found.name}`, 'info')

    const uid = currentUser?.id || localStorage.getItem('artificax_user_id') || 'user_admin'
    try {
      await fetch('/api/presets/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': uid
        },
        body: JSON.stringify({ presetId: found.id })
      })
    } catch {}
  }

  const setSandboxMode = async (mode: 'read-only' | 'workspace-write' | 'danger-full-access') => {
    try {
      const res = await fetch('/api/settings/sandbox-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      })
      const data = await res.json()
      if (data.success) {
        setSettings((prev: any) => ({ ...prev, sandboxMode: mode }))
        const label = mode === 'workspace-write' ? '🛡️ Workspace (Yazılabilir)' : mode === 'read-only' ? '🔒 Salt-Okunur (Read-Only)' : '⚠️ Tam Erişim (Full Access)'
        showToast(`Sandbox Modu Değiştirildi: ${label}`, 'info')
      } else if (data.error) {
        showToast(`Hata: ${data.error}`, 'error')
      }
    } catch (e: any) {
      showToast(`Hata: ${e.message}`, 'error')
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
        attachments,
        isUploading,
        currentUser,
        users,
        isAdmin,
        token,
        login,
        register,
        logout,
        switchUser,
        createUser,
        updateUserRole,
        deleteUser,
        uploadFiles,
        attachFile,
        removeAttachment,
        clearAttachments,
        clearMessages,
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
        deletePreset,
        setDefaultPreset,

        togglePlugin,
        setWorkspace,
        sandboxMode: settings.sandboxMode || 'workspace-write',
        setSandboxMode
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
