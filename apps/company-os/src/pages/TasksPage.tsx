import React, { useState } from 'react'
import type { Position, Routine, ActivityReceipt, ChatThread, ApprovalItem } from '../types.js'

interface TasksPageProps {
  positions: Position[]
  receipts: ActivityReceipt[]
  routines: Routine[]
  chatThreads: ChatThread[]
  approvals?: ApprovalItem[]
  onOpenDirective: () => void
  onViewReport: (reportPath: string) => void
  onSelectThread: (thread: ChatThread) => void
  onRefresh?: () => void
  onDeleteRoutine?: (id: string) => void
  onUpdateRoutineInterval?: (id: string, everySeconds: number) => void
  onTriggerRoutine?: (id: string) => void
  isDirectiveRunning?: boolean
  onDeleteReceipt?: (id: string) => void
}

export type CaseRunStatus = 'executing' | 'waiting_for_approval' | 'scheduled' | 'completed' | 'idle'

export const TasksPage: React.FC<TasksPageProps> = ({
  positions,
  receipts,
  routines,
  chatThreads,
  approvals = [],
  onOpenDirective,
  onViewReport,
  onSelectThread,
  onRefresh,
  onDeleteRoutine,
  onUpdateRoutineInterval,
  onTriggerRoutine,
  isDirectiveRunning,
  onDeleteReceipt
}) => {
  const [filter, setFilter] = useState<'all' | 'executing' | 'waiting_for_approval' | 'scheduled' | 'completed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)

  // Pending approvals
  const pendingApprovals = approvals.filter(a => a.status === 'pending')

  // Derive status for each chat thread (Case / Run)
  const casesWithStatus = chatThreads.map(thread => {
    const targetPos = positions.find(p => p.id === thread.targetPositionId || p.presetId === thread.targetPositionId)
    const hasPendingApproval = pendingApprovals.some(app => 
      app.sessionId === thread.id || (thread.sessionId && app.sessionId === thread.sessionId)
    )

    let status: CaseRunStatus = 'idle'
    if (targetPos?.status === 'executing' || targetPos?.status === 'thinking' || (isDirectiveRunning && thread.id === chatThreads[0]?.id)) {
      status = 'executing'
    } else if (hasPendingApproval) {
      status = 'waiting_for_approval'
    } else if (thread.lastMessage || thread.title) {
      status = 'completed'
    }

    return {
      thread,
      targetPos,
      status,
      hasPendingApproval
    }
  })

  // Filter routines by search
  const filteredRoutines = routines.filter(r => {
    if (!searchTerm) return true
    const pos = positions.find(p => p.presetId === r.preset || p.id === r.preset)
    const title = pos?.title || r.preset || ''
    return r.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Filter cases by search & status tab
  const filteredCases = casesWithStatus.filter(c => {
    const matchesSearch = !searchTerm ||
      c.thread.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.targetPos?.title.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    if (filter === 'all') return true
    if (filter === 'executing') return c.status === 'executing'
    if (filter === 'waiting_for_approval') return c.status === 'waiting_for_approval'
    if (filter === 'completed') return c.status === 'completed'
    if (filter === 'scheduled') return false
    return true
  })

  // Derive counts for KPI and Filter Badges
  const countExecuting = casesWithStatus.filter(c => c.status === 'executing').length || positions.filter(p => p.status === 'executing' || p.status === 'thinking').length
  const countWaiting = pendingApprovals.length
  const countScheduled = routines.length
  const countCompleted = casesWithStatus.filter(c => c.status === 'completed').length + receipts.filter(r => r.actionType === 'report_generated').length

  const directiveReceipts = receipts.filter(r => r.actionType === 'directive_issued' || r.actionType === 'report_generated')

  return (
    <div className="tasks-page-container" style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div className="tasks-header-section" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div>
          <h2 className="tasks-page-title" style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💼</span>
            Cases & Execution Runs
          </h2>
          <p className="tasks-page-subtitle" style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Ajanlara açılan vaka oturumları, canlı yürütme akışları, insan onayları ve teslim edilen raporlar.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onRefresh && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onRefresh}
              title="Görevleri ve rutinleri yeniden yükle"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12.5px' }}
            >
              <span>🔄</span>
              <span>Yenile</span>
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={onOpenDirective}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12.5px' }}
          >
            <span>⚡</span>
            <span>Yeni Direktif & Vaka Başlat</span>
          </button>
        </div>
      </div>

      {/* Task Summary Metrics Bar */}
      <div className="tasks-kpi-bar" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div className="task-kpi-chip" style={{ background: 'rgba(30, 41, 59, 0.45)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '10px', padding: '12px 16px' }}>
          <span className="kpi-label" style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Toplam Vaka & Koşu</span>
          <span className="kpi-val" style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
            {chatThreads.length + routines.length}
          </span>
        </div>

        <div className="task-kpi-chip" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', padding: '12px 16px' }}>
          <span className="kpi-label" style={{ fontSize: '11.5px', color: '#fbbf24', display: 'block', marginBottom: '4px' }}>⚡ Canlı Yürütülüyor</span>
          <span className="kpi-val amber" style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24' }}>
            {countExecuting}
          </span>
        </div>

        <div className="task-kpi-chip" style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', padding: '12px 16px' }}>
          <span className="kpi-label" style={{ fontSize: '11.5px', color: '#c084fc', display: 'block', marginBottom: '4px' }}>⏳ Onay Bekleyen</span>
          <span className="kpi-val" style={{ fontSize: '20px', fontWeight: 700, color: '#c084fc' }}>
            {countWaiting}
          </span>
        </div>

        <div className="task-kpi-chip" style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '12px 16px' }}>
          <span className="kpi-label" style={{ fontSize: '11.5px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>⏰ Zamanlanmış Rutinler</span>
          <span className="kpi-val sky" style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8' }}>
            {countScheduled}
          </span>
        </div>

        <div className="task-kpi-chip" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '12px 16px' }}>
          <span className="kpi-label" style={{ fontSize: '11.5px', color: '#34d399', display: 'block', marginBottom: '4px' }}>✓ Tamamlanan Çıktılar</span>
          <span className="kpi-val emerald" style={{ fontSize: '20px', fontWeight: 700, color: '#34d399' }}>
            {countCompleted}
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="tasks-filter-bar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Search */}
        <div className="tasks-search-box" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '6px 12px',
          width: '320px'
        }}>
          <span className="search-icon" style={{ fontSize: '13px', color: '#64748b' }}>🔍</span>
          <input
            type="text"
            placeholder="Vaka, direktif veya ajan ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '13px',
              width: '100%'
            }}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Distinct Status Filter Badges */}
        <div className="tasks-filter-tabs" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* All */}
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              background: filter === 'all' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              borderColor: filter === 'all' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)',
              color: filter === 'all' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease'
            }}
          >
            Tüm Vakalar & Koşular
          </button>

          {/* Executing Badge */}
          <button
            type="button"
            onClick={() => setFilter('executing')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: filter === 'executing' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.05)',
              borderColor: filter === 'executing' ? '#f59e0b' : 'rgba(245, 158, 11, 0.25)',
              color: filter === 'executing' ? '#fbbf24' : '#d97706',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.2s infinite' }} />
            <span>⚡ Yürütülüyor ({countExecuting})</span>
          </button>

          {/* Waiting for approval Badge */}
          <button
            type="button"
            onClick={() => setFilter('waiting_for_approval')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: filter === 'waiting_for_approval' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.05)',
              borderColor: filter === 'waiting_for_approval' ? '#a855f7' : 'rgba(168, 85, 247, 0.25)',
              color: filter === 'waiting_for_approval' ? '#c084fc' : '#a855f7',
              transition: 'all 0.15s ease'
            }}
          >
            <span>⏳ Onay Bekleyen ({countWaiting})</span>
          </button>

          {/* Scheduled Badge */}
          <button
            type="button"
            onClick={() => setFilter('scheduled')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: filter === 'scheduled' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.05)',
              borderColor: filter === 'scheduled' ? '#38bdf8' : 'rgba(56, 189, 248, 0.25)',
              color: filter === 'scheduled' ? '#38bdf8' : '#0284c7',
              transition: 'all 0.15s ease'
            }}
          >
            <span>⏰ Zamanlanmış ({countScheduled})</span>
          </button>

          {/* Completed Badge */}
          <button
            type="button"
            onClick={() => setFilter('completed')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: filter === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.05)',
              borderColor: filter === 'completed' ? '#10b981' : 'rgba(16, 185, 129, 0.25)',
              color: filter === 'completed' ? '#34d399' : '#059669',
              transition: 'all 0.15s ease'
            }}
          >
            <span>✓ Tamamlanan ({countCompleted})</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Cases & Active Execution Runs (Primary View) */}
      {(filter === 'all' || filter === 'executing' || filter === 'waiting_for_approval' || filter === 'completed') && filteredCases.length > 0 && (
        <div className="tasks-section-block" style={{ marginBottom: '28px' }}>
          <div className="tasks-section-title" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 700,
            color: '#e2e8f0',
            marginBottom: '12px'
          }}>
            <span>📁</span>
            <span>Vakalar & Canlı Oturumlar ({filteredCases.length})</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '14px'
          }}>
            {filteredCases.map(({ thread, targetPos, status }) => {
              const previewText = thread.lastMessage || 'Oturum aktif...'

              return (
                <div
                  key={thread.id}
                  onClick={() => onSelectThread(thread)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: `1px solid ${
                      status === 'executing' ? 'rgba(245, 158, 11, 0.4)' :
                      status === 'waiting_for_approval' ? 'rgba(168, 85, 247, 0.4)' :
                      'rgba(255, 255, 255, 0.08)'
                    }`,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: status === 'executing' ? '0 0 15px rgba(245, 158, 11, 0.12)' : 'none'
                  }}
                >
                  {/* Case Card Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{ fontSize: '24px', flexShrink: 0 }}>
                        {targetPos?.icon || '🤖'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {thread.title}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {targetPos?.title || 'Sistem Ajanı'} • {thread.period === 'today' ? 'Bugün' : 'Geçmiş Oturum'}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div style={{ flexShrink: 0 }}>
                      {status === 'executing' && (
                        <span style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid #f59e0b',
                          color: '#fbbf24',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24', animation: 'pulse 1s infinite' }} />
                          Yürütülüyor
                        </span>
                      )}

                      {status === 'waiting_for_approval' && (
                        <span style={{
                          background: 'rgba(168, 85, 247, 0.15)',
                          border: '1px solid #a855f7',
                          color: '#c084fc',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          ⏳ Onay Bekliyor
                        </span>
                      )}

                      {status === 'completed' && (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#34d399',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          ✓ Tamamlandı
                        </span>
                      )}

                      {status === 'idle' && (
                        <span style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#94a3b8',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px'
                        }}>
                          Beklemede
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Last message preview */}
                  <div style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.03)'
                  }}>
                    {previewText}
                  </div>

                  {/* Card Footer Actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: '10px',
                    fontSize: '11px',
                    color: '#64748b'
                  }}>
                    <span>
                      {new Date(thread.timestamp || Date.now()).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          fontSize: '11px',
                          padding: '3px 10px',
                          color: '#38bdf8',
                          borderColor: 'rgba(56, 189, 248, 0.4)'
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectThread(thread)
                        }}
                      >
                        💬 Canlı Akış ➔
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: Scheduled Routines */}
      {(filter === 'all' || filter === 'scheduled') && filteredRoutines.length > 0 && (
        <div className="tasks-section-block" style={{ marginBottom: '28px' }}>
          <div className="tasks-section-title" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 700,
            color: '#38bdf8',
            marginBottom: '12px'
          }}>
            <span>⏰</span>
            <span>Planlanmış & Rutin Görevler ({filteredRoutines.length})</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '14px'
          }}>
            {filteredRoutines.map(routine => {
              const pos = positions.find(p => p.presetId === routine.preset || p.id === routine.preset)
              const statusStr = String(routine.status || 'active')
              const isActive = statusStr === 'active' || statusStr === 'running'
              const isTriggered = statusStr === 'triggered'

              return (
                <div key={routine.id} className="task-card scheduled-task" style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div className="task-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="task-agent-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="task-agent-icon" style={{ fontSize: '22px' }}>{pos?.icon || '⏱️'}</span>
                      <div>
                        <div className="task-agent-title" style={{ fontSize: '13.5px', fontWeight: 600, color: '#f1f5f9' }}>
                          {pos?.title || routine.preset || 'Sistem'}
                          {routine.id && (
                            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px', fontFamily: 'monospace' }}>
                              [{routine.id}]
                            </span>
                          )}
                        </div>
                        <div className="task-agent-role" style={{ fontSize: '11px', color: '#94a3b8' }}>Periyodik Rutin</div>
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: isActive ? '#38bdf8' : '#34d399',
                      border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                    }}>
                      {isActive ? '🟢 Aktif Rutin' : isTriggered ? '✓ Tetiklendi' : '⏰ Planlandı'}
                    </span>
                  </div>

                  <div className="task-card-body">
                    <div className="task-prompt-text" style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.45 }}>
                      {routine.prompt}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                      {routine.everySeconds
                        ? `⏱️ Periyodik: Her ${routine.everySeconds}s (${Math.round(routine.everySeconds / 60)} dk)`
                        : routine.cronExpression
                        ? `🗓️ Cron: ${routine.cronExpression}`
                        : routine.afterSeconds
                        ? `⏳ Geri sayım: ${routine.afterSeconds}s`
                        : '🔄 Periyodik Rutin'}
                      {routine.triggerCount > 0 && ` • ${routine.triggerCount} kez çalıştı`}
                    </div>
                  </div>

                  <div className="task-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {routine.targetTime ? `Sonraki: ${new Date(routine.targetTime).toLocaleTimeString('tr-TR')}` : 'Beklemede'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {onTriggerRoutine && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                          onClick={() => onTriggerRoutine(routine.id)}
                          title="Bu rutini beklemeden hemen şimdi tetikle"
                        >
                          ▶ Şimdi Çalıştır
                        </button>
                      )}
                      {onDeleteRoutine && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                          onClick={() => onDeleteRoutine(routine.id)}
                          title="Bu rutini sil"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: Directives & Completed Deliverables Receipts */}
      {(filter === 'all' || filter === 'completed') && (
        <div className="tasks-section-block">
          <div className="tasks-section-title" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 700,
            color: '#10b981',
            marginBottom: '12px'
          }}>
            <span>✓</span>
            <span>Görev Geçmişi & Teslim Edilen Raporlar</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '14px'
          }}>
            {directiveReceipts
              .filter(r => {
                if (!searchTerm) return true
                return (
                  r.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  r.positionTitle.toLowerCase().includes(searchTerm.toLowerCase())
                )
              })
              .map(receipt => {
                const reportPath = receipt.details?.path || (typeof receipt.details === 'string' && receipt.details.match(/raporlar\/[a-zA-Z0-9_-]+\.md/)?.[0])
                const isReport = receipt.actionType === 'report_generated'
                const reportText = typeof receipt.details === 'object' ? receipt.details?.reportText : (typeof receipt.details === 'string' ? receipt.details : null)

                let matchedSessionId = receipt.details?.sessionId || (receipt as any).sessionId || (typeof receipt.details === 'object' && receipt.details?.record?.sessionId)
                if (!matchedSessionId && chatThreads && chatThreads.length > 0) {
                  const found = chatThreads.find(t => 
                    (t.id && receipt.details?.sessionId && t.id === receipt.details.sessionId) ||
                    (t.title && receipt.positionTitle && t.title.toLowerCase().includes(receipt.positionTitle.toLowerCase())) ||
                    (t.targetPositionId && t.targetPositionId === receipt.positionId) ||
                    (receipt.summary && t.title && receipt.summary.includes(t.title.slice(0, 15)))
                  )
                  if (found) {
                    matchedSessionId = found.id
                  }
                }

                return (
                  <div key={receipt.id} className="task-card completed-task" style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div className="task-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="task-agent-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="task-agent-icon" style={{ fontSize: '22px' }}>{isReport ? '📄' : '⚡'}</span>
                        <div>
                          <div className="task-agent-title" style={{ fontSize: '13.5px', fontWeight: 600, color: '#f1f5f9' }}>
                            {receipt.positionTitle}
                          </div>
                          <div className="task-agent-role" style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {isReport ? 'Rapor Teslimi' : 'Kurumsal Direktif'}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: isReport ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                        color: isReport ? '#34d399' : '#818cf8',
                        border: `1px solid ${isReport ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`
                      }}>
                        {isReport ? '✓ Tamamlandı' : '⚡ İletildi'}
                      </span>
                    </div>

                    <div className="task-card-body">
                      <div className="task-prompt-text" style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.45 }}>
                        {receipt.summary}
                      </div>
                      {reportText && expandedReportId === receipt.id && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          lineHeight: '1.6',
                          color: '#cbd5e1',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                          {reportText}
                        </div>
                      )}
                    </div>

                    <div className="task-card-footer" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      paddingTop: '10px'
                    }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {new Date(receipt.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {reportText && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              color: expandedReportId === receipt.id ? '#f59e0b' : '#94a3b8'
                            }}
                            onClick={() => setExpandedReportId(prev => prev === receipt.id ? null : receipt.id)}
                          >
                            <span>{expandedReportId === receipt.id ? '▲ Kapat' : '📋 Özeti Gör'}</span>
                          </button>
                        )}
                        {matchedSessionId && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              color: '#38bdf8',
                              borderColor: 'rgba(56, 189, 248, 0.4)'
                            }}
                            onClick={() => {
                              const thread = chatThreads?.find(t => t.id === matchedSessionId) || ({ id: matchedSessionId, title: receipt.positionTitle } as any)
                              onSelectThread(thread)
                            }}
                          >
                            <span>💬 Akış</span>
                            <span>➔</span>
                          </button>
                        )}
                        {reportPath && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              color: '#34d399',
                              borderColor: 'rgba(16, 185, 129, 0.4)'
                            }}
                            onClick={() => onViewReport(reportPath)}
                          >
                            <span>📄 Rapor</span>
                            <span>➔</span>
                          </button>
                        )}
                        {onDeleteReceipt && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              color: '#f43f5e',
                              borderColor: 'rgba(244, 63, 94, 0.3)'
                            }}
                            onClick={() => onDeleteReceipt(receipt.id)}
                          >
                            <span>🗑️</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
