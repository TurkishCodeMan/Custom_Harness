import React from 'react'

interface HeaderProps {
  activeTab: 'org' | 'routines' | 'receipts'
  setActiveTab: (tab: 'org' | 'routines' | 'receipts') => void
  isConnected: boolean
  onOpenDirective: () => void
  onOpenNewPosition: () => void
  onOpenCompanyWorkspace?: () => void
  companyName: string
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
  onOpenDirective,
  onOpenNewPosition,
  onOpenCompanyWorkspace,
  companyName
}) => {
  return (
    <header className="top-header">
      <div className="brand-badge">
        <div className="brand-logo-icon">▲</div>
        <div>
          <h1 className="brand-title">Company OS</h1>
        </div>

        <button
          type="button"
          className="company-selector"
          onClick={onOpenCompanyWorkspace}
          title="Şirket ve Çalışma Alanını Değiştir (Tıklayın)"
          style={{
            cursor: 'pointer',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: '6px',
            color: '#f8fafc',
            transition: 'all 0.15s ease'
          }}
        >
          <span>🏢</span>
          <span style={{ fontWeight: 600 }}>{companyName}</span>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>▾</span>
        </button>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'org' ? 'active' : ''}`}
          onClick={() => setActiveTab('org')}
        >
          <span>🏛️</span>
          <span>Organizasyon Şeması</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'routines' ? 'active' : ''}`}
          onClick={() => setActiveTab('routines')}
        >
          <span>⏰</span>
          <span>Şirket Rutinleri</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'receipts' ? 'active' : ''}`}
          onClick={() => setActiveTab('receipts')}
        >
          <span>📜</span>
          <span>Denetim İzi (Receipts)</span>
        </button>
      </nav>

      <div className="header-actions">
        <div className="status-pill" style={{
          background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          borderColor: isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
          color: isConnected ? '#10b981' : '#f59e0b'
        }}>
          <div className="status-pulse-dot" style={{
            backgroundColor: isConnected ? '#10b981' : '#f59e0b',
            boxShadow: isConnected ? '0 0 8px #10b981' : '0 0 8px #f59e0b'
          }} />
          <span>{isConnected ? 'Sistem Çevrimiçi' : 'Bağlanıyor...'}</span>
        </div>

        <button className="btn-secondary" onClick={onOpenNewPosition} style={{ padding: '8px 14px', fontSize: '13px' }}>
          <span>➕</span>
          <span>Koltuk Ekle</span>
        </button>

        <button className="btn-directive" onClick={onOpenDirective}>
          <span>⚡</span>
          <span>Direktif Ver</span>
        </button>
      </div>
    </header>
  )
}
