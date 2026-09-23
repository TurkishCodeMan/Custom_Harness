import React from 'react'
import type { Position, Routine, ActivityReceipt, ApprovalItem, NavView } from '../types.js'

interface DashboardPageProps {
  positions: Position[]
  routines: Routine[]
  receipts: ActivityReceipt[]
  approvals: ApprovalItem[]
  onOpenDirective: () => void
  onSelectPosition: (pos: Position) => void
  onNavigateView: (view: NavView) => void
  companyName: string
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  positions,
  routines,
  receipts,
  approvals,
  onOpenDirective,
  onSelectPosition,
  onNavigateView,
  companyName
}) => {
  const pendingApprovals = approvals.filter(a => a.status === 'pending')
  const executingAgents = positions.filter(p => p.status === 'executing' || p.status === 'thinking')

  return (
    <div className="dashboard-view-container">
      {/* Welcome Banner */}
      <div className="dashboard-hero-banner">
        <div className="hero-text-wrap">
          <span className="hero-sub-tag">ENTERPRISE AI OS</span>
          <h1 className="hero-main-title">{companyName} Operasyon Merkezi</h1>
          <p className="hero-desc">
            Departmanlar arası hiyerarşik yapay zeka ajanları, canlı denetim izi ve onay süreçleri tek ekranda.
          </p>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="btn-hero-directive"
            onClick={onOpenDirective}
          >
            <span>⚡</span>
            <span>Yeni Direktif Ver</span>
          </button>
        </div>
      </div>

      {/* Real KPI Metrics Grid */}
      <div className="dashboard-kpi-grid">
        <div className="kpi-metric-card" onClick={() => onNavigateView('agents')}>
          <div className="kpi-card-header">
            <span className="kpi-icon">🤖</span>
            <span className="kpi-badge-active">{positions.length} Koltuk</span>
          </div>
          <div className="kpi-value">{positions.length}</div>
          <div className="kpi-label">Aktif Ajan Pozisyonu</div>
          <div className="kpi-subtext">
            {executingAgents.length > 0
              ? `⚡ ${executingAgents.length} ajan şu anda işlem yapıyor`
              : 'Tüm departmanlar hazır ve boşta'}
          </div>
        </div>

        <div className="kpi-metric-card" onClick={() => onNavigateView('approvals')}>
          <div className="kpi-card-header">
            <span className="kpi-icon">🛡️</span>
            {pendingApprovals.length > 0 ? (
              <span className="kpi-badge-warning">{pendingApprovals.length} Bekleyen</span>
            ) : (
              <span className="kpi-badge-active">Güvenli</span>
            )}
          </div>
          <div className="kpi-value">{pendingApprovals.length}</div>
          <div className="kpi-label">Onay Bekleyen İşlem</div>
          <div className="kpi-subtext">
            {pendingApprovals.length > 0
              ? 'Kritik araç çalıştırma onayı bekliyor'
              : 'Tüm işlemler yetki sınırında'}
          </div>
        </div>

        <div className="kpi-metric-card" onClick={() => onNavigateView('recurring')}>
          <div className="kpi-card-header">
            <span className="kpi-icon">🔄</span>
            <span className="kpi-badge-active">{routines.length} Rutin</span>
          </div>
          <div className="kpi-value">{routines.length}</div>
          <div className="kpi-label">Otomatik Şirket Rutini</div>
          <div className="kpi-subtext">Aktif zamanlanmış kural & denetim</div>
        </div>

        <div className="kpi-metric-card" onClick={() => onNavigateView('roi')}>
          <div className="kpi-card-header">
            <span className="kpi-icon">📜</span>
            <span className="kpi-badge-active">{receipts.length} Fiş</span>
          </div>
          <div className="kpi-value">{receipts.length}</div>
          <div className="kpi-label">Denetim İzi & Kararlar</div>
          <div className="kpi-subtext">100% Replayable karar defteri</div>
        </div>
      </div>

      {/* Two Column Section: Real Department Status & Real Receipts */}
      <div className="dashboard-columns-grid">
        <div className="dashboard-panel-card">
          <div className="panel-card-header">
            <h3 className="panel-title">Departman Ajanları Durumu</h3>
            <button
              type="button"
              className="panel-link-btn"
              onClick={() => onNavigateView('company')}
            >
              Şemayı Gör ➔
            </button>
          </div>

          <div className="department-status-list">
            {positions.map(pos => (
              <div
                key={pos.id}
                className="dept-status-row"
                onClick={() => onSelectPosition(pos)}
              >
                <div className="dept-left">
                  <span className="dept-icon">{pos.icon}</span>
                  <div>
                    <span className="dept-title">{pos.title}</span>
                    <span className="dept-role">{pos.role}</span>
                  </div>
                </div>

                <div className="dept-right">
                  <span className={`dept-status-pill ${pos.status}`}>
                    {pos.status === 'executing' && '⚡ Yürütülüyor'}
                    {pos.status === 'thinking' && '💭 Düşünüyor'}
                    {pos.status === 'completed' && '✓ Rapor Hazır'}
                    {pos.status === 'idle' && 'Hazır'}
                    {pos.status === 'error' && '✕ Hata'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-panel-card">
          <div className="panel-card-header">
            <h3 className="panel-title">Son Alınan Kararlar & Eylemler</h3>
            <button
              type="button"
              className="panel-link-btn"
              onClick={() => onNavigateView('roi')}
            >
              Tümünü Gör ➔
            </button>
          </div>

          <div className="dashboard-receipts-list">
            {receipts.slice(-5).reverse().map(receipt => (
              <div key={receipt.id} className="dash-receipt-item">
                <div className="dash-receipt-header">
                  <span className="dash-receipt-title">{receipt.positionTitle}</span>
                  <span className="dash-receipt-time">
                    {new Date(receipt.timestamp).toLocaleTimeString('tr-TR')}
                  </span>
                </div>
                <p className="dash-receipt-summary">{receipt.summary}</p>
              </div>
            ))}

            {receipts.length === 0 && (
              <div className="receipts-empty-notice">Henüz bir eylem kaydı oluşmadı.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
