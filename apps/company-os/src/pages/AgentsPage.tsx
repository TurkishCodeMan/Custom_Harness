import React, { useState } from 'react'
import type { Position } from '../types.js'

interface AgentsPageProps {
  positions: Position[]
  onSelectPosition: (pos: Position) => void
  onDirectDirective: (pos: Position) => void
  onViewReport: (reportPath: string) => void
  onAddNewPosition: () => void
  onOpenChatWithAgent?: (pos: Position) => void
  isDirectiveRunning: boolean
}

export const AgentsPage: React.FC<AgentsPageProps> = ({
  positions,
  onSelectPosition,
  onDirectDirective,
  onViewReport,
  onAddNewPosition,
  onOpenChatWithAgent,
  isDirectiveRunning
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<'all' | '1' | '2' | '3'>('all')

  const filteredPositions = positions.filter(pos => {
    const matchesSearch =
      pos.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pos.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pos.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pos.specialization && pos.specialization.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesLevel = levelFilter === 'all' || pos.level.toString() === levelFilter

    return matchesSearch && matchesLevel
  })

  const countL1 = positions.filter(p => p.level === 1).length
  const countL2 = positions.filter(p => p.level === 2).length
  const countL3 = positions.filter(p => p.level === 3).length
  const executingCount = positions.filter(p => p.status === 'executing' || p.status === 'thinking').length

  return (
    <div className="agents-page-container">
      {/* Page Header */}
      <div className="agents-header-section">
        <div>
          <h2 className="agents-page-title">
            <span style={{ marginRight: '8px' }}>🤖</span>
            AI Teammates & Koltuklar (Presets)
          </h2>
          <p className="agents-page-subtitle">
            Şirket organizasyon şemasındaki aktif AI ajanları, uzmanlık alanları, araç yetkileri ve sistem talimatları.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={onAddNewPosition}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>➕</span>
          <span>Yeni Koltuk Ekle</span>
        </button>
      </div>

      {/* Workforce Summary KPIs */}
      <div className="agents-kpi-bar">
        <div className="agent-kpi-chip">
          <span className="kpi-label">Toplam Koltuk</span>
          <span className="kpi-val emerald">{positions.length}</span>
        </div>
        <div className="agent-kpi-chip">
          <span className="kpi-label">Aktif / İşlemde</span>
          <span className="kpi-val amber">{executingCount}</span>
        </div>
        <div className="agent-kpi-chip">
          <span className="kpi-label">L1 Genel Yönetim</span>
          <span className="kpi-val">{countL1}</span>
        </div>
        <div className="agent-kpi-chip">
          <span className="kpi-label">L2 Direktörler</span>
          <span className="kpi-val">{countL2}</span>
        </div>
        <div className="agent-kpi-chip">
          <span className="kpi-label">L3 Uzmanlar</span>
          <span className="kpi-val">{countL3}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="agents-filter-bar">
        <div className="agents-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Ajan, unvan veya preset ara... (@cfo, tedarik, vb.)"
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

        <div className="agents-level-tabs">
          <button
            type="button"
            className={`level-tab-btn ${levelFilter === 'all' ? 'active' : ''}`}
            onClick={() => setLevelFilter('all')}
          >
            Hepsi ({positions.length})
          </button>
          <button
            type="button"
            className={`level-tab-btn ${levelFilter === '1' ? 'active' : ''}`}
            onClick={() => setLevelFilter('1')}
          >
            Level 1 ({countL1})
          </button>
          <button
            type="button"
            className={`level-tab-btn ${levelFilter === '2' ? 'active' : ''}`}
            onClick={() => setLevelFilter('2')}
          >
            Level 2 ({countL2})
          </button>
          <button
            type="button"
            className={`level-tab-btn ${levelFilter === '3' ? 'active' : ''}`}
            onClick={() => setLevelFilter('3')}
          >
            Level 3 ({countL3})
          </button>
        </div>
      </div>

      {/* Agents Cards Grid */}
      <div className="agents-cards-grid">
        {filteredPositions.map(pos => {
          const isBusy = pos.status === 'executing' || pos.status === 'thinking'
          return (
            <div key={pos.id} className={`agent-preset-card ${isBusy ? 'busy' : ''}`}>
              {/* Card Top: Avatar, Level & Status */}
              <div className="agent-card-header">
                <div className="agent-avatar-wrapper">
                  <span className="agent-avatar-icon">{pos.icon}</span>
                  <span className={`agent-online-indicator ${pos.status}`} />
                </div>

                <div className="agent-card-meta">
                  <span className={`agent-level-badge level-${pos.level}`}>
                    {pos.level === 1 ? 'L1 Executive' : pos.level === 2 ? 'L2 Director' : 'L3 Specialist'}
                  </span>
                  <span className={`agent-status-pill ${pos.status}`}>
                    {pos.status === 'executing' ? 'İşlemde...' : pos.status === 'completed' ? 'Tamamlandı' : 'Hazır'}
                  </span>
                </div>
              </div>

              {/* Card Body: Title & Role */}
              <div className="agent-card-body">
                <h3 className="agent-title">{pos.title}</h3>
                <p className="agent-role">{pos.role}</p>

                <div className="agent-preset-pill">
                  <span className="preset-prefix">@preset:</span>
                  <span className="preset-id">{pos.presetId || pos.id}</span>
                </div>

                {pos.specialization && (
                  <div className="agent-workspace-info" title={pos.workspace}>
                    <span className="folder-icon">📁</span>
                    <span className="specialization-text">{pos.specialization}</span>
                  </div>
                )}

                {/* Tools Badges */}
                <div className="agent-section-title">Yetkili Araçlar ({pos.tools.length})</div>
                <div className="agent-tools-container">
                  {pos.tools.map(tool => (
                    <span key={tool} className="agent-tool-tag">
                      {tool}
                    </span>
                  ))}
                </div>

                {/* Skills Badges */}
                {pos.skills && pos.skills.length > 0 && (
                  <>
                    <div className="agent-section-title" style={{ marginTop: '8px' }}>
                      Özel Beceriler ({pos.skills.length})
                    </div>
                    <div className="agent-skills-container">
                      {pos.skills.map(skill => (
                        <span key={skill} className="agent-skill-tag">
                          ⚡ {skill}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {/* Current Action Banner */}
                {pos.currentAction && pos.status !== 'idle' && (
                  <div className="agent-current-action-banner">
                    <span className="pulse-dot-amber" />
                    <span className="action-text">{pos.currentAction}</span>
                  </div>
                )}
              </div>

              {/* Card Footer: Action Buttons */}
              <div className="agent-card-footer">
                <button
                  type="button"
                  className="btn-agent-directive"
                  onClick={() => onDirectDirective(pos)}
                  disabled={isDirectiveRunning}
                  title="Bu koltuğa anında direktif ver"
                >
                  <span>⚡ Direktif</span>
                </button>

                {onOpenChatWithAgent && (
                  <button
                    type="button"
                    className="btn-agent-chat"
                    onClick={() => onOpenChatWithAgent(pos)}
                    title="Bu koltukla sohbete geç"
                  >
                    <span>💬 Sohbet</span>
                  </button>
                )}

                {pos.lastReport && (
                  <button
                    type="button"
                    className="btn-agent-report"
                    onClick={() => onViewReport(pos.lastReport!.path)}
                    title="Son oluşturulan denetim raporunu aç"
                  >
                    <span>📄 Rapor</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn-agent-edit"
                  onClick={() => onSelectPosition(pos)}
                  title="Koltuk ayarlarını ve promptunu düzenle"
                >
                  <span>⚙️</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredPositions.length === 0 && (
        <div className="agents-empty-state">
          <span>🔍</span>
          <p>Arama kriterine uygun koltuk bulunamadı.</p>
        </div>
      )}
    </div>
  )
}
