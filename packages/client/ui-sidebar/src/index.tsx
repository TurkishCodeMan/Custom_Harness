import React from 'react'
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
  version?: string
}

export function SidebarRoot({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  version = 'v0.1.0'
}: SidebarRootProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="logo-icon">⚡</div>
          <div className="brand-info">
            <div className="brand-title">Custom Harness</div>
            <div className="brand-sub">Autonomous AI Agent</div>
          </div>
        </div>
        <Button variant="primary" size="md" onClick={onNewSession} className="btn-new-chat">
          <IconPlus size={16} />
          <span>Yeni Sohbet</span>
        </Button>
      </div>

      <div className="sidebar-sessions-container">
        <div className="sessions-header">
          <span className="sessions-label">GEÇMİŞ SOHBETLER</span>
          <span className="sessions-count">{sessions.length}</span>
        </div>

        <div className="session-list">
          {sessions.length === 0 ? (
            <div className="empty-sessions">
              <span className="empty-icon">💬</span>
              <span>Henüz sohbet yok</span>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={() => onSelectSession(session.id)}
                onDelete={(e) => onDeleteSession(session.id, e)}
              />
            ))
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="version-tag">DeepSeek Harness Arch · {version}</div>
      </div>
    </aside>
  )
}

export interface SessionItemProps {
  session: SessionInfo
  isActive: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
}

export function SessionItem({ session, isActive, onSelect, onDelete }: SessionItemProps) {
  const timeStr = session.updatedAt
    ? new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className={`session-item ${isActive ? 'active' : ''}`} onClick={onSelect}>
      <span className="session-icon">💬</span>
      <div className="session-content">
        <div className="session-title">{session.title || 'Yeni Sohbet'}</div>
        {timeStr && <div className="session-time">{timeStr}</div>}
      </div>
      <button
        className="btn-delete-session"
        title="Sohbeti Sil"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(e)
        }}
      >
        <IconTrash size={14} />
      </button>
    </div>
  )
}
