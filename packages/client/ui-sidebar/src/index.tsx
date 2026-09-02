import React, { useState, useMemo } from 'react'
import { Button, IconPlus, IconTrash, IconDatabase, IconSparkles } from '@custom-harness/client-ui-primitives'


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
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'
  onSelectSandboxMode?: (mode: 'read-only' | 'workspace-write' | 'danger-full-access') => void
  onOpenSettings?: () => void
  onOpenWorkspace?: () => void
  onOpenSkills?: () => void
  onOpenRag?: () => void
  isRagActive?: boolean
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
  sandboxMode = 'workspace-write',
  onSelectSandboxMode,
  onOpenSettings,
  onOpenWorkspace,
  onOpenSkills,
  onOpenRag,
  isRagActive = false,
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
      {/* 1. Header, Quick Hub Nav & New Chat Button */}
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="logo-icon-glow">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="artificax-icon-img" 
            />
          </div>
          <div className="brand-info">
            <div className="brand-title">ArtificaX</div>
            <div className="brand-sub">Enterprise GPT</div>
          </div>
        </div>

        {/* Quick Hub Navigation (Bilgi Tabanı & Yetenekler) */}
        {(onOpenRag || onOpenSkills) && (
          <div className="sidebar-hub-nav" style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '12px 0 10px 0', width: '100%' }}>
            {onOpenRag && (
              <button
                className="btn-sidebar-hub-item"
                onClick={onOpenRag}
                title="Kurumsal Bilgi Tabanı & pgvector Vektör Bellek"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '9px 12px',
                  background: isRagActive 
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.16) 0%, rgba(37, 99, 235, 0.08) 100%)' 
                    : 'rgba(255, 255, 255, 0.035)',
                  border: isRagActive 
                    ? '1px solid rgba(59, 130, 246, 0.35)' 
                    : '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '10px',
                  color: isRagActive ? '#60a5fa' : 'var(--text-primary, #f1f5f9)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: isRagActive ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '7px',
                    background: isRagActive ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isRagActive ? '#60a5fa' : '#94a3b8'
                  }}>
                    <IconDatabase size={15} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em' }}>Bilgi Tabanı</span>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: isRagActive ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: isRagActive ? '#93c5fd' : '#64748b',
                  letterSpacing: '0.02em'
                }}>
                  {isRagActive ? 'AKTİF' : 'RAG'}
                </span>
              </button>
            )}

            {onOpenSkills && (
              <button
                className="btn-sidebar-hub-item"
                onClick={onOpenSkills}
                title="Uzmanlık Becerileri ve API Modülleri"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '9px 12px',
                  background: 'rgba(255, 255, 255, 0.035)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '10px',
                  color: 'var(--text-primary, #f1f5f9)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '7px',
                    background: 'rgba(168, 85, 247, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c084fc'
                  }}>
                    <IconSparkles size={15} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em' }}>Yetenekler</span>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: 'rgba(168, 85, 247, 0.12)',
                  color: '#c084fc',
                  letterSpacing: '0.02em'
                }}>
                  Skills
                </span>
              </button>
            )}
          </div>
        )}


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

      {/* 4. Bottom Workspace Bar & Actions */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
          {workspace && onOpenWorkspace && (
            <div className="workspace-footer-pill" onClick={onOpenWorkspace} title={`Çalışma Alanı: ${workspace}`}>
              <span className="ws-dot">📁</span>
              <span className="ws-text">{folderName}</span>
            </div>
          )}

          {onSelectSandboxMode && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
                <span>{sandboxMode === 'workspace-write' ? '🛡️' : sandboxMode === 'read-only' ? '🔒' : '⚠️'}</span>
                <span>Sandbox:</span>
              </div>
              <select
                value={sandboxMode}
                onChange={(e) => onSelectSandboxMode(e.target.value as any)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  color: sandboxMode === 'workspace-write' ? '#10b981' : sandboxMode === 'read-only' ? '#60a5fa' : '#f87171',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="workspace-write">🛡️ Workspace Write</option>
                <option value="read-only">🔒 Read Only</option>
                <option value="danger-full-access">⚠️ Full Access</option>
              </select>
            </div>
          )}
        </div>

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
