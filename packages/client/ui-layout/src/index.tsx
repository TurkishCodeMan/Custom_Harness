import React, { ReactNode, useState, useEffect } from 'react'
import { Button, IconSettings, Badge, Modal } from '@custom-harness/client-ui-primitives'

export interface AppFrameProps {
  sidebar: ReactNode
  header: ReactNode
  children: ReactNode
}

export function AppFrame({ sidebar, header, children }: AppFrameProps) {
  return (
    <div className="app-layout">
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
  onOpenSettings: () => void
  onOpenWorkspace?: () => void
  isConnected: boolean
}

export function Header({
  workspace,
  activeModelName = 'Custom LLM',
  activePresetName = 'Full-Stack Developer',
  onOpenSettings,
  onOpenWorkspace,
  isConnected
}: HeaderProps) {
  const folderName = workspace.split('/').filter(Boolean).pop() || workspace || 'Workspace'

  return (
    <header className="app-header">
      <div className="header-left">
        <div
          className="workspace-badge"
          title={`Çalışma alanını değiştirmek için tıklayın: ${workspace}`}
          onClick={onOpenWorkspace}
          style={{ cursor: 'pointer' }}
        >
          <span className="ws-icon">📂</span>
          <span className="ws-name">{folderName}</span>
          <span className="ws-edit-hint">✎</span>
        </div>
        <div className="header-divider" />
        <div className="model-status-pill">
          <span className="model-icon">⚡</span>
          <span className="model-name">{activeModelName}</span>
        </div>
      </div>

      <div className="header-right">
        <Badge variant="purple" icon="👤">
          {activePresetName}
        </Badge>
        <div className="connection-status">
          <span className={`status-pulse ${isConnected ? 'online' : 'offline'}`} />
          <span className="status-label">{isConnected ? 'Bağlandı' : 'Bağlantı Kesildi'}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpenSettings} title="Ayarlar">
          <IconSettings size={18} />
        </Button>
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
