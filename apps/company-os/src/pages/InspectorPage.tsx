import React, { useState, useEffect, useRef } from 'react'
import type { ChatThread } from '../types.js'
import {
  InspectorIcon,
  RefreshCwIcon,
  CopyIcon,
  SearchIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  TerminalIcon
} from '../components/Icons.js'

interface InspectorPageProps {
  chatThreads: ChatThread[]
  activeSessionId?: string
  companyWorkspace?: string
}

export const InspectorPage: React.FC<InspectorPageProps> = ({
  chatThreads,
  activeSessionId,
  companyWorkspace
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(activeSessionId || chatThreads[0]?.id || '')
  const [turns, setTurns] = useState<any[]>([])
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'timeline' | 'messages' | 'tools' | 'executions' | 'response' | 'raw'>('timeline')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [expandedSystem, setExpandedSystem] = useState<boolean>(false)
  const [sessionContext, setSessionContext] = useState<any>(null)

  // Update selected session if activeSessionId changes and none was selected
  useEffect(() => {
    if (activeSessionId && !selectedSessionId) {
      setSelectedSessionId(activeSessionId)
    }
  }, [activeSessionId])

  // Fetch token-meter context (real tokenizer measurement) for session
  const fetchSessionContext = async (sessionId: string) => {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/context`)
      if (res.ok) {
        const data = await res.json()
        setSessionContext(data)
      } else {
        setSessionContext(null)
      }
    } catch (e) {
      console.error('[InspectorPage] Failed to fetch session tokenizer context:', e)
    }
  }

  // Fetch turns for session
  const fetchTurns = async (sessionId: string, silent = false) => {
    if (!sessionId) return
    if (!silent) setIsLoading(true)
    try {
      const res = await fetch(`/api/debug/inspector/turns/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        const fetchedTurns = data.turns || []
        setTurns(fetchedTurns)
        // Select latest turn by default if index out of bounds
        if (fetchedTurns.length > 0) {
          setSelectedTurnIndex((prev) => (prev >= fetchedTurns.length ? fetchedTurns.length - 1 : prev))
        }
      } else {
        setTurns([])
      }
    } catch (e) {
      console.error('[InspectorPage] Failed to fetch inspector turns:', e)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  // Load on session change
  useEffect(() => {
    if (selectedSessionId) {
      fetchTurns(selectedSessionId)
      fetchSessionContext(selectedSessionId)
    }
  }, [selectedSessionId])

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !selectedSessionId) return
    const timer = setInterval(() => {
      fetchTurns(selectedSessionId, true)
      fetchSessionContext(selectedSessionId)
    }, 2500)
    return () => clearInterval(timer)
  }, [autoRefresh, selectedSessionId])

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Clear snapshots
  const handleClear = async () => {
    if (!selectedSessionId) return
    if (!confirm('Bu oturuma ait tüm debug kayıtlarını temizlemek istediğinize emin misiniz?')) return
    try {
      await fetch(`/api/debug/inspector/${selectedSessionId}`, { method: 'DELETE' })
      setTurns([])
      setSelectedTurnIndex(0)
    } catch (e) {
      console.error('[InspectorPage] Failed to clear snapshots:', e)
    }
  }

  const currentTurn = turns[selectedTurnIndex] || null

  // Session telemetry aggregates (with tokenizer fallback)
  const sessionMetrics = React.useMemo(() => {
    let totalTools = 0
    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    const firstTs = turns[0]?.timestamp || 0
    const lastTs = turns[turns.length - 1]?.timestamp || 0

    for (const t of turns) {
      if (t.toolExecutions?.length) totalTools += t.toolExecutions.length
      if (t.llmResponse?.usage) {
        totalPromptTokens += t.llmResponse.usage.promptTokens || 0
        totalCompletionTokens += t.llmResponse.usage.completionTokens || 0
      }
    }

    // Tokenizer / TokenMeter fallback if turn-level usage wasn't captured
    if (totalPromptTokens === 0 && totalCompletionTokens === 0) {
      if (sessionContext?.actualUsage) {
        totalPromptTokens = sessionContext.actualUsage.promptTokens || 0
        totalCompletionTokens = sessionContext.actualUsage.completionTokens || 0
      } else if (sessionContext?.totalInputTokens) {
        totalPromptTokens = sessionContext.totalInputTokens
      }
    }

    const durationSec = firstTs && lastTs ? Math.max(0, Math.round((lastTs - firstTs) / 1000)) : 0

    return {
      totalTurns: turns.length,
      totalTools,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      durationSec
    }
  }, [turns, sessionContext])

  // Filter messages in Tab 1 if search applied
  const messagesToSend: any[] = currentTurn?.llmPayload?.messagesToSend || []
  const filteredMessages = messagesToSend.filter((msg: any) => {
    if (!searchTerm) return true
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    return (
      msg.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  // Filter tools in Tab 2
  const availableTools: any[] = currentTurn?.llmPayload?.tools || []
  const filteredTools = availableTools.filter((t: any) => {
    if (!searchTerm) return true
    const name = t.function?.name || t.name || ''
    const desc = t.function?.description || t.description || ''
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      desc.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  // Format relative timestamp
  const formatTime = (ts: number) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="inspector-page-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#e2e8f0',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* 1. Header Toolbar */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'linear-gradient(180deg, rgba(20, 26, 43, 0.9) 0%, rgba(13, 17, 28, 0.9) 100%)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8'
          }}>
            <InspectorIcon size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                Ajan Röntgeni & LLM Debug Kokpiti
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#fde047',
                border: '1px solid rgba(234, 179, 8, 0.3)'
              }}>
                ADMIN ONLY
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Ajana giren ham bağlamı, sistem talimatlarını ve LLM sağlayıcısına iletilen tam yükü anlık inceleyin.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Session Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Oturum:</span>
            <select
              value={selectedSessionId}
              onChange={(e) => {
                setSelectedSessionId(e.target.value)
                setSelectedTurnIndex(0)
              }}
              style={{
                background: '#161e2e',
                color: '#f1f5f9',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '7px 12px',
                fontSize: '13px',
                maxWidth: '260px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {chatThreads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  {thread.title.length > 32 ? thread.title.slice(0, 32) + '...' : thread.title}
                </option>
              ))}
            </select>
          </div>

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Otomatik Yenileme (Canlı Takip)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: autoRefresh ? 'rgba(34, 197, 94, 0.15)' : '#161e2e',
              color: autoRefresh ? '#4ade80' : '#94a3b8',
              border: `1px solid ${autoRefresh ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: autoRefresh ? '#22c55e' : '#64748b',
              boxShadow: autoRefresh ? '0 0 8px #22c55e' : 'none'
            }} />
            <span>{autoRefresh ? 'Canlı Akış Aktif' : 'Canlı Akış Kapalı'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => selectedSessionId && fetchTurns(selectedSessionId)}
            title="Şimdi Yenile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#161e2e',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <RefreshCwIcon size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Yenile</span>
          </button>

          {/* Clear Session Snapshots */}
          <button
            type="button"
            onClick={handleClear}
            title="Oturum Debug Kayıtlarını Temizle"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <TrashIcon size={13} />
            <span>Temizle</span>
          </button>
        </div>
      </div>

      {/* 2. Turn Timeline Selector & KPI Stats Strip */}
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        background: '#0d1322',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Turns List / Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', maxWidth: '70%' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Turlar ({turns.length}):
          </span>
          {turns.length === 0 ? (
            <span style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
              Bu oturumda henüz kaydedilmiş bir model çağrısı bulunmuyor.
            </span>
          ) : (
            turns.map((turn, idx) => {
              const isSelected = selectedTurnIndex === idx
              const statusColor =
                turn.status === 'completed' ? '#22c55e' : turn.status === 'error' ? '#ef4444' : '#eab308'
              return (
                <button
                  key={turn.id || idx}
                  type="button"
                  onClick={() => setSelectedTurnIndex(idx)}
                  style={{
                    background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: isSelected ? '#a5b4fc' : '#94a3b8',
                    border: `1px solid ${isSelected ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '7px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor }} />
                  <span>Tur #{turn.turnCount || idx + 1}</span>
                  <span style={{ fontSize: '10px', opacity: 0.6 }}>{formatTime(turn.timestamp)}</span>
                </button>
              )
            })
          )}
        </div>

        {/* Search inside payload */}
        <div style={{ position: 'relative', width: '240px' }}>
          <SearchIcon size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Mesaj veya araç ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: '#161e2e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '7px',
              padding: '6px 10px 6px 30px',
              fontSize: '12px',
              color: '#f8fafc',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* 3. Turn Context KPI Metrics */}
      {currentTurn && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          padding: '12px 24px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hedef Model & Sağlayıcı</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
              {sessionContext?.modelId || currentTurn.llmPayload?.model || 'gpt-4o'} <span style={{ fontSize: '11px', color: '#94a3b8' }}>({currentTurn.llmPayload?.provider || 'openai'})</span>
            </div>
          </div>

          <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aktif Tur / Kümülatif Token</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', marginTop: '2px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <span>
                {sessionContext?.actualUsage?.lastPromptTokens
                  ? `${sessionContext.actualUsage.lastPromptTokens.toLocaleString()} tk ↑`
                  : `${(sessionContext?.totalTokens || currentTurn?.llmPayload?.estimatedTokens?.totalTokens || 0).toLocaleString()} tk ↑`}
              </span>
              {sessionContext?.actualUsage?.lastCompletionTokens > 0 && (
                <span style={{ color: '#34d399', fontSize: '13px' }}>
                  / {sessionContext.actualUsage.lastCompletionTokens.toLocaleString()} tk ↓
                </span>
              )}
              {sessionContext?.actualUsage?.totalTokens && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  padding: '1px 6px',
                  borderRadius: '4px'
                }}>
                  Oturum Toplam: {sessionContext.actualUsage.totalTokens.toLocaleString()} tk ({sessionContext.actualUsage.turnCount || 1} Tur)
                </span>
              )}
            </div>
          </div>

          <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aktif Pozisyon / Persona</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#a78bfa', marginTop: '2px' }}>
              {currentTurn.input?.presetName || currentTurn.input?.presetId || 'Standart Ajan'}
            </div>
          </div>

          <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Araçlar (Tanımlı / Yürütülen)</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginTop: '2px' }}>
              {currentTurn.llmPayload?.tools?.length || 0} şema sunuldu • <span style={{ color: '#22c55e' }}>{currentTurn.toolExecutions?.length || 0} yürütüldü</span>
            </div>
          </div>
        </div>
      )}

      {/* 3b. Real Tokenizer Breakdown Sub-strip */}
      {sessionContext && (
        <div style={{
          padding: '8px 24px',
          background: 'rgba(10, 14, 23, 0.85)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          fontSize: '12px'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontWeight: 500 }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></span>
            <span>Sistem Talimatı:</span>
            <strong style={{ color: '#c7d2fe' }}>{(sessionContext.systemPromptTokens ?? sessionContext.contextBreakdown?.systemTokens ?? 0).toLocaleString()} tk</strong>
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontWeight: 500 }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }}></span>
            <span>Araç Şemaları:</span>
            <strong style={{ color: '#bae6fd' }}>{(sessionContext.toolsTokens ?? sessionContext.contextBreakdown?.toolsTokens ?? 0).toLocaleString()} tk</strong>
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontWeight: 500 }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
            <span>Sohbet Geçmişi:</span>
            <strong style={{ color: '#fde68a' }}>
              {(sessionContext.historyTokens ?? sessionContext.contextBreakdown?.messageTokens ?? 0).toLocaleString()} tk
            </strong>
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontWeight: 500 }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
            <span>Aktif Tur Girişi:</span>
            <strong style={{ color: '#a7f3d0' }}>
              {(sessionContext.actualUsage?.lastPromptTokens ?? sessionContext.totalTokens ?? 0).toLocaleString()} tk
            </strong>
          </span>

          {sessionContext.actualUsage?.lastCompletionTokens !== undefined && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontWeight: 500 }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ec4899' }}></span>
              <span>Aktif Tur Çıkışı:</span>
              <strong style={{ color: '#fbcfe8' }}>
                {sessionContext.actualUsage.lastCompletionTokens.toLocaleString()} tk
              </strong>
            </span>
          )}

          {sessionContext.contextWindow > 0 && (
            <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '11px' }}>
              Bağlam Penceresi: <span style={{ color: '#cbd5e1' }}>{(((sessionContext.contextPressure?.usedTokens ?? sessionContext.totalTokens ?? 0) / sessionContext.contextWindow) * 100).toFixed(1)}%</span> / {sessionContext.contextWindow.toLocaleString()} tk
            </span>
          )}
        </div>
      )}

      {/* 4. Tab Navigation Strip */}
      <div style={{
        padding: '0 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#0b101c',
        display: 'flex',
        gap: '24px'
      }}>
        {[
          { key: 'timeline', label: `⏱️ Yaşam Döngüsü & Timeline (${turns.length} Tur)` },
          { key: 'messages', label: `📤 LLM'e Giden Mesajlar (${messagesToSend.length})` },
          { key: 'tools', label: `🛠️ LLM'e Sunulan Araç Şemaları (${availableTools.length})` },
          { key: 'executions', label: `⚡ Gerçekleşen Araç Çağrıları (${currentTurn?.toolExecutions?.length || 0})` },
          { key: 'response', label: `📥 Model Yanıtı & Düşünce` },
          { key: 'raw', label: `🔬 Ham JSON Röntgene Bak` }
        ].map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '12px 2px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${isActive ? '#6366f1' : 'transparent'}`,
                color: isActive ? '#f8fafc' : '#94a3b8',
                fontWeight: isActive ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 5. Main Body Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 24px',
        backgroundColor: '#090d16'
      }}>
        {!currentTurn && turns.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            color: '#64748b'
          }}>
            <InspectorIcon size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <div style={{ fontSize: '15px', fontWeight: 500 }}>Görüntülenecek debug verisi bulunamadı</div>
            <div style={{ fontSize: '13px', marginTop: '6px' }}>Lütfen bir konuşma başlatın veya yukarıdan farklı bir oturum seçin.</div>
          </div>
        ) : (
          <>
            {/* TAB 0: RUNTIME TIMELINE & LIFECYCLE */}
            {activeTab === 'timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Aggregate Session Stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px'
                }}>
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <div style={{ fontSize: '11px', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 600 }}>Toplam Tur (Turns)</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>{sessionMetrics.totalTurns}</div>
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)' }}>
                    <div style={{ fontSize: '11px', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 600 }}>Araç Çağrıları</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>{sessionMetrics.totalTools}</div>
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <div style={{ fontSize: '11px', color: '#fcd34d', textTransform: 'uppercase', fontWeight: 600 }}>Toplam Token (In/Out)</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                      {sessionMetrics.totalTokens.toLocaleString()}
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginLeft: '6px' }}>
                        ({sessionMetrics.totalPromptTokens.toLocaleString()} ↑ / {sessionMetrics.totalCompletionTokens.toLocaleString()} ↓)
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
                    <div style={{ fontSize: '11px', color: '#6ee7b7', textTransform: 'uppercase', fontWeight: 600 }}>Toplam Oturum Süresi</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                      {sessionMetrics.durationSec > 0 ? `${sessionMetrics.durationSec}s` : '< 1s'}
                    </div>
                  </div>
                </div>

                {/* Turn-by-Turn Chronological Trace */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {turns.map((turn, tIdx) => {
                    const executions = turn.toolExecutions || []
                    const turnTokens = turn.llmResponse?.usage?.totalTokens || (tIdx === turns.length - 1 ? (sessionContext?.actualUsage?.totalTokens || sessionContext?.totalInputTokens) : 0) || 0
                    const userMsg = turn.input?.prompt || turn.input?.message || (turn.llmPayload?.messagesToSend?.find((m: any) => m.role === 'user')?.content)
                    const userPromptStr = typeof userMsg === 'string' ? userMsg : JSON.stringify(userMsg)
                    return (
                      <div
                        key={turn.id || tIdx}
                        style={{
                          background: 'rgba(15, 23, 42, 0.65)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {/* Turn Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                              background: 'rgba(99,102,241,0.2)', color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.35)'
                            }}>
                              Tur #{turn.turnCount || tIdx + 1}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {formatTime(turn.timestamp)}
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                              {turn.llmPayload?.model || 'model'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#94a3b8' }}>
                            {turnTokens > 0 && <span>{turnTokens.toLocaleString()} tokens</span>}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTurnIndex(tIdx)
                                setActiveTab('messages')
                              }}
                              style={{
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#a5b4fc',
                                borderRadius: '5px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              Detay İncele →
                            </button>
                          </div>
                        </div>

                        {/* Events within this turn */}
                        <div style={{
                          padding: '10px 14px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          fontSize: '12px'
                        }}>
                          {/* 1. Input prompt */}
                          {userPromptStr && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <span style={{ color: '#60a5fa', fontWeight: 600, minWidth: '85px' }}>▶ Kullanıcı:</span>
                              <span style={{ color: '#cbd5e1', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                {userPromptStr.length > 200 ? userPromptStr.slice(0, 200) + '...' : userPromptStr}
                              </span>
                            </div>
                          )}

                          {/* 2. Tools executed */}
                          {executions.map((exec: any, eIdx: number) => (
                            <div key={exec.toolCallId || eIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '12px', borderLeft: '2px solid rgba(56,189,248,0.3)' }}>
                              <span style={{ color: '#38bdf8', fontWeight: 600, minWidth: '73px' }}>⚡ Araç:</span>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontFamily: 'monospace', color: '#7dd3fc', fontWeight: 600 }}>{exec.toolName}</span>
                                {exec.durationMs ? <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '6px' }}>({exec.durationMs}ms)</span> : null}
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                  {typeof exec.args === 'string' ? exec.args.slice(0, 140) : JSON.stringify(exec.args)?.slice(0, 140)}
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* 3. Model Response */}
                          {turn.llmResponse && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '12px', borderLeft: '2px solid rgba(52,211,153,0.3)' }}>
                              <span style={{ color: '#34d399', fontWeight: 600, minWidth: '73px' }}>📥 Model:</span>
                              <div style={{ flex: 1, color: '#94a3b8' }}>
                                <span style={{ color: '#a7f3d0' }}>
                                  {turn.llmResponse.finishReason === 'tool_calls' ? '🛠️ Araç çağrısı üretti' : '✅ Yanıt tamamlandı (stop)'}
                                </span>
                                {turn.llmResponse.text && (
                                  <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '3px', lineHeight: 1.4 }}>
                                    {turn.llmResponse.text.slice(0, 180)}...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB 1: EXACT MESSAGES SENT TO LLM */}
            {activeTab === 'messages' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Ajanın <strong>{currentTurn.llmPayload?.model || 'modele'}</strong> gönderdiği kanonik mesaj dizilimi:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(messagesToSend, null, 2), 'copy_all_messages')}
                    style={{
                      background: '#161e2e',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#e2e8f0',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <CopyIcon size={12} />
                    <span>{copiedKey === 'copy_all_messages' ? 'Kopyalandı!' : 'Tüm Mesajları Kopyala'}</span>
                  </button>
                </div>

                {filteredMessages.map((msg: any, idx: number) => {
                  const isSystem = msg.role === 'system'
                  const isUser = msg.role === 'user'
                  const isAssistant = msg.role === 'assistant'
                  const isTool = msg.role === 'tool'

                  const roleBadgeBg = isSystem
                    ? 'rgba(168, 85, 247, 0.15)'
                    : isUser
                    ? 'rgba(59, 130, 246, 0.15)'
                    : isAssistant
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)'

                  const roleColor = isSystem
                    ? '#c084fc'
                    : isUser
                    ? '#60a5fa'
                    : isAssistant
                    ? '#34d399'
                    : '#fbbf24'

                  const contentString = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)

                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#111827',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '10px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Message Header */}
                      <div style={{
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            background: roleBadgeBg,
                            color: roleColor,
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            {msg.role}
                          </span>
                          {isTool && (
                            <span style={{ fontSize: '12px', color: '#fde047', fontFamily: 'monospace' }}>
                              [{msg.name || msg.tool_call_id}]
                            </span>
                          )}
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            #{idx + 1} • {contentString?.length || 0} karakter (~{Math.ceil((contentString?.length || 0) / 3.6)} token)
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isSystem && (
                            <button
                              type="button"
                              onClick={() => setExpandedSystem(!expandedSystem)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              {expandedSystem ? 'Daralt ▲' : 'Tamamını Gör ▼'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(contentString, `msg_${idx}`)}
                            title="İçeriği Kopyala"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedKey === `msg_${idx}` ? '#22c55e' : '#94a3b8',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px'
                            }}
                          >
                            <CopyIcon size={13} />
                            <span>{copiedKey === `msg_${idx}` ? 'Kopyalandı' : 'Kopyala'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Message Content */}
                      <div style={{
                        padding: '14px',
                        fontSize: '13px',
                        lineHeight: 1.6,
                        fontFamily: isSystem || isTool ? 'JetBrains Mono, Menlo, monospace' : 'inherit',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: isSystem ? '#cbd5e1' : '#f1f5f9',
                        maxHeight: isSystem && !expandedSystem ? '220px' : 'none',
                        overflowY: isSystem && !expandedSystem ? 'hidden' : 'visible',
                        position: 'relative'
                      }}>
                        {contentString}
                        {isSystem && !expandedSystem && (
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '60px',
                            background: 'linear-gradient(180deg, transparent 0%, #111827 100%)',
                            pointerEvents: 'none'
                          }} />
                        )}
                      </div>

                      {/* Tool Calls inside Assistant */}
                      {msg.tool_calls && (
                        <div style={{
                          padding: '10px 14px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          background: 'rgba(234, 179, 8, 0.04)'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#fde047', marginBottom: '6px' }}>
                            Modelin Tetiklediği Araç Çağrıları ({msg.tool_calls.length}):
                          </div>
                          {msg.tool_calls.map((tc: any, tIdx: number) => (
                            <div key={tIdx} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#f8fafc', background: '#0b0f19', padding: '6px 10px', borderRadius: '5px', marginBottom: '4px' }}>
                              <span style={{ color: '#38bdf8' }}>{tc.function?.name || tc.name}</span>
                              <span style={{ color: '#94a3b8' }}>({typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments)})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* TAB 2: TOOLS OFFERED TO LLM */}
            {activeTab === 'tools' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Ajanın LLM'e <code>tools</code> parametresinde ilettiği OpenAI fonksiyon tanımları:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '12px' }}>
                  {filteredTools.map((t: any, idx: number) => {
                    const fn = t.function || t
                    return (
                      <div
                        key={idx}
                        style={{
                          background: '#111827',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8', fontFamily: 'monospace' }}>
                            {fn.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(JSON.stringify(t, null, 2), `tool_${fn.name}`)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedKey === `tool_${fn.name}` ? '#22c55e' : '#94a3b8',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px'
                            }}
                          >
                            <CopyIcon size={12} />
                            <span>{copiedKey === `tool_${fn.name}` ? 'Kopyalandı' : 'JSON'}</span>
                          </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                          {fn.description || 'Açıklama belirtilmemiş.'}
                        </p>
                        <details style={{ marginTop: '6px' }}>
                          <summary style={{ fontSize: '11px', color: '#6366f1', cursor: 'pointer', userSelect: 'none' }}>
                            Parametre Şeması (JSON Schema)
                          </summary>
                          <pre style={{
                            marginTop: '8px',
                            padding: '8px',
                            background: '#0a0e17',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: '#e2e8f0',
                            overflowX: 'auto',
                            maxHeight: '200px'
                          }}>
                            {JSON.stringify(fn.parameters || {}, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: TOOL EXECUTIONS RECORDED */}
            {activeTab === 'executions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Modelin bu tur içinde çağırıp harness tarafından yürütülen araç çıktıları:
                </div>

                {!currentTurn.toolExecutions || currentTurn.toolExecutions.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', background: '#111827', borderRadius: '8px' }}>
                    Bu turda hiçbir araç çalıştırılmadı (Model doğrudan son yanıt üretti).
                  </div>
                ) : (
                  currentTurn.toolExecutions.map((exec: any, idx: number) => {
                    const outputStr = typeof exec.output === 'string' ? exec.output : JSON.stringify(exec.output, null, 2)
                    return (
                      <div
                        key={idx}
                        style={{
                          background: '#111827',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8', fontFamily: 'monospace' }}>
                              ⚡ {exec.toolName}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              ({exec.durationMs ? `${exec.durationMs}ms` : 'tamamlandı'})
                            </span>
                            {exec.spilled && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171'
                              }}>
                                SPILLED TO DISK
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopy(outputStr, `exec_${idx}`)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedKey === `exec_${idx}` ? '#22c55e' : '#94a3b8',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px'
                            }}
                          >
                            <CopyIcon size={12} />
                            <span>{copiedKey === `exec_${idx}` ? 'Kopyalandı' : 'Çıktıyı Kopyala'}</span>
                          </button>
                        </div>

                        {/* Arguments */}
                        <div style={{ padding: '8px 14px', background: '#0c111d', fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                          <span style={{ color: '#6366f1' }}>Parametreler:</span> {JSON.stringify(exec.args || {})}
                        </div>

                        {/* Output */}
                        <pre style={{
                          margin: 0,
                          padding: '12px 14px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          color: '#e2e8f0',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '300px',
                          overflowY: 'auto'
                        }}>
                          {outputStr}
                        </pre>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* TAB 4: MODEL RESPONSE & THINKING */}
            {activeTab === 'response' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Reasoning / Thinking Process */}
                {currentTurn.llmResponse?.thinkingContent && (
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.06)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#a5b4fc', fontSize: '13px', fontWeight: 600 }}>
                      <span>🧠 Model Düşünce Süreci (Thinking / Reasoning):</span>
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#e0e7ff', whiteSpace: 'pre-wrap' }}>
                      {currentTurn.llmResponse.thinkingContent}
                    </div>
                  </div>
                )}

                {/* Final Assistant Output */}
                <div style={{
                  background: '#111827',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>
                      💬 Nihai Asistan Yanıtı:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentTurn.llmResponse?.assistantContent || '', 'copy_response')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedKey === 'copy_response' ? '#22c55e' : '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px'
                      }}
                    >
                      <CopyIcon size={12} />
                      <span>{copiedKey === 'copy_response' ? 'Kopyalandı' : 'Kopyala'}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#f8fafc', whiteSpace: 'pre-wrap' }}>
                    {currentTurn.llmResponse?.assistantContent || '(Bu turda metin yanıtı üretilmedi, araçlar çağrıldı)'}
                  </div>
                </div>

                {/* Token Usage Stats */}
                {(currentTurn.llmResponse?.usage || sessionContext?.actualUsage || sessionContext?.totalInputTokens) && (() => {
                  const usage = currentTurn.llmResponse?.usage || sessionContext?.actualUsage || {
                    promptTokens: sessionContext?.totalInputTokens || 0,
                    completionTokens: 0,
                    totalTokens: sessionContext?.totalInputTokens || 0
                  }
                  return (
                    <div style={{
                      background: '#111827',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
                          📊 Model Tüketim Raporu (Token Usage):
                        </span>
                        {!currentTurn.llmResponse?.usage && (
                          <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                            Tokenizer / Oturum Metrikleri
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
                        <div style={{ background: '#0a0e17', padding: '10px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Prompt Tokens</div>
                          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                            {usage.promptTokens?.toLocaleString() || 0}
                          </div>
                        </div>
                        <div style={{ background: '#0a0e17', padding: '10px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Completion Tokens</div>
                          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                            {usage.completionTokens?.toLocaleString() || 0}
                          </div>
                        </div>
                        <div style={{ background: '#0a0e17', padding: '10px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Toplam Token</div>
                          <div style={{ fontSize: '16px', fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
                            {usage.totalTokens?.toLocaleString() || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* TAB 5: RAW JSON */}
            {activeTab === 'raw' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Bu turun eksiksiz snapshot JSON çıktısı:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(currentTurn, null, 2), 'copy_raw')}
                    style={{
                      background: '#161e2e',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#e2e8f0',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <CopyIcon size={12} />
                    <span>{copiedKey === 'copy_raw' ? 'Kopyalandı!' : 'Tüm JSON\'ı Kopyala'}</span>
                  </button>
                </div>
                <pre style={{
                  margin: 0,
                  padding: '16px',
                  background: '#0b0f19',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  overflowX: 'auto',
                  maxHeight: '600px'
                }}>
                  {JSON.stringify(currentTurn, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
