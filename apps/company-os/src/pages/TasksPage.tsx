import React, { useState } from 'react'
import type { Position, Routine, ActivityReceipt, ChatThread } from '../types.js'

interface TasksPageProps {
  positions: Position[]
  receipts: ActivityReceipt[]
  routines: Routine[]
  chatThreads: ChatThread[]
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

export const TasksPage: React.FC<TasksPageProps> = ({
  positions,
  receipts,
  routines,
  chatThreads,
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
  const [filter, setFilter] = useState<'all' | 'running' | 'scheduled' | 'completed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)

  // Filter routines by search
  const filteredRoutines = routines.filter(r => {
    if (!searchTerm) return true
    const pos = positions.find(p => p.presetId === r.preset || p.id === r.preset)
    const title = pos?.title || r.preset || ''
    return r.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Derive all tasks from receipts, active agent statuses, and routines
  const directiveReceipts = receipts.filter(r => r.actionType === 'directive_issued' || r.actionType === 'report_generated')

  // Find active executing positions
  const executingPositions = positions.filter(p => p.status === 'executing' || p.status === 'thinking')

  const countRunning = executingPositions.length
  const countScheduled = routines.length
  const countCompleted = directiveReceipts.filter(r => r.actionType === 'report_generated').length

  return (
    <div className="tasks-page-container">
      {/* Header */}
      <div className="tasks-header-section">
        <div>
          <h2 className="tasks-page-title">
            <span style={{ marginRight: '8px' }}>📋</span>
            Tasks & Corporate Directives
          </h2>
          <p className="tasks-page-subtitle">
            Departmanlara atanan kurumsal görevler, yürütülmekte olan işlemler ve üretilen çıktılar.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onRefresh && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onRefresh}
              title="Görevleri ve rutinleri yeniden yükle"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px' }}
            >
              <span>🔄</span>
              <span>Yenile</span>
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={onOpenDirective}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>⚡</span>
            <span>Yeni Görev / Direktif Ata</span>
          </button>
        </div>
      </div>

      {/* Task Summary Metrics */}
      <div className="tasks-kpi-bar">
        <div className="task-kpi-chip">
          <span className="kpi-label">Toplam Görev Kaydı</span>
          <span className="kpi-val emerald">{directiveReceipts.length + routines.length}</span>
        </div>
        <div className="task-kpi-chip">
          <span className="kpi-label">Yürütülüyor (Canlı)</span>
          <span className="kpi-val amber">{countRunning}</span>
        </div>
        <div className="task-kpi-chip">
          <span className="kpi-label">Zamanlanmış Rutinler</span>
          <span className="kpi-val sky">{countScheduled}</span>
        </div>
        <div className="task-kpi-chip">
          <span className="kpi-label">Tamamlanan Çıktılar</span>
          <span className="kpi-val">{countCompleted}</span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="tasks-filter-bar">
        <div className="tasks-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Görev, departman veya rapor ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="tasks-filter-tabs">
          <button
            type="button"
            className={`task-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tüm Görevler
          </button>
          <button
            type="button"
            className={`task-tab-btn ${filter === 'running' ? 'active' : ''}`}
            onClick={() => setFilter('running')}
          >
            Yürütülüyor ({countRunning})
          </button>
          <button
            type="button"
            className={`task-tab-btn ${filter === 'scheduled' ? 'active' : ''}`}
            onClick={() => setFilter('scheduled')}
          >
            Zamanlanmış ({countScheduled})
          </button>
          <button
            type="button"
            className={`task-tab-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Tamamlanan
          </button>
        </div>
      </div>

      {/* Active Executing Section if any */}
      {(filter === 'all' || filter === 'running') && executingPositions.length > 0 && (
        <div className="tasks-section-block">
          <div className="tasks-section-title">
            <span className="pulse-dot-amber" />
            <span>Şu Anda Yürütülen Aktif Görevler ({executingPositions.length})</span>
          </div>

          <div className="tasks-cards-grid">
            {executingPositions.map(pos => (
              <div key={pos.id} className="task-card running-task">
                <div className="task-card-header">
                  <div className="task-agent-info">
                    <span className="task-agent-icon">{pos.icon}</span>
                    <div>
                      <div className="task-agent-title">{pos.title}</div>
                      <div className="task-agent-role">{pos.role}</div>
                    </div>
                  </div>
                  <span className="task-status-badge running">
                    <span className="spinner-amber">◌</span>
                    <span>İşlemde</span>
                  </span>
                </div>

                <div className="task-card-body">
                  <div className="task-prompt-text">
                    {pos.currentAction || 'Direktif yürütülüyor...'}
                  </div>
                  {pos.specialization && (
                    <div className="task-sub-info">
                      📁 {pos.specialization}
                    </div>
                  )}
                </div>

                <div className="task-card-footer">
                  <span className="task-time-text">Canlı Yürütme</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Tasks Section */}
      {(filter === 'all' || filter === 'scheduled') && filteredRoutines.length > 0 && (
        <div className="tasks-section-block">
          <div className="tasks-section-title">
            <span style={{ color: '#38bdf8' }}>⏰</span>
            <span>Planlanmış & Rutin Görevler ({filteredRoutines.length})</span>
          </div>

          <div className="tasks-cards-grid">
            {filteredRoutines.map(routine => {
              const pos = positions.find(p => p.presetId === routine.preset || p.id === routine.preset)
              const statusStr = String(routine.status || 'active')
              const isActive = statusStr === 'active' || statusStr === 'running'
              const isTriggered = statusStr === 'triggered'

              return (
                <div key={routine.id} className="task-card scheduled-task">
                  <div className="task-card-header">
                    <div className="task-agent-info">
                      <span className="task-agent-icon">{pos?.icon || '⏱️'}</span>
                      <div>
                        <div className="task-agent-title">
                          {pos?.title || routine.preset || 'Sistem'}
                          {routine.id && (
                            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px', fontWeight: 'normal', fontFamily: 'monospace' }}>
                              [{routine.id}]
                            </span>
                          )}
                        </div>
                        <div className="task-agent-role">Zamanlanmış Rutin</div>
                      </div>
                    </div>
                    <span className={`task-status-badge ${isActive ? 'running' : isTriggered ? 'completed' : 'scheduled'}`}>
                      {isActive ? (
                        <span style={{ color: '#38bdf8' }}>🟢 Aktif Rutin</span>
                      ) : isTriggered ? (
                        <span style={{ color: '#10b981' }}>✓ Tetiklendi</span>
                      ) : (
                        <span>⏰ Planlandı</span>
                      )}
                    </span>
                  </div>

                  <div className="task-card-body">
                    <div className="task-prompt-text">{routine.prompt}</div>
                    <div className="task-sub-info">
                      {routine.everySeconds
                        ? `⏱️ Periyodik: Her ${routine.everySeconds} saniyede bir (${Math.round(routine.everySeconds / 60)} dk)`
                        : routine.cronExpression
                        ? `🗓️ Cron: ${routine.cronExpression}`
                        : routine.afterSeconds
                        ? `⏳ Geri sayım: ${routine.afterSeconds}s`
                        : '🔄 Periyodik Rutin'}
                      {routine.triggerCount > 0 && ` • ${routine.triggerCount} kez çalıştı`}
                    </div>
                  </div>

                  <div className="task-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="task-time-text">
                      {routine.targetTime ? `Sonraki Hedef: ${new Date(routine.targetTime).toLocaleTimeString('tr-TR')}` : 'Beklemede'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {onTriggerRoutine && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onTriggerRoutine(routine.id)
                          }}
                          title="Bu rutini beklemeden hemen şimdi tetikle"
                        >
                          ▶ Şimdi Çalıştır
                        </button>
                      )}
                      {routine.everySeconds && routine.everySeconds > 60 && onUpdateRoutineInterval && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateRoutineInterval(routine.id, 60)
                          }}
                          title="Periyodu 1 dakikaya (60s) düşür ve izle"
                        >
                          ⚡ 1 Dk Yap
                        </button>
                      )}
                      {onDeleteRoutine && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteRoutine(routine.id)
                          }}
                          title="Bu rutini sil"
                        >
                          🗑️ Sil
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

      {/* Directives & Completed Deliverables Section */}
      {(filter === 'all' || filter === 'completed') && (
        <div className="tasks-section-block">
          <div className="tasks-section-title">
            <span style={{ color: '#10b981' }}>✓</span>
            <span>Görev Geçmişi & Teslim Edilen Raporlar</span>
          </div>

          <div className="tasks-cards-grid">
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
                  <div key={receipt.id} className="task-card completed-task">
                    <div className="task-card-header">
                      <div className="task-agent-info">
                        <span className="task-agent-icon">{isReport ? '📄' : '⚡'}</span>
                        <div>
                          <div className="task-agent-title">{receipt.positionTitle}</div>
                          <div className="task-agent-role">
                            {isReport ? 'Rapor Teslimi' : 'Kurumsal Direktif'}
                          </div>
                        </div>
                      </div>
                      <span className={`task-status-badge ${isReport ? 'completed' : 'directive'}`}>
                        {isReport ? '✓ Tamamlandı' : '⚡ İletildi'}
                      </span>
                    </div>

                    <div className="task-card-body">
                      <div className="task-prompt-text">{receipt.summary}</div>
                      {reportText && expandedReportId === receipt.id && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(15, 23, 42, 0.65)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          lineHeight: '1.6',
                          color: '#cbd5e1',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                          {reportText}
                        </div>
                      )}
                    </div>

                    <div className="task-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="task-time-text">
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
                              color: expandedReportId === receipt.id ? '#f59e0b' : '#94a3b8',
                              borderColor: expandedReportId === receipt.id ? 'rgba(245, 158, 11, 0.4)' : 'rgba(148, 163, 184, 0.2)'
                            }}
                            onClick={() => setExpandedReportId(prev => prev === receipt.id ? null : receipt.id)}
                            title="Rapor metnini genişlet / daralt"
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
                            title="Bu görevin tüm mesaj ve düşünce akışını gör"
                          >
                            <span>💬 Akışı Gör</span>
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
                            title="Rapor dosyasını görüntüle"
                          >
                            <span>📄 Raporu Aç</span>
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
                            title="Bu görev kaydını geçmişten sil"
                          >
                            <span>🗑️ Sil</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>

          {directiveReceipts.length === 0 && (
            <div className="tasks-empty-state">
              <span>📋</span>
              <p>Henüz kaydedilmiş bir görev veya direktif bulunmuyor.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={onOpenDirective}
                style={{ marginTop: '12px' }}
              >
                İlk Direktifi Ver ➔
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
