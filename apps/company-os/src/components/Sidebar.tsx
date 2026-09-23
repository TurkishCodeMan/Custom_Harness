import React from 'react'
import type { NavView, ChatThread } from '../types.js'
import {
  OrganizationIcon,
  CockpitIcon,
  GovernanceIcon,
  LedgerIcon,
  KnowledgeIcon,
  RecurringIcon,
  PlugIcon,
  SettingsIcon,
  BellIcon,
  PlusIcon,
  TrashIcon,
  FlowIcon
} from './Icons.js'

interface SidebarProps {
  currentView: NavView
  onSelectView: (view: NavView) => void
  companyName: string
  onOpenCompanyWorkspace: () => void
  pendingApprovalsCount: number
  chatThreads: ChatThread[]
  activeThreadId?: string
  onSelectThread: (thread: ChatThread) => void
  onNewChat: () => void
  onDeleteThread?: (threadId: string, e: React.MouseEvent) => void
  onClearAllThreads?: () => void
  userName?: string
  userRole?: string
}

interface NavItemDef {
  id: NavView
  label: string
  icon: React.ReactNode
  badge?: number | string
  badgeVariant?: 'danger' | 'warning' | 'info'
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  companyName,
  onOpenCompanyWorkspace,
  pendingApprovalsCount,
  chatThreads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onClearAllThreads,
  userName = 'Hüseyin',
  userRole = 'Yönetici / Executive'
}) => {
  // 4 Core Executive Hubs
  const executiveHubs: NavItemDef[] = [
    {
      id: 'company',
      label: 'Organizasyon & DAG',
      icon: <OrganizationIcon size={16} />
    },
    {
      id: 'assistant',
      label: 'Yönetici Kokpiti',
      icon: <CockpitIcon size={16} />
    },
    {
      id: 'approvals',
      label: 'Yönetişim & Onaylar',
      icon: <GovernanceIcon size={16} />,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeVariant: 'danger'
    },
    {
      id: 'roi',
      label: 'Karar Defteri & Audit',
      icon: <LedgerIcon size={16} />
    }
  ]

  // Secondary Tools & System Dock
  const utilityItems: NavItemDef[] = [
    { id: 'workflows', label: 'İş Akışları (DAG)', icon: <FlowIcon size={15} /> },
    { id: 'knowledge', label: 'Bilgi Tabanı (RAG)', icon: <KnowledgeIcon size={15} /> },
    { id: 'recurring', label: 'Zamanlanmış Görevler', icon: <RecurringIcon size={15} /> },
    { id: 'integrations', label: 'Entegrasyonlar', icon: <PlugIcon size={15} /> },
    { id: 'settings', label: 'Sistem Ayarları', icon: <SettingsIcon size={15} /> }
  ]

  const todayThreads = chatThreads.filter(t => t.period === 'today')
  const yesterdayThreads = chatThreads.filter(t => t.period === 'yesterday')
  const last7DaysThreads = chatThreads.filter(t => t.period === 'last_7_days')

  return (
    <aside className="atlantic-sidebar">
      {/* Brand & Organization Switcher */}
      <div className="sidebar-brand-header">
        <button
          type="button"
          className="company-switcher-btn"
          onClick={onOpenCompanyWorkspace}
          title="Şirket Değiştir / Ayarla"
        >
          <div className="brand-logo-mark">
            <span className="brand-logo-glyph">◈</span>
          </div>
          <div className="brand-name-wrap">
            <span className="brand-name">{companyName}</span>
            <span className="brand-badge-tier">ENTERPRISE</span>
          </div>
        </button>

        <button
          type="button"
          className={`sidebar-bell-btn ${pendingApprovalsCount > 0 ? 'has-notifications' : ''}`}
          title="Bekleyen Onaylar ve Bildirimler"
          onClick={() => onSelectView('approvals')}
        >
          <BellIcon size={16} />
          {pendingApprovalsCount > 0 && (
            <span className="bell-badge-pulse">{pendingApprovalsCount}</span>
          )}
        </button>
      </div>

      {/* Main Navigation - 4 Executive Hubs */}
      <div className="sidebar-section-container">
        <div className="sidebar-section-title">YÖNETİM KOKPİTİ</div>
        <nav className="sidebar-nav-section">
          {executiveHubs.map(item => {
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectView(item.id)}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`nav-item-badge ${item.badgeVariant || ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Secondary Tools */}
      <div className="sidebar-section-container" style={{ marginTop: '12px' }}>
        <div className="sidebar-section-title">SİSTEM ALTYAPISI</div>
        <nav className="sidebar-nav-section compact">
          {utilityItems.map(item => {
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item sub-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectView(item.id)}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="nav-item-badge">{item.badge}</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* CHATS Section */}
      <div className="sidebar-chats-section">
        <div className="chats-section-header">
          <span className="chats-header-title">GÖREV VE OTURUMLAR</span>
          {chatThreads.length > 0 && onClearAllThreads && (
            <button
              type="button"
              className="chats-clear-all-btn"
              title="Tüm Oturumları Temizle"
              onClick={onClearAllThreads}
            >
              Temizle
            </button>
          )}
        </div>

        <button
          type="button"
          className="new-chat-btn"
          onClick={onNewChat}
        >
          <PlusIcon size={14} />
          <span>Yeni Görev Başlat</span>
        </button>

        <div className="chats-scroll-list">
          {/* TODAY */}
          {todayThreads.length > 0 && (
            <div className="chat-time-group">
              <span className="chat-time-label">BUGÜN</span>
              {todayThreads.map(thread => (
                <div
                  key={thread.id}
                  className={`chat-thread-item ${activeThreadId === thread.id ? 'active' : ''}`}
                  onClick={() => onSelectThread(thread)}
                  title={thread.title}
                >
                  <div className="chat-thread-main">
                    <span className="chat-thread-bullet"></span>
                    <span className="chat-thread-title">{thread.title}</span>
                  </div>
                  {onDeleteThread && (
                    <button
                      type="button"
                      className="chat-thread-delete-btn"
                      title="Oturumu Sil"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteThread(thread.id, e)
                      }}
                    >
                      <TrashIcon size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* YESTERDAY */}
          {yesterdayThreads.length > 0 && (
            <div className="chat-time-group">
              <span className="chat-time-label">DÜN</span>
              {yesterdayThreads.map(thread => (
                <div
                  key={thread.id}
                  className={`chat-thread-item ${activeThreadId === thread.id ? 'active' : ''}`}
                  onClick={() => onSelectThread(thread)}
                  title={thread.title}
                >
                  <div className="chat-thread-main">
                    <span className="chat-thread-bullet"></span>
                    <span className="chat-thread-title">{thread.title}</span>
                  </div>
                  {onDeleteThread && (
                    <button
                      type="button"
                      className="chat-thread-delete-btn"
                      title="Oturumu Sil"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteThread(thread.id, e)
                      }}
                    >
                      <TrashIcon size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* LAST 7 DAYS */}
          {last7DaysThreads.length > 0 && (
            <div className="chat-time-group">
              <span className="chat-time-label">SON 7 GÜN</span>
              {last7DaysThreads.map(thread => (
                <div
                  key={thread.id}
                  className={`chat-thread-item ${activeThreadId === thread.id ? 'active' : ''}`}
                  onClick={() => onSelectThread(thread)}
                  title={thread.title}
                >
                  <div className="chat-thread-main">
                    <span className="chat-thread-bullet"></span>
                    <span className="chat-thread-title">{thread.title}</span>
                  </div>
                  {onDeleteThread && (
                    <button
                      type="button"
                      className="chat-thread-delete-btn"
                      title="Oturumu Sil"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteThread(thread.id, e)
                      }}
                    >
                      <TrashIcon size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="sidebar-user-footer">
        <div className="user-avatar-circle">
          <span>{userName.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="user-info-text">
          <span className="user-name-label">{userName}</span>
          <span className="user-role-label">{userRole}</span>
        </div>
        <button
          type="button"
          className="user-settings-trigger"
          onClick={() => onSelectView('settings')}
          title="Ayarlar"
        >
          <SettingsIcon size={15} />
        </button>
      </div>
    </aside>
  )
}

