import React, { useState, useMemo } from 'react'
import { Button, IconPlus, IconTrash } from '@custom-harness/client-ui-primitives'

export interface SessionInfo {
  id: string
  title: string
  updatedAt: number
  workspace?: string
}

export interface SidebarRootProps {
  sessions: SessionInfo[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteSession: (id: string, e: React.MouseEvent) => void
  onRenameSession?: (id: string, newTitle: string) => void
  onClearAllSessions?: () => void
  activeModelName?: string
  workspace?: string
  onOpenSettings?: () => void
  onOpenWorkspace?: () => void
  version?: string
}

interface GroupedSessions {
  today: SessionInfo[]
  yesterday: SessionInfo[]
  lastWeek: SessionInfo[]
  older: SessionInfo[]
}

export function SidebarRoot({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onClearAllSessions,
  activeModelName = 'Gemma 4 (27B)',
  workspace,
  onOpenSettings,
  onOpenWorkspace,
  version = 'v1.0.0'
}: SidebarRootProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter & group sessions by time periods (ChatGPT / OpenWebUI style)
  const grouped = useMemo(() => {
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    const filtered = sessions.filter(s =>
      (s.title || 'Yeni Sohbet').toLowerCase().includes(searchQuery.toLowerCase())
    )

    const groups: GroupedSessions = {
      today: [],
      yesterday: [],
      lastWeek: [],
      older: []
    }

    filtered.forEach(session => {
      const time = session.updatedAt || now
      const diff = now - time

      if (diff < oneDay) {
        groups.today.push(session)
      } else if (diff < 2 * oneDay) {
        groups.yesterday.push(session)
      } else if (diff < 7 * oneDay) {
        groups.lastWeek.push(session)
      } else {
        groups.older.push(session)
      }
    })

    return groups
  }, [sessions, searchQuery])

  const folderName = workspace ? (workspace.split('/').filter(Boolean).pop() || workspace) : 'Workspace'

  return (
    <aside className="sidebar">
      {/* 1. Header & New Chat Button */}
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="logo-icon-glow">
            <span className="logo-symbol">⚡</span>
          </div>
          <div className="brand-info">
            <div className="brand-title">ArtificaX</div>
            <div className="brand-sub">Enterprise GPT</div>
          </div>
        </div>

        <button className="btn-chatgpt-new" onClick={onNewSession} title="Yeni Sohbet Başlat (Ctrl+K)">
          <IconPlus size={16} />
          <span>Yeni Sohbet</span>
        </button>
      </div>

      {/* 2. Real-time Search Bar */}
      <div className="sidebar-search-box">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Sohbetlerde ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="btn-clear-search" onClick={() => setSearchQuery('')}>✕</button>
        )}
      </div>

      {/* 3. Grouped Session List */}
      <div className="sidebar-sessions-container">
        {sessions.length === 0 ? (
          <div className="empty-sessions">
            <span className="empty-icon">💬</span>
            <span className="empty-title">Henüz sohbet yok</span>
            <span className="empty-sub">Yeni bir sohbet başlatarak kodlamaya başlayın.</span>
          </div>
        ) : (
          <>
            {grouped.today.length > 0 && (
              <div className="session-group">
                <div className="group-label">BUGÜN</div>
                {grouped.today.map(s => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s.id)}
                    onDelete={(e) => onDeleteSession(s.id, e)}
                    onRename={onRenameSession}
                  />
                ))}
              </div>
            )}

            {grouped.yesterday.length > 0 && (
              <div className="session-group">
                <div className="group-label">DÜN</div>
                {grouped.yesterday.map(s => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s.id)}
                    onDelete={(e) => onDeleteSession(s.id, e)}
                    onRename={onRenameSession}
                  />
                ))}
              </div>
            )}

            {grouped.lastWeek.length > 0 && (
              <div className="session-group">
                <div className="group-label">ÖNCEKİ 7 GÜN</div>
                {grouped.lastWeek.map(s => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s.id)}
                    onDelete={(e) => onDeleteSession(s.id, e)}
                    onRename={onRenameSession}
                  />
                ))}
              </div>
            )}

            {grouped.older.length > 0 && (
              <div className="session-group">
                <div className="group-label">DAHA ESKİ</div>
                {grouped.older.map(s => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s.id)}
                    onDelete={(e) => onDeleteSession(s.id, e)}
                    onRename={onRenameSession}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. Bottom Profile & Workspace Bar */}
      <div className="sidebar-footer">
        {sessions.length > 0 && onClearAllSessions && (
          <button
            className="btn-clear-all-sessions"
            onClick={() => {
              if (window.confirm('Tüm geçmiş sohbetleri silmek istediğinizden emin misiniz?')) {
                onClearAllSessions()
              }
            }}
            title="Tüm Sohbet Geçmişini Temizle"
          >
            <IconTrash size={12} />
            <span>Tüm Sohbetleri Temizle</span>
          </button>
        )}

        <div className="user-profile-card" onClick={onOpenSettings} title="Ayarları Aç">
          <div className="user-avatar">
            <span>👤</span>
          </div>
          <div className="user-details">
            <div className="user-name">Geliştirici</div>
            <div className="user-model-badge">{activeModelName}</div>
          </div>
          <button className="btn-settings-gear" title="Ayarlar">⚙️</button>
        </div>

        {workspace && onOpenWorkspace && (
          <div className="workspace-footer-pill" onClick={onOpenWorkspace} title={`Çalışma Alanı: ${workspace}`}>
            <span className="ws-dot">📁</span>
            <span className="ws-text">{folderName}</span>
          </div>
        )}
      </div>
    </aside>
  )
}

export interface SessionItemProps {
  session: SessionInfo
  isActive: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  onRename?: (id: string, newTitle: string) => void
}

export function SessionItem({ session, isActive, onSelect, onDelete, onRename }: SessionItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(session.title || 'Yeni Sohbet')

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (editTitle.trim() && onRename) {
      onRename(session.id, editTitle.trim())
    }
    setIsEditing(false)
  }

  return (
    <div
      className={`session-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <span className="session-icon">💬</span>
      <div className="session-content">
        {isEditing ? (
          <form onSubmit={handleSaveRename} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              className="session-edit-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => setIsEditing(false)}
              autoFocus
            />
          </form>
        ) : (
          <div className="session-title" title={session.title || 'Yeni Sohbet'}>
            {session.title || 'Yeni Sohbet'}
          </div>
        )}
      </div>

      <div className="session-hover-actions">
        {onRename && !isEditing && (
          <button
            className="btn-action-icon"
            title="Yeniden Adlandır"
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
          >
            ✏️
          </button>
        )}
        <button
          className="btn-action-icon delete"
          title="Sohbeti Sil"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(e)
          }}
        >
          <IconTrash size={13} />
        </button>
      </div>
    </div>
  )
}
