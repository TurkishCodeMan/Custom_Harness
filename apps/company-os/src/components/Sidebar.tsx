import React from 'react'
import type { NavView, ChatThread } from '../types.js'
import {
  CommandCenterIcon,
  CasesIcon,
  GovernanceIcon,
  LedgerIcon,
  KnowledgeIcon,
  RecurringIcon,
  PlugIcon,
  SettingsIcon,
  BellIcon,
  PlusIcon,
  TrashIcon,
  FlowIcon,
  SparklesIcon,
  InspectorIcon,
  PositionsIcon,
  GraphIcon,
  OrganizationIcon
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

interface NavGroup {
  label: string
  items: NavItemDef[]
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
  const isAdmin = !userRole ||
    userRole.toLowerCase().includes('yönetici') ||
    userRole.toLowerCase().includes('admin') ||
    userRole.toLowerCase().includes('executive')

  const navGroups: NavGroup[] = [
    {
      label: 'OPERATE',
      items: [
        {
          id: 'assistant',
          label: 'Command Center',
          icon: <CommandCenterIcon size={15} />
        },
        {
          id: 'cases',
          label: 'Cases & Runs',
          icon: <CasesIcon size={15} />
        },
        {
          id: 'approvals',
          label: 'Approvals',
          icon: <GovernanceIcon size={15} />,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
          badgeVariant: 'danger'
        }
      ]
    },
    {
      label: 'ORGANIZATION',
      items: [
        {
          id: 'positions',
          label: 'Positions',
          icon: <PositionsIcon size={15} />
        },
        {
          id: 'org-graph',
          label: 'Organization Graph',
          icon: <GraphIcon size={15} />
        },
        {
          id: 'workflows',
          label: 'Workflows & DAG',
          icon: <FlowIcon size={15} />
        }
      ]
    },
    {
      label: 'KNOWLEDGE & CAPABILITIES',
      items: [
        { id: 'knowledge', label: 'Knowledge', icon: <KnowledgeIcon size={15} /> },
        { id: 'skills', label: 'Skills', icon: <SparklesIcon size={15} /> },
        { id: 'integrations', label: 'Integrations', icon: <PlugIcon size={15} /> },
        { id: 'recurring', label: 'Scheduled Jobs', icon: <RecurringIcon size={15} /> }
      ]
    },
    {
      label: 'GOVERNANCE',
      items: [
        { id: 'roi', label: 'Decision Ledger', icon: <LedgerIcon size={15} /> },
        ...(isAdmin ? [{
          id: 'inspector' as NavView,
          label: 'Agent Debug',
          icon: <InspectorIcon size={15} />,
          badge: 'DEV',
          badgeVariant: 'warning' as const
        }] : []),
        { id: 'settings', label: 'System Settings', icon: <SettingsIcon size={15} /> }
      ]
    }
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

      {/* 4-Group Navigation */}
      <div className="sidebar-nav-groups">
        {navGroups.map(group => (
          <div key={group.label} className="sidebar-section-container">
            <div className="sidebar-section-title">{group.label}</div>
            <nav className="sidebar-nav-section">
              {group.items.map(item => {
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
        ))}
      </div>

      {/* Chat Thread History */}
      <div className="sidebar-chats-section">
        <div className="chats-section-header">
          <span className="chats-header-title">CONVERSATIONS</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              type="button"
              className="chats-clear-all-btn"
              title="Yeni Sohbet Başlat"
              onClick={onNewChat}
              style={{ padding: '2px 4px', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
            >
              <PlusIcon size={12} />
            </button>
            {chatThreads.length > 0 && onClearAllThreads && (
              <button
                type="button"
                className="chats-clear-all-btn"
                title="Tüm Konuşmaları Sil"
                onClick={onClearAllThreads}
                style={{ padding: '2px 4px' }}
              >
                <TrashIcon size={11} />
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className="new-chat-btn"
          onClick={onNewChat}
        >
          <PlusIcon size={13} />
          <span>Yeni Görev Başlat</span>
        </button>

        <div className="chats-scroll-list">
          {todayThreads.length > 0 && (
            <div className="chat-time-group">
              <span className="chat-time-label">BUGÜN</span>
              {todayThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onSelect={() => onSelectThread(thread)}
                  onDelete={onDeleteThread ? (e) => onDeleteThread(thread.id, e) : undefined}
                />
              ))}
            </div>
          )}

          {yesterdayThreads.length > 0 && (
            <div className="chat-time-group">
              <span className="chat-time-label">DÜN</span>
              {yesterdayThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onSelect={() => onSelectThread(thread)}
                  onDelete={onDeleteThread ? (e) => onDeleteThread(thread.id, e) : undefined}
                />
              ))}
            </div>
          )}

          {last7DaysThreads.length > 0 && (
            <div className="chat-time-group">
              <span className="chat-time-label">SON 7 GÜN</span>
              {last7DaysThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onSelect={() => onSelectThread(thread)}
                  onDelete={onDeleteThread ? (e) => onDeleteThread(thread.id, e) : undefined}
                />
              ))}
            </div>
          )}

          {chatThreads.length === 0 && (
            <div style={{ padding: '16px 8px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              Henüz konuşma geçmişi yok
            </div>
          )}
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="sidebar-user-footer">
        <div className="user-avatar-circle">{userName.charAt(0)}</div>
        <div className="user-info-text">
          <span className="user-name-label">{userName}</span>
          <span className="user-role-label">{userRole}</span>
        </div>
      </div>
    </aside>
  )
}

// ─── Thread List Item ──────────────────────────────────────────────────────────
interface ThreadItemProps {
  thread: ChatThread
  isActive: boolean
  onSelect: () => void
  onDelete?: (e: React.MouseEvent) => void
}

const ThreadItem: React.FC<ThreadItemProps> = ({ thread, isActive, onSelect, onDelete }) => (
  <div
    className={`chat-thread-item ${isActive ? 'active' : ''}`}
    onClick={onSelect}
    title={thread.title}
  >
    <div className="chat-thread-main">
      <span className="chat-thread-bullet" />
      <span className="chat-thread-title">{thread.title}</span>
    </div>
    {onDelete && (
      <button
        type="button"
        className="chat-thread-delete-btn"
        title="Oturumu Sil"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(e)
        }}
      >
        <TrashIcon size={12} />
      </button>
    )}
  </div>
)
