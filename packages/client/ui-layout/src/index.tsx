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
  onOpenSettings: () => void
  onOpenWorkspace?: () => void
  onOpenRag?: () => void
  onOpenSkills?: () => void
  isRagActive?: boolean
  isConnected: boolean
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function Header({
  workspace,
  activeModelName = 'Gemma 4 (27B)',
  activePresetName = 'Full-Stack Developer',
  availableModels = ['gemma-4-abliterated', 'Qwen3.8-27B', 'DeepSeek-V3', 'Claude-3.5-Sonnet'],
  onSelectModel,
  availablePresets = ['Full-Stack Developer', 'Architect & Planner', 'Bug Hunter & QA', 'Code Reviewer'],
  onSelectPreset,
  onOpenSettings,
  onOpenWorkspace,
  onOpenRag,
  onOpenSkills,
  isRagActive = false,
  isConnected,
  isSidebarOpen = true,
  onToggleSidebar
}: HeaderProps) {
  const folderName = workspace ? (workspace.split('/').filter(Boolean).pop() || workspace) : 'Workspace'
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const presetMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false)
      }
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setIsPresetDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

      {/* Right: Workspace, RAG, Skills, Status & Settings */}
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
