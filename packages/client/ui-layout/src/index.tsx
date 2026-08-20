import React, { useState, useEffect, useRef } from 'react'
import { Button, IconSettings, Badge, Modal } from '@custom-harness/client-ui-primitives'

export type ReactNode = any

export interface AppFrameProps {
  sidebar: any
  header: any
  children: any
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function AppFrame({
  sidebar,
  header,
  children,
  isSidebarOpen = true
}: AppFrameProps) {
  return (
    <div className={`app-layout ${isSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      {sidebar}
      <div className="main-content">
        {header}
        <div className="content-viewport">{children}</div>
      </div>
    </div>
  )
}

export interface HeaderProps {
  workspace: string
  activeModelName?: string
  activePresetName?: string
  availableModels?: string[]
  onSelectModel?: (model: string) => void
  availablePresets?: string[]
  onSelectPreset?: (preset: string) => void
  currentUser?: any
  users?: any[]
  onSwitchUser?: (userId: string) => void
  onOpenAdmin?: () => void
  onOpenAuth?: () => void
  onLogout?: () => void
  onOpenSettings: () => void
  onOpenWorkspace?: () => void
  onOpenRag?: () => void
  onOpenSkills?: () => void
  isRagActive?: boolean
  isConnected: boolean
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'
  onSelectSandboxMode?: (mode: 'read-only' | 'workspace-write' | 'danger-full-access') => void
}

export function Header({
  workspace,
  activeModelName = 'Gemma 4 (27B)',
  activePresetName = 'Full-Stack Developer',
  availableModels = ['gemma-4-abliterated', 'Qwen3.8-27B', 'DeepSeek-V3', 'Claude-3.5-Sonnet'],
  onSelectModel,
  availablePresets = ['Full-Stack Developer', 'Architect & Planner', 'Bug Hunter & QA', 'Code Reviewer'],
  onSelectPreset,
  currentUser,
  users = [],
  onSwitchUser,
  onOpenAdmin,
  onOpenAuth,
  onLogout,
  onOpenSettings,
  onOpenWorkspace,
  onOpenRag,
  onOpenSkills,
  isRagActive = false,
  isConnected,
  isSidebarOpen = true,
  onToggleSidebar,
  sandboxMode = 'workspace-write',
  onSelectSandboxMode
}: HeaderProps) {
  const folderName = workspace ? (workspace.split('/').filter(Boolean).pop() || workspace) : 'Workspace'
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false)
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [isSandboxDropdownOpen, setIsSandboxDropdownOpen] = useState(false)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const presetMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const sandboxMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false)
      }
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setIsPresetDropdownOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false)
      }
      if (sandboxMenuRef.current && !sandboxMenuRef.current.contains(e.target as Node)) {
        setIsSandboxDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isAdmin = currentUser?.role === 'admin'

  return (
    <header className="app-header">
      {/* Left: Sidebar Toggle & Model Selector */}
      <div className="header-left">
        {onToggleSidebar && (
          <button
            className="btn-sidebar-toggle"
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Kenar Çubuğunu Gizle' : 'Kenar Çubuğunu Göster'}
          >
            <span className="toggle-icon">☰</span>
          </button>
        )}

        {/* Model Selector Dropdown (ChatGPT / OpenWebUI Style) */}
        <div className="header-model-selector" ref={modelMenuRef}>
          <button
            className="btn-model-dropdown"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            title="Aktif Yapay Zeka Modelini Değiştir"
          >
            <span className="model-logo-icon">⚡</span>
            <span className="model-dropdown-name">{activeModelName}</span>
            <span className="dropdown-arrow">{isModelDropdownOpen ? '▴' : '▾'}</span>
          </button>

          {isModelDropdownOpen && (
            <div className="model-dropdown-menu">
              <div className="dropdown-header">Modeller & Sağlayıcılar</div>
              {availableModels.map(m => (
                <div
                  key={m}
                  className={`model-menu-item ${m === activeModelName ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectModel?.(m)
                    setIsModelDropdownOpen(false)
                  }}
                >
                  <span className="model-item-icon">⚡</span>
                  <div className="model-item-details">
                    <span className="model-item-title">{m}</span>
                    <span className="model-item-sub">Yerel & Yüksek Performans</span>
                  </div>
                  {m === activeModelName && <span className="item-check">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Persona / Preset Dropdown */}
        <div className="header-preset-selector" ref={presetMenuRef}>
          <button
            className="btn-preset-dropdown"
            onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
            title="Ajan Rolünü / Uzmanlığını Değiştir"
          >
            <span className="preset-icon">👤</span>
            <span className="preset-name">{activePresetName}</span>
            <span className="dropdown-arrow">{isPresetDropdownOpen ? '▴' : '▾'}</span>
          </button>

          {isPresetDropdownOpen && (
            <div className="model-dropdown-menu">
              <div className="dropdown-header">Ajan Uzmanlık Rolleri</div>
              {availablePresets.map(p => (
                <div
                  key={p}
                  className={`model-menu-item ${p === activePresetName ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectPreset?.(p)
                    setIsPresetDropdownOpen(false)
                  }}
                >
                  <span className="model-item-icon">🎯</span>
                  <div className="model-item-details">
                    <span className="model-item-title">{p}</span>
                  </div>
                  {p === activePresetName && <span className="item-check">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Workspace, Sandbox Mode, RAG, Skills, Admin Panel, User Profile & Settings */}
      <div className="header-right">
        {workspace && (
          <div
            className="workspace-badge"
            title={`Çalışma Alanı: ${workspace}`}
            onClick={onOpenWorkspace}
          >
            <span className="ws-icon">📂</span>
            <span className="ws-name">{folderName}</span>
          </div>
        )}

        {/* Sandbox Mode Dropdown */}
        {onSelectSandboxMode && (
          <div className="header-sandbox-selector" ref={sandboxMenuRef} style={{ position: 'relative' }}>
            <button
              className={`workspace-badge sandbox-badge-btn`}
              onClick={() => setIsSandboxDropdownOpen(!isSandboxDropdownOpen)}
              title="Sandbox İzolasyon Modunu Değiştir (DeepSeek Standardı)"
              style={{
                background: sandboxMode === 'workspace-write' 
                  ? 'rgba(16, 185, 129, 0.15)' 
                  : sandboxMode === 'read-only' 
                    ? 'rgba(59, 130, 246, 0.15)' 
                    : 'rgba(239, 68, 68, 0.18)',
                borderColor: sandboxMode === 'workspace-write' 
                  ? 'rgba(16, 185, 129, 0.3)' 
                  : sandboxMode === 'read-only' 
                    ? 'rgba(59, 130, 246, 0.3)' 
                    : 'rgba(239, 68, 68, 0.35)',
                color: sandboxMode === 'workspace-write' 
                  ? '#10b981' 
                  : sandboxMode === 'read-only' 
                    ? '#60a5fa' 
                    : '#f87171',
                cursor: 'pointer'
              }}
            >
              <span className="ws-icon">{sandboxMode === 'workspace-write' ? '🛡️' : sandboxMode === 'read-only' ? '🔒' : '⚠️'}</span>
              <span className="ws-name" style={{ fontWeight: 600 }}>
                {sandboxMode === 'workspace-write' ? 'Workspace' : sandboxMode === 'read-only' ? 'Read-Only' : 'Full Access'}
              </span>
              <span style={{ fontSize: '10px', marginLeft: '2px', opacity: 0.7 }}>{isSandboxDropdownOpen ? '▴' : '▾'}</span>
            </button>

            {isSandboxDropdownOpen && (
              <div
                className="model-dropdown-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  minWidth: '230px',
                  zIndex: 1000
                }}
              >
                <div className="dropdown-header">Sandbox İzolasyon Modu</div>
                <div
                  className={`model-menu-item ${sandboxMode === 'workspace-write' ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectSandboxMode('workspace-write')
                    setIsSandboxDropdownOpen(false)
                  }}
                >
                  <span className="model-item-icon">🛡️</span>
                  <div className="model-item-details">
                    <span className="model-item-title" style={{ color: '#10b981' }}>Workspace Write</span>
                    <span className="model-item-sub">Yalnızca workspace yazılabilir (Önerilen)</span>
                  </div>
                  {sandboxMode === 'workspace-write' && <span className="item-check">✓</span>}
                </div>

                <div
                  className={`model-menu-item ${sandboxMode === 'read-only' ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectSandboxMode('read-only')
                    setIsSandboxDropdownOpen(false)
                  }}
                >
                  <span className="model-item-icon">🔒</span>
                  <div className="model-item-details">
                    <span className="model-item-title" style={{ color: '#60a5fa' }}>Read Only</span>
                    <span className="model-item-sub">Tüm sistem ve workspace salt-okunur</span>
                  </div>
                  {sandboxMode === 'read-only' && <span className="item-check">✓</span>}
                </div>

                <div
                  className={`model-menu-item ${sandboxMode === 'danger-full-access' ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectSandboxMode('danger-full-access')
                    setIsSandboxDropdownOpen(false)
                  }}
                >
                  <span className="model-item-icon">⚠️</span>
                  <div className="model-item-details">
                    <span className="model-item-title" style={{ color: '#f87171' }}>Full Access</span>
                    <span className="model-item-sub">Korumasız host modu (Tüm yetkiler)</span>
                  </div>
                  {sandboxMode === 'danger-full-access' && <span className="item-check">✓</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {onOpenSkills && (
          <button
            className="btn-header-action"
            onClick={onOpenSkills}
            title="Uzmanlık Becerileri (Skills)"
          >
            <span className="action-icon">✨</span>
            <span className="action-label">Beceriler</span>
          </button>
        )}

        {onOpenRag && (
          <button
            className={`btn-header-action ${isRagActive ? 'rag-active' : ''}`}
            onClick={onOpenRag}
            title="RAG Bilgi Tabanı & Vektör Bellek"
          >
            <span className="action-icon">🧠</span>
            <span className="action-label">RAG</span>
            {isRagActive && <span className="action-dot" />}
          </button>
        )}

        {/* Admin Panel Button (Visible Only for Admin Role) */}
        {isAdmin && onOpenAdmin && (
          <button
            className="btn-header-action admin-badge-btn"
            onClick={onOpenAdmin}
            title="Yönetici Paneli (Multi-Tenancy & RBAC)"
          >
            <span className="action-icon">🛡️</span>
            <span className="action-label">Yönetici Paneli</span>
            <span className="admin-pill-tag">ADMIN</span>
          </button>
        )}

        {/* User Profile / Switcher Dropdown */}
        <div className="header-user-selector" ref={userMenuRef}>
          <button
            className={`btn-user-dropdown ${isAdmin ? 'is-admin' : ''}`}
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            title={`Aktif Kullanıcı: ${currentUser?.name || currentUser?.username || 'admin'}`}
          >
            <span className="user-avatar-icon">{currentUser?.avatar || (isAdmin ? '🛡️' : '👤')}</span>
            <span className="user-dropdown-name">{currentUser?.name || currentUser?.username || 'admin'}</span>
            <span className="user-role-tag">{isAdmin ? 'Admin' : 'User'}</span>
            <span className="dropdown-arrow">{isUserDropdownOpen ? '▴' : '▾'}</span>
          </button>

          {isUserDropdownOpen && (
            <div className="user-dropdown-menu">
              <div className="dropdown-header">Aktif Kullanıcı & Kiracı</div>
              <div className="current-user-info-card">
                <span className="card-avatar">{currentUser?.avatar || (isAdmin ? '🛡️' : '👤')}</span>
                <div className="card-details">
                  <strong>{currentUser?.name || 'Sistem Yöneticisi'}</strong>
                  <span className="card-sub">@{currentUser?.username || 'admin'} · {isAdmin ? 'Yönetici' : 'Kullanıcı'}</span>
                </div>
              </div>

              {users.length > 1 && (
                <>
                  <div className="dropdown-divider" />
                  <div className="dropdown-section-title">Kullanıcı Değiştir (Multi-Tenancy)</div>
                  {users.map((u: any) => (
                    <div
                      key={u.id}
                      className={`user-menu-item ${u.id === currentUser?.id ? 'selected' : ''}`}
                      onClick={() => {
                        onSwitchUser?.(u.id)
                        setIsUserDropdownOpen(false)
                      }}
                    >
                      <span className="user-item-avatar">{u.avatar || '👤'}</span>
                      <div className="user-item-details">
                        <span className="user-item-name">{u.name}</span>
                        <span className="user-item-role">{u.role === 'admin' ? '🛡️ Yönetici' : '👤 Kullanıcı'}</span>
                      </div>
                      {u.id === currentUser?.id && <span className="item-check">✓</span>}
                    </div>
                  ))}
                </>
              )}

              {isAdmin && onOpenAdmin && (
                <>
                  <div className="dropdown-divider" />
                  <button
                    className="btn-dropdown-admin-link"
                    onClick={() => {
                      onOpenAdmin()
                      setIsUserDropdownOpen(false)
                    }}
                  >
                    <span>🛡️ Yönetici Paneline Git</span>
                  </button>
                </>
              )}

              <div className="dropdown-divider" />
              <div className="user-dropdown-actions">
                {onOpenAuth && (
                  <button
                    className="btn-user-action-link"
                    onClick={() => {
                      onOpenAuth()
                      setIsUserDropdownOpen(false)
                    }}
                  >
                    <span>🔐 Giriş / Kayıt Ol</span>
                  </button>
                )}
                {onLogout && (
                  <button
                    className="btn-user-action-link danger"
                    onClick={() => {
                      onLogout()
                      setIsUserDropdownOpen(false)
                    }}
                  >
                    <span>🚪 Çıkış Yap</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="connection-status" title={isConnected ? 'Sunucuya Bağlı' : 'Bağlantı Kesildi'}>
          <span className={`status-pulse ${isConnected ? 'online' : 'offline'}`} />
          <span className="status-label">{isConnected ? 'Online' : 'Offline'}</span>
        </div>

        <button className="btn-header-settings" onClick={onOpenSettings} title="Sistem Ayarları">
          <IconSettings size={17} />
        </button>
      </div>
    </header>
  )
}

export interface WorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  currentWorkspace: string
  onSelectWorkspace: (newPath: string) => Promise<void>
}

export function WorkspaceModal({
  isOpen,
  onClose,
  currentWorkspace,
  onSelectWorkspace
}: WorkspaceModalProps) {
  const [currentPath, setCurrentPath] = useState(currentWorkspace || '')
  const [parentPath, setParentPath] = useState('')
  const [directories, setDirectories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [inputPath, setInputPath] = useState(currentWorkspace || '')

  const browse = async (target: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/workspace/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: target })
      })
      const data = await res.json()
      if (data.current) {
        setCurrentPath(data.current)
        setInputPath(data.current)
        setParentPath(data.parent || '')
        setDirectories(data.directories || [])
      }
    } catch (e) {
      console.error('[Browse Workspace Error]:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      browse(currentWorkspace || '')
    }
  }, [isOpen, currentWorkspace])

  if (!isOpen) return null

  const handleApply = async () => {
    await onSelectWorkspace(inputPath.trim())
    onClose()
  }

  const navigateTo = (dirName: string) => {
    const next = currentPath === '/' ? `/${dirName}` : `${currentPath}/${dirName}`
    browse(next)
  }

  const navigateToParent = () => {
    if (parentPath && parentPath !== currentPath) {
      browse(parentPath)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="modal-title-with-icon">
          <span>📂</span>
          <span>Çalışma Alanını Değiştir (Workspace)</span>
        </div>
      }
      maxWidth="680px"
      footer={
        <div className="settings-footer-actions">
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Bu Dizini Seç ve Uygula
          </Button>
        </div>
      }
    >
      <div className="workspace-modal-body">
        <div className="form-group">
          <label className="form-label">Seçili Çalışma Alanı Dizini</label>
          <div className="workspace-path-bar">
            <input
              type="text"
              className="form-input ws-input"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  browse(inputPath)
                }
              }}
              placeholder="/home/user/project"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => browse(inputPath)}
              title="Dizine Git"
            >
              Git ↵
            </Button>
          </div>
        </div>

        <div className="ws-shortcuts-bar">
          <span className="ws-shortcut-label">Hızlı Erişim:</span>
          <button
            type="button"
            className="ws-shortcut-chip"
            onClick={() => browse('/home/huseyina')}
          >
            🏠 Home
          </button>
          <button
            type="button"
            className="ws-shortcut-chip"
            onClick={() => browse('/home/huseyina/code_mode')}
          >
            ⚡ code_mode
          </button>
          <button
            type="button"
            className="ws-shortcut-chip"
            onClick={() => browse('/home/huseyina/code_mode/custom-harness')}
          >
            📦 custom-harness
          </button>
          <button
            type="button"
            className="ws-shortcut-chip"
            onClick={() => browse('/home/huseyina/code_mode/TEST_WORKSPACE')}
          >
            🧪 TEST_WORKSPACE
          </button>
        </div>

        <div className="ws-browser-section">
          <div className="ws-browser-header">
            <span>Dizin Gezgini</span>
            {isLoading && <span className="ws-loading-hint">Yükleniyor...</span>}
          </div>

          <div className="ws-dir-list">
            {parentPath && parentPath !== currentPath && (
              <div className="ws-dir-item parent-dir" onClick={navigateToParent}>
                <span className="ws-dir-icon">📁</span>
                <span className="ws-dir-name">.. (Üst Dizine Çık)</span>
              </div>
            )}

            {directories.map((dir) => (
              <div
                key={dir}
                className="ws-dir-item"
                onClick={() => navigateTo(dir)}
              >
                <span className="ws-dir-icon">📂</span>
                <span className="ws-dir-name">{dir}</span>
                <span className="ws-dir-action">Aç →</span>
              </div>
            ))}

            {directories.length === 0 && !isLoading && (
              <div className="ws-empty-hint">Bu dizinde alt klasör bulunamadı.</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
