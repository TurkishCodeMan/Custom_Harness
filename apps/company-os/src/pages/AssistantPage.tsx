import React, { useState, useRef, useEffect, useMemo } from 'react'
import type { Position, ExecutionActionCard, ThreadMessage } from '../types.js'
import { browseWorkspace, type WorkspaceFileItem } from '../api.js'
import { LayaService, type LayaRouteResult } from '../services/layaService.js'

interface AssistantPageProps {
  positions: Position[]
  messages: ThreadMessage[]
  onSendMessage: (text: string, targetPositionIds: string[]) => void
  onAbort?: () => void
  isExecuting: boolean
  streamingText?: string
  streamingThought?: string
  actionCards: ExecutionActionCard[]
  onToggleCard: (cardId: string) => void
  onOpenReport?: (reportPath: string) => void
  activeSessionTitle?: string
  onDeleteActiveSession?: () => void
  onRefreshSession?: () => void
  companyWorkspace?: string
}

export const AssistantPage: React.FC<AssistantPageProps> = ({
  positions,
  messages,
  onSendMessage,
  onAbort,
  isExecuting,
  streamingText,
  streamingThought,
  actionCards,
  onToggleCard,
  onOpenReport,
  activeSessionTitle,
  onDeleteActiveSession,
  onRefreshSession,
  companyWorkspace
}) => {
  const [inputText, setInputText] = useState('')
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [docPickerOpen, setDocPickerOpen] = useState(false)
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({})
  const [expandedToolOutputs, setExpandedToolOutputs] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const toggleToolOutput = (id: string) => {
    setExpandedToolOutputs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileItem[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [fileSearch, setFileSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>('all')

  // ⚡ Laya Decision Engine (System 1) Live Routing State
  const [layaRoute, setLayaRoute] = useState<LayaRouteResult | null>(null)

  useEffect(() => {
    if (!inputText.trim() || inputText.includes('@')) {
      setLayaRoute(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await LayaService.routeMessage(inputText)
        if (res && res.target_position_id && res.confidence > 0.5) {
          setLayaRoute(res)
        } else {
          setLayaRoute(null)
        }
      } catch (err) {
        setLayaRoute(null)
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [inputText])

  const loadWorkspaceFiles = async () => {
    setIsLoadingFiles(true)
    try {
      const res = await browseWorkspace(companyWorkspace || undefined, { recursive: true })
      if (res?.allFiles && res.allFiles.length > 0) {
        setWorkspaceFiles(res.allFiles)
      } else if (res?.files) {
        setWorkspaceFiles(res.files.map(f => ({
          name: f,
          relativePath: f,
          fullPath: f,
          size: 0,
          extension: f.includes('.') ? `.${f.split('.').pop()}` : ''
        })))
      }
    } catch (err) {
      console.warn('[AssistantPage] Çalışma alanı dosyaları yüklenemedi:', err)
    } finally {
      setIsLoadingFiles(false)
    }
  }

  useEffect(() => {
    if (docPickerOpen && workspaceFiles.length === 0) {
      loadWorkspaceFiles()
    }
  }, [docPickerOpen])

  const getFileIcon = (extension: string, name: string): string => {
    const ext = extension.toLowerCase()
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') return '📊'
    if (ext === '.json') return '📦'
    if (ext === '.md' || ext === '.txt') return '📄'
    if (['.ts', '.tsx', '.js', '.jsx', '.py', '.sh', '.bash'].includes(ext)) return '⚡'
    if (ext === '.pdf') return '📑'
    if (['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext)) return '🖼️'
    if (name.includes('stok') || name.includes('siparis')) return '📦'
    if (name.includes('butce') || name.includes('finans')) return '📊'
    if (name.includes('rapor')) return '📑'
    return '📄'
  }

  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes === 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const folderCategories = useMemo(() => {
    const folders = new Set<string>()
    workspaceFiles.forEach(f => {
      const parts = f.relativePath.split('/')
      if (parts.length > 1) {
        folders.add(parts[0])
      }
    })
    return Array.from(folders).sort()
  }, [workspaceFiles])

  const filteredFiles = useMemo(() => {
    return workspaceFiles.filter(f => {
      const matchesSearch = !fileSearch ||
        f.relativePath.toLowerCase().includes(fileSearch.toLowerCase()) ||
        f.name.toLowerCase().includes(fileSearch.toLowerCase())
      const matchesFolder = selectedFolder === 'all' || f.relativePath.startsWith(`${selectedFolder}/`)
      return matchesSearch && matchesFolder
    })
  }, [workspaceFiles, fileSearch, selectedFolder])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, streamingThought, actionCards])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputText(val)

    const lastAtIndex = val.lastIndexOf('@')
    if (lastAtIndex !== -1 && lastAtIndex === val.length - 1) {
      setMentionMenuOpen(true)
      setMentionFilter('')
    } else if (lastAtIndex !== -1 && !val.slice(lastAtIndex).includes(' ')) {
      setMentionMenuOpen(true)
      setMentionFilter(val.slice(lastAtIndex + 1).toLowerCase())
    } else {
      setMentionMenuOpen(false)
    }
  }

  const handleSelectMention = (pos: Position) => {
    const lastAtIndex = inputText.lastIndexOf('@')
    const prefix = inputText.slice(0, lastAtIndex)
    setInputText(`${prefix}@${pos.title} `)
    setMentionMenuOpen(false)
    inputRef.current?.focus()
  }

  const handleSelectDoc = (relativePath: string) => {
    setInputText(prev => {
      const trimmed = prev.trim()
      return trimmed ? `${trimmed} [Referans: ${relativePath}] ` : `[Referans: ${relativePath}] `
    })
    setDocPickerOpen(false)
    inputRef.current?.focus()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isExecuting) {
      onAbort?.()
      return
    }

    if (!inputText.trim()) return

    const targetedIds: string[] = []
    positions.forEach(p => {
      if (
        inputText.includes(`@${p.title}`) ||
        inputText.includes(`@${p.id}`) ||
        (p.id === 'ceo' && inputText.toLowerCase().includes('@ceo')) ||
        (p.id === 'novatrend-cfo' && inputText.toLowerCase().includes('@cfo')) ||
        (p.id === 'novatrend-kalite' && inputText.toLowerCase().includes('@kalite')) ||
        (p.id === 'novatrend-tedarik' && inputText.toLowerCase().includes('@tedarik'))
      ) {
        targetedIds.push(p.id)
      }
    })

    // If no mention, check Laya suggestion or fallback to CEO
    const finalTargets: string[] = targetedIds.length > 0
      ? targetedIds
      : (layaRoute?.target_position_id ? [layaRoute.target_position_id] : [positions.find(p => p.id === 'ceo' || p.level === 1)?.id || positions[0]?.id || 'ceo'])

    onSendMessage(inputText.trim(), finalTargets)
    setInputText('')
    setMentionMenuOpen(false)
    setDocPickerOpen(false)
    setLayaRoute(null)
  }

  const toggleThinking = (msgId: string) => {
    setExpandedThinking(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }))
  }

  const filteredPositions = positions.filter(p =>
    p.title.toLowerCase().includes(mentionFilter) ||
    p.id.toLowerCase().includes(mentionFilter) ||
    p.role.toLowerCase().includes(mentionFilter)
  )

  const currentMentionedPositions = useMemo(() => {
    if (!inputText.includes('@')) return []
    return positions.filter(p =>
      inputText.includes(`@${p.title}`) ||
      inputText.includes(`@${p.id}`) ||
      (p.id === 'ceo' && inputText.toLowerCase().includes('@ceo')) ||
      (p.id === 'novatrend-cfo' && inputText.toLowerCase().includes('@cfo')) ||
      (p.id === 'novatrend-kalite' && inputText.toLowerCase().includes('@kalite')) ||
      (p.id === 'novatrend-tedarik' && inputText.toLowerCase().includes('@tedarik'))
    )
  }, [inputText, positions])

  const findPositionInfo = (presetOrId?: string) => {
    if (!presetOrId) return { title: 'Şirket Asistanı', icon: '🤖' }
    const match = positions.find(p =>
      p.presetId === presetOrId ||
      p.id === presetOrId ||
      p.title.toLowerCase().includes(presetOrId.toLowerCase())
    )
    if (match) return { title: match.title, icon: match.icon }
    return { title: presetOrId, icon: '▲' }
  }

  const renderFormattedText = (text: string, keyPrefix: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|raporlar\/[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/g)
    return parts.map((part, idx) => {
      const key = `${keyPrefix}_${idx}`
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return <strong key={key} style={{ color: '#f1f5f9', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={key}
            style={{
              background: 'rgba(255,255,255,0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.88em',
              color: '#34d399',
              fontFamily: 'monospace'
            }}
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      const reportMatch = part.match(/^raporlar\/[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+$/)
      if (reportMatch && onOpenReport) {
        return (
          <button
            key={key}
            type="button"
            className="btn-secondary"
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              margin: '0 4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#34d399'
            }}
            onClick={() => onOpenReport(reportMatch[0])}
          >
            <span>📄 {part.split('/').pop()}</span>
            <span>➔</span>
          </button>
        )
      }
      return <span key={key}>{part}</span>
    })
  }

  const renderMarkdownContent = (content: string) => {
    const lines = content.split('\n')
    let inCodeBlock = false
    let codeLines: string[] = []
    const elements: React.ReactNode[] = []

    lines.forEach((line, idx) => {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre
              key={`code_${idx}`}
              style={{
                background: 'rgba(0,0,0,0.45)',
                padding: '10px 14px',
                borderRadius: '6px',
                overflowX: 'auto',
                border: '1px solid rgba(255,255,255,0.08)',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#a7f3d0',
                margin: '8px 0'
              }}
            >
              <code>{codeLines.join('\n')}</code>
            </pre>
          )
          codeLines = []
          inCodeBlock = false
        } else {
          inCodeBlock = true
        }
        return
      }

      if (inCodeBlock) {
        codeLines.push(line)
        return
      }

      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={idx} style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '12px 0 4px 0' }}>
            {renderFormattedText(line.slice(4), `h4_${idx}`)}
          </h4>
        )
        return
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={idx} style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: '14px 0 6px 0' }}>
            {renderFormattedText(line.slice(3), `h3_${idx}`)}
          </h3>
        )
        return
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={idx} style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: '16px 0 8px 0' }}>
            {renderFormattedText(line.slice(2), `h2_${idx}`)}
          </h2>
        )
        return
      }
      if (line.trim() === '---' || line.trim() === '***') {
        elements.push(<hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '12px 0' }} />)
        return
      }

      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ')
      const isNumbered = /^\d+\.\s/.test(line.trim())

      if (isBullet) {
        elements.push(
          <div key={idx} style={{ marginBottom: '4px', paddingLeft: '16px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <span style={{ color: '#10b981', lineHeight: '1.4' }}>•</span>
            <span style={{ flex: 1 }}>{renderFormattedText(line.trim().slice(2), `b_${idx}`)}</span>
          </div>
        )
        return
      }

      if (isNumbered) {
        const match = line.trim().match(/^(\d+)\.\s(.*)$/)
        const num = match ? match[1] : '1'
        const rest = match ? match[2] : line
        elements.push(
          <div key={idx} style={{ marginBottom: '4px', paddingLeft: '16px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <span style={{ color: '#34d399', fontWeight: 600, fontSize: '12px', lineHeight: '1.4' }}>{num}.</span>
            <span style={{ flex: 1 }}>{renderFormattedText(rest, `n_${idx}`)}</span>
          </div>
        )
        return
      }

      elements.push(
        <div key={idx} style={{ marginBottom: line.trim() === '' ? '6px' : '4px', minHeight: line.trim() === '' ? '6px' : 'auto' }}>
          {renderFormattedText(line, `l_${idx}`)}
        </div>
      )
    })

    return elements
  }

  return (
    <div className="assistant-view-container">
      {/* Session Header Bar */}
      {activeSessionTitle && (
        <div style={{
          padding: '10px 24px',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ opacity: 0.6 }}>Oturum:</span>
            <span style={{ fontWeight: 600, color: '#fff' }}>{activeSessionTitle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onRefreshSession && (
              <button
                type="button"
                onClick={onRefreshSession}
                title="Oturumu Yenile / Son Raporları Getir"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  color: '#38bdf8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🔄</span>
                <span>Yenile</span>
              </button>
            )}
            {onDeleteActiveSession && (
              <button
                type="button"
                onClick={onDeleteActiveSession}
                title="Bu sohbeti sil"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  color: '#fca5a5',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🗑️</span>
                <span>Sohbeti Sil</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div className="chat-conversation-feed">
        {messages.map((msg, idx) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id || `user_${idx}`} className="chat-message-row user-row">
                <div className="user-message-bubble">
                  <div className="message-header-line">
                    <div className="msg-author-info">
                      <span className="author-avatar user-av">H</span>
                      <span className="author-name">Hüseyin</span>
                      <span className="author-badge">Yönetici / Executive</span>
                    </div>
                    {msg.timestamp && (
                      <span className="msg-time-stamp">
                        {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="message-content-text">{msg.content}</div>
                </div>
              </div>
            )
          }

          if (msg.role === 'assistant') {
            const agentInfo = findPositionInfo(msg.presetName)
            const isThinkingOpen = expandedThinking[msg.id]
            const hasToolCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0
            const hasContent = Boolean(msg.content && msg.content.trim())
            const hasThinking = Boolean(msg.reasoning_content && msg.reasoning_content.trim())

            // Render even if content is empty when tool calls exist
            if (!hasContent && !hasThinking && !hasToolCalls) {
              return null
            }

            return (
              <div key={msg.id || `assistant_${idx}`} className="chat-message-row assistant-row">
                <div className="assistant-message-card">
                  <div className="message-header-line">
                    <div className="msg-author-info">
                      <span className="author-avatar agent-av">{agentInfo.icon}</span>
                      <span className="author-name">{agentInfo.title}</span>
                      <span className="author-badge-agent">AI Teammate</span>
                    </div>
                    {msg.timestamp && (
                      <span className="msg-time-stamp">
                        {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Thinking Section */}
                  {msg.reasoning_content && (
                    <div className="thinking-container">
                      <div className="thinking-toggle-bar" onClick={() => toggleThinking(msg.id)}>
                        <span style={{ fontSize: '13px' }}>🧠</span>
                        <span>Düşünce Süreci (Thinking)</span>
                        <span className={`thinking-chevron ${isThinkingOpen ? 'open' : ''}`}>▾</span>
                      </div>
                      {isThinkingOpen && (
                        <div className="thinking-body-content mono">
                          {msg.reasoning_content}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tool Calls Chips (In-progress & Completed Steps) */}
                  {hasToolCalls && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      margin: '6px 0 10px 0'
                    }}>
                      {msg.tool_calls?.map((tc: any, tIdx: number) => {
                        const toolName = tc.function?.name || tc.name || 'Araç Çağrısı'
                        let callDetail = ''
                        try {
                          const args = typeof tc.function?.arguments === 'string'
                            ? JSON.parse(tc.function.arguments)
                            : tc.function?.arguments || tc.args || {}
                          callDetail = args.taskName || args.taskDescription || args.task || args.prompt || args.path || args.query || args.command || ''
                          if (typeof callDetail !== 'string') callDetail = JSON.stringify(callDetail)
                        } catch {
                          callDetail = ''
                        }

                        return (
                          <div
                            key={tIdx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'rgba(56, 189, 248, 0.08)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              color: '#38bdf8'
                            }}
                          >
                            <span>⚙️</span>
                            <span style={{ fontWeight: 600 }}>{toolName}</span>
                            {callDetail && (
                              <span style={{ color: '#94a3b8', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {callDetail}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Content */}
                  {hasContent && (
                    <div className="message-content-text">
                      {renderMarkdownContent(msg.content || '')}
                    </div>
                  )}
                </div>
              </div>
            )
          }

          if (msg.role === 'tool') {
            let parsed: any = null
            try {
              if (msg.content && (msg.content.trim().startsWith('{') || msg.content.trim().startsWith('['))) {
                parsed = JSON.parse(msg.content)
              }
            } catch {
              parsed = null
            }

            // Case 1: Subagent human deliverable (contains human result text & preset/task)
            const isSubagentOutcome = Boolean(parsed && (parsed.taskName || parsed.result) && (parsed.preset || parsed.status === 'completed'))

            if (isSubagentOutcome) {
              const agentInfo = findPositionInfo(parsed.preset || msg.presetName)
              const resultText = parsed.result || ''
              const taskTitle = parsed.taskName || 'Görev Çıktısı'

              return (
                <div key={msg.id || `tool_${idx}`} className="chat-message-row assistant-row">
                  <div className="assistant-message-card" style={{
                    borderLeft: '3px solid #10b981',
                    background: 'rgba(16, 25, 20, 0.85)'
                  }}>
                    <div className="message-header-line">
                      <div className="msg-author-info">
                        <span className="author-avatar agent-av">{agentInfo.icon}</span>
                        <span className="author-name">{agentInfo.title}</span>
                        <span className="author-badge-agent" style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          borderColor: 'rgba(99, 102, 241, 0.4)',
                          color: '#c7d2fe'
                        }}>
                          📢 Departman Görüşü & Mütalaası
                        </span>
                      </div>
                      {msg.timestamp && (
                        <span className="msg-time-stamp">
                          {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#34d399',
                      padding: '4px 8px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      borderRadius: '6px',
                      width: 'fit-content'
                    }}>
                      <span>⚡</span>
                      <span>{taskTitle}</span>
                      {parsed.durationSeconds && (
                        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'normal' }}>
                          ({Math.round(parsed.durationSeconds)}s)
                        </span>
                      )}
                    </div>

                    <div className="message-content-text">
                      {renderMarkdownContent(resultText)}
                    </div>
                  </div>
                </div>
              )
            }

            // Case 2: Intermediate technical tool output (list_dir, read_file, exec, etc.)
            // Render as an elegant, compact, collapsible badge so raw JSON never floods the chat!
            const isExpanded = expandedToolOutputs[msg.id || `tool_${idx}`]
            let previewText = ''
            if (Array.isArray(parsed)) {
              previewText = `${parsed.length} öğe listelendi`
            } else if (typeof parsed === 'object' && parsed !== null) {
              previewText = parsed.summary || parsed.status || `${Object.keys(parsed).length} alan`
            } else {
              previewText = (msg.content || '').slice(0, 60).replace(/\n/g, ' ')
            }

            return (
              <div key={msg.id || `tool_${idx}`} className="chat-message-row" style={{ padding: '2px 0 2px 42px' }}>
                <div style={{
                  maxWidth: '750px',
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}>
                  <div
                    onClick={() => toggleToolOutput(msg.id || `tool_${idx}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                      color: '#94a3b8',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#38bdf8' }}>⚙️</span>
                      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Araç Çıktısı:</span>
                      <span style={{ color: '#64748b' }}>{previewText}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                      <span>{isExpanded ? 'Gizle' : 'Detayları Gör'}</span>
                      <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(0, 0, 0, 0.45)',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      maxHeight: '240px',
                      overflowY: 'auto',
                      color: '#a7f3d0',
                      whiteSpace: 'pre-wrap',
                      fontSize: '11px',
                      lineHeight: '1.5'
                    }}>
                      {typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : msg.content}
                    </div>
                  )}
                </div>
              </div>
            )
          }

          return null
        })}

        {/* Live Actions Stream Block */}
        {actionCards.length > 0 && (
          <div className="live-actions-stream-block">
            <div className="live-actions-stream-label">
              <span className="pulse-dot-emerald" />
              <span>Canlı Araç ve Departman Aksiyonları</span>
            </div>
            {actionCards.map(card => (
              <div key={card.id} className="atlantic-action-card">
                <div className="card-header-bar" onClick={() => onToggleCard(card.id)}>
                  <div className="card-header-left">
                    <span className="integration-logo-badge">{card.icon}</span>
                    <span className="card-title-text">{card.name}</span>
                    <span className="card-completed-count">{card.badgeText}</span>
                  </div>
                  <div className="card-header-right">
                    <span className={`accordion-chevron ${card.isExpanded ? 'open' : ''}`}>▾</span>
                  </div>
                </div>
                {card.isExpanded && (
                  <div className="card-items-body">
                    {card.items.map((item, iIdx) => (
                      <div key={iIdx} className="card-action-item">
                        <div className="action-status-icon">
                          {item.status === 'completed' && <span className="check-emerald">✓</span>}
                          {item.status === 'running' && <span className="spinner-amber">◌</span>}
                          {item.status === 'pending' && <span className="pending-dot">•</span>}
                          {item.status === 'error' && <span className="error-cross">✕</span>}
                        </div>
                        <div className="action-text-content">
                          <span className="action-label">{item.label}</span>
                          {item.detail && <span className="action-detail-mono">{item.detail}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Streaming Card */}
        {isExecuting && (streamingText || streamingThought) && (
          <div className="chat-message-row assistant-row">
            <div className="assistant-message-card streaming-card">
              <div className="message-header-line">
                <div className="msg-author-info">
                  <span className="author-avatar agent-av">▲</span>
                  <span className="author-name">Ajan Yanıtlıyor...</span>
                  <span className="author-badge-agent">Canlı Akış</span>
                </div>
              </div>

              {streamingThought && (
                <div className="thinking-container streaming-thinking">
                  <div className="thinking-toggle-bar">
                    <span className="spinner-amber">◌</span>
                    <span>Düşünce Süreci...</span>
                  </div>
                  <div className="thinking-body-content mono">
                    {streamingThought}
                  </div>
                </div>
              )}

              {streamingText && (
                <div className="message-content-text">
                  {renderMarkdownContent(streamingText)}
                  <span className="streaming-cursor" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && !isExecuting && (
          <div className="assistant-empty-state">
            <div className="empty-state-logo">🏢</div>
            <h3 className="empty-state-title">Your Company's AI OS</h3>
            <p className="empty-state-sub" style={{ marginBottom: '24px' }}>
              İcra Kurulu Başkanı, CFO, Kalite Güvence ve Tedarik departmanlarına soru sorun veya direktif verin.
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'center',
              maxWidth: '650px',
              margin: '0 auto'
            }}>
              {positions.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="btn-secondary"
                  style={{
                    fontSize: '12px',
                    padding: '7px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => {
                    setInputText(`@${p.title} son durum raporunu masama koy`)
                    inputRef.current?.focus()
                  }}
                >
                  <span>{p.icon}</span>
                  <span style={{ fontWeight: 600 }}>@{p.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Mention Dropdown Menu */}
      {mentionMenuOpen && (
        <div className="mention-dropdown-menu">
          <div className="mention-menu-header">Pozisyon Seçin (@):</div>
          {filteredPositions.map(pos => (
            <button
              key={pos.id}
              type="button"
              className="mention-item-btn"
              onClick={() => handleSelectMention(pos)}
            >
              <span className="mention-icon">{pos.icon}</span>
              <div className="mention-info">
                <span className="mention-title">{pos.title}</span>
                <span className="mention-role">{pos.role}</span>
              </div>
              <span className="mention-level">L{pos.level}</span>
            </button>
          ))}
        </div>
      )}

      {/* Workspace Doc Picker Dropdown */}
      {docPickerOpen && (
        <div
          className="mention-dropdown-menu"
          style={{ maxHeight: '380px', width: '460px', maxWidth: '92vw' }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 10px',
            borderBottom: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div className="mention-menu-header" style={{ padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📎</span>
              <span>Çalışma Alanı Dokümanı Ekle ({workspaceFiles.length} Dosya)</span>
            </div>
            <button
              type="button"
              onClick={loadWorkspaceFiles}
              title="Yenile"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔄
            </button>
          </div>

          <div style={{ padding: '6px 8px' }}>
            <input
              type="text"
              className="form-input"
              style={{
                width: '100%',
                fontSize: '11px',
                padding: '5px 8px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#f1f5f9'
              }}
              placeholder="🔍 Dosya veya klasör ara (örn: stok, butce, .csv, .md)..."
              value={fileSearch}
              onChange={e => setFileSearch(e.target.value)}
              autoFocus
            />
          </div>

          {folderCategories.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '4px',
              overflowX: 'auto',
              padding: '0 8px 6px',
              scrollbarWidth: 'none'
            }}>
              <button
                type="button"
                onClick={() => setSelectedFolder('all')}
                style={{
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  background: selectedFolder === 'all' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${selectedFolder === 'all' ? '#10b981' : 'transparent'}`,
                  color: selectedFolder === 'all' ? '#34d399' : '#94a3b8',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Tümü ({workspaceFiles.length})
              </button>
              {folderCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedFolder(cat)}
                  style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    background: selectedFolder === cat ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedFolder === cat ? '#10b981' : 'transparent'}`,
                    color: selectedFolder === cat ? '#34d399' : '#94a3b8',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  📁 {cat}
                </button>
              ))}
            </div>
          )}

          <div style={{
            maxHeight: '230px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '0 4px'
          }}>
            {isLoadingFiles ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                ⏳ Çalışma alanı dosyaları taranıyor...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                {fileSearch ? 'Aradığınız kriterde dosya bulunamadı.' : 'Çalışma alanında dosya bulunamadı.'}
              </div>
            ) : (
              filteredFiles.map((f, fIdx) => (
                <button
                  key={fIdx}
                  type="button"
                  className="mention-item-btn"
                  onClick={() => handleSelectDoc(f.relativePath)}
                  style={{ padding: '6px 8px' }}
                >
                  <span className="mention-icon">{getFileIcon(f.extension, f.name)}</span>
                  <div className="mention-info" style={{ overflow: 'hidden' }}>
                    <span
                      className="mention-title"
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#a7f3d0',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {f.relativePath}
                    </span>
                    <span className="mention-role" style={{ fontSize: '10px', color: '#64748b' }}>
                      {f.name} {f.size ? `• ${formatBytes(f.size)}` : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'rgba(16, 185, 129, 0.7)', marginLeft: 'auto' }}>
                    + Ekle
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating Bottom Chat Bar */}
      <div className="floating-chat-bar-container">
        {/* 👥 Multi-Department Meeting Badge */}
        {currentMentionedPositions.length > 1 && (
          <div className="laya-routing-badge" style={{ borderColor: 'rgba(99, 102, 241, 0.45)', background: 'rgba(99, 102, 241, 0.12)' }}>
            <div className="laya-routing-left">
              <span className="laya-bolt-icon" style={{ color: '#818cf8' }}>👥</span>
              <span className="laya-engine-title" style={{ color: '#c7d2fe' }}>Çoklu Departman Masası:</span>
              <div style={{ display: 'inline-flex', gap: '5px', flexWrap: 'wrap' }}>
                {currentMentionedPositions.map(p => (
                  <span key={p.id} className="laya-target-chip" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)' }}>
                    <span>{p.icon}</span>
                    <span>{p.title.split('&')[0].trim()}</span>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="laya-metrics" style={{ color: '#a5b4fc', fontWeight: 600 }}>
                👑 CEO Koordinasyonunda Ortak Karar Oturumu
              </span>
            </div>
          </div>
        )}

        {/* ⚡ Laya System 1 Real-time Routing Suggestion Pill */}
        {layaRoute && currentMentionedPositions.length <= 1 && (
          <div className="laya-routing-badge">
            <div className="laya-routing-left">
              <span className="laya-bolt-icon">⚡</span>
              <span className="laya-engine-title">Laya Sistem 1 Tavsiyesi:</span>
              <span className="laya-target-chip">
                <span>{layaRoute.target_position?.icon || '🤖'}</span>
                <span>{layaRoute.target_position?.title || layaRoute.target_position_id}</span>
              </span>
              <span className="laya-metrics">
                %{Math.round(layaRoute.confidence * 100)} Güven
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="laya-metrics">
                ⚡ {layaRoute.latency_ms}ms · 0-Token
              </span>
              <button
                type="button"
                className="laya-apply-chip-btn"
                onClick={() => {
                  const targetPos = positions.find(p => p.id === layaRoute.target_position_id)
                  if (targetPos) {
                    handleSelectMention(targetPos)
                  }
                }}
                title="Bu pozisyonu etiketle"
              >
                Koltuk Seç ➔
              </button>
            </div>
          </div>
        )}

        <form className="floating-chat-form" onSubmit={handleSubmit}>
          <button
            type="button"
            className="chat-action-btn attach-btn"
            title="Referans Ekle"
            onClick={() => {
              setDocPickerOpen(prev => !prev)
              setMentionMenuOpen(false)
            }}
          >
            📎
          </button>
          <input
            ref={inputRef}
            type="text"
            className="floating-chat-input"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Ask Atlantic anything... (@ to mention a position, 📎 to attach doc)"
            disabled={isExecuting}
          />
          <div className="chat-actions-right">
            <button
              type="button"
              className="chat-action-btn mic-btn"
              title="Sesli Giriş"
            >
              🎙️
            </button>
            {isExecuting ? (
              <button
                type="button"
                className="chat-submit-btn stop-btn"
                onClick={() => onAbort?.()}
                title="Durdur"
              >
                <span className="stop-square">■</span>
              </button>
            ) : (
              <button
                type="submit"
                className="chat-submit-btn send-btn"
                title="Gönder"
              >
                <span className="send-arrow">➔</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
