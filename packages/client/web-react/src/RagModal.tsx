import React, { useState, useEffect } from 'react'
import { Button, Modal } from '@custom-harness/client-ui-primitives'

export interface RagModalProps {
  isOpen: boolean
  onClose: () => void
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  currentUser?: any
  users?: any[]
}

export function RagModal({ isOpen, onClose, onShowToast, currentUser, users = [] }: RagModalProps) {
  const [activeTab, setActiveTab] = useState<'sources' | 'config' | 'search'>('sources')
  const [status, setStatus] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [editingPermSourceId, setEditingPermSourceId] = useState<string | null>(null)
  const [permAllowedUsers, setPermAllowedUsers] = useState<string[]>([])
  const [permIsPublic, setPermIsPublic] = useState(true)
  const [isSavingPerms, setIsSavingPerms] = useState(false)
  const [newFolderPath, setNewFolderPath] = useState('/home/huseyina/code_mode')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchMode, setSearchMode] = useState<'text' | 'image'>('text')
  const [isSearching, setIsSearching] = useState(false)

  // Directory Browser State
  const [browsePath, setBrowsePath] = useState('/home/huseyina/code_mode')
  const [parentPath, setParentPath] = useState('')
  const [directories, setDirectories] = useState<string[]>([])
  const [files, setFiles] = useState<string[]>([])
  const [isBrowsing, setIsBrowsing] = useState(false)

  // Indexing Mode & Progress State
  const [indexingMode, setIndexingMode] = useState<'standard' | 'turbo'>('standard')
  const [workerCount, setWorkerCount] = useState(4)
  const [progress, setProgress] = useState<{
    totalFiles: number
    processedFiles: number
    totalChunks: number
    percent: number
    currentFile?: string
    status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
    speedFilesPerSec?: number
    estimatedRemainingSec?: number
  } | null>(null)

  // Config State
  const [config, setConfig] = useState({
    embeddingEndpoint: 'http://localhost:8001/v1',
    embeddingModel: 'Qwen/Qwen3-Embedding-0.6B',
    visionEndpoint: 'http://localhost:8010/v1',
    visionModel: 'zai-org/GLM-OCR',
    visionApiKey: 'sk-agent-key',
    imageSearchEndpoint: 'http://localhost:8011',
    workerConcurrency: 4,
    indexingMode: 'standard',
    batchSize: 32,
    bulkInsertSize: 50,
    throttleDelayMs: 0,
    chunkSize: 1000,
    chunkOverlap: 150
  })

  const getAuthHeaders = () => {
    const token = localStorage.getItem('artificax_jwt_token')
    const userId = localStorage.getItem('artificax_user_id')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (userId) headers['X-User-Id'] = userId
    return headers
  }

  const browse = async (target: string) => {
    setIsBrowsing(true)
    try {
      const res = await fetch('/api/workspace/browse', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ path: target })
      })
      const data = await res.json()
      if (data.current) {
        setBrowsePath(data.current)
        setNewFolderPath(data.current)
        setParentPath(data.parent || '')
        setDirectories(data.directories || [])
        setFiles(data.files || [])
      }
    } catch (e) {
      console.error('[Browse Error]:', e)
    } finally {
      setIsBrowsing(false)
    }
  }

  const loadStatus = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/rag/status', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data) {
        setStatus(data)
        if (data.progress) {
          setProgress(data.progress)
        }
        if (data.resourceConfig) {
          setConfig(prev => ({ ...prev, ...data.resourceConfig }))
          if (data.resourceConfig.indexingMode) setIndexingMode(data.resourceConfig.indexingMode)
          if (data.resourceConfig.workerConcurrency) setWorkerCount(data.resourceConfig.workerConcurrency)
        }
      }
    } catch (e: any) {
      console.error('[RAG Status Error]:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // Periodic progress polling when indexing is active
  useEffect(() => {
    setEditingPermSourceId(null)
    setPermAllowedUsers([])
    if (!isOpen) return
    loadStatus()
    browse(newFolderPath || '/home/huseyina/code_mode')

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/rag/progress')
        const prog = await res.json()
        if (prog) {
          setProgress(prog)
          if (prog.status === 'running' || prog.status === 'paused') {
            setStatus((prev: any) => ({ ...prev, isIndexing: true }))
          }
        }
      } catch {}
    }, 1200)

    return () => clearInterval(interval)
  }, [isOpen, currentUser?.id])

  if (!isOpen) return null

  const handleToggleTurboMode = async () => {
    const nextMode = indexingMode === 'standard' ? 'turbo' : 'standard'
    const nextWorkers = nextMode === 'turbo' ? 8 : 2
    setIndexingMode(nextMode)
    setWorkerCount(nextWorkers)
    onShowToast(`İndeksleme Modu: ${nextMode === 'turbo' ? '🚀 TURBO MOD (8 Worker / 200 Bulk)' : '🟢 STANDART MOD (2 Worker)'}`, 'info')
    try {
      await fetch('/api/rag/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexingMode: nextMode, workerConcurrency: nextWorkers })
      })
      loadStatus()
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    }
  }

  const handlePauseIndexing = async () => {
    try {
      const res = await fetch('/api/rag/pause', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        onShowToast('⏸️ İndeksleme kuyruğu duraklatıldı', 'info')
        if (data.progress) setProgress(data.progress)
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    }
  }

  const handleResumeIndexing = async () => {
    try {
      const res = await fetch('/api/rag/resume', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        onShowToast('▶️ İndeksleme kuyruğu devam ettiriliyor', 'success')
        if (data.progress) setProgress(data.progress)
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    }
  }

  const handleCancelIndexing = async () => {
    if (!confirm('Devam eden indeksleme işlemini iptal etmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch('/api/rag/cancel', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        onShowToast('⏹️ İndeksleme iptal edildi', 'info')
        if (data.progress) setProgress(data.progress)
        loadStatus()
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    }
  }

  const handleAddFolder = async () => {
    if (!newFolderPath.trim()) return
    setIsLoading(true)
    onShowToast(`"${newFolderPath}" taranıyor ve vektörleştiriliyor...`, 'info')
    try {
      const res = await fetch('/api/rag/index', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ path: newFolderPath.trim(), config })
      })
      const data = await res.json()
      if (data.success) {
        onShowToast(`Klasör başarıyla indekslendi (${data.source.chunkCount} vektör parçası oluşturuldu)`, 'success')
        loadStatus()
      } else {
        onShowToast(`İndeksleme hatası: ${data.error}`, 'error')
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveFolder = async (folderPathOrId: string) => {
    if (!confirm(`"${folderPathOrId}" kaynağını ve vektör kayıtlarını silmek istediğinize emin misiniz?`)) return
    try {
      const res = await fetch('/api/rag/remove', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: folderPathOrId })
      })
      const data = await res.json()
      if (data.success) {
        onShowToast('Kaynak RAG veritabanından kaldırıldı', 'success')
        loadStatus()
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Tüm RAG veritabanını ve vektör kayıtlarını temizlemek istediğinize emin misiniz?')) return
    try {
      const res = await fetch('/api/rag/clear', { method: 'POST', headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        onShowToast('Tüm RAG veritabanı temizlendi', 'success')
        loadStatus()
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    }
  }

  const handleOpenPermissions = (src: any) => {
    setEditingPermSourceId(src.id)
    setPermAllowedUsers(src.allowedUserIds || ['*'])
    setPermIsPublic(src.isPublic !== false)
  }

  const handleSavePermissions = async (sourceId: string) => {
    setIsSavingPerms(true)
    try {
      const res = await fetch('/api/rag/permissions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sourceId,
          allowedUserIds: permIsPublic ? ['*'] : permAllowedUsers,
          isPublic: permIsPublic
        })
      })
      const data = await res.json()
      if (data.success) {
        onShowToast('RAG klasörü izinleri güncellendi', 'success')
        setEditingPermSourceId(null)
        loadStatus()
      } else {
        onShowToast(`İzin güncelleme hatası: ${data.error}`, 'error')
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    } finally {
      setIsSavingPerms(false)
    }
  }

  const handleToggleUserPermission = (userId: string) => {
    setPermAllowedUsers(prev => {
      const clean = prev.filter(id => id !== '*')
      if (clean.includes(userId)) {
        return clean.filter(id => id !== userId)
      } else {
        return [...clean, userId]
      }
    })
  }

  const handleToggleRagMode = async () => {
    const nextState = !status?.ragModeActive
    try {
      const res = await fetch('/api/rag/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState })
      })
      const data = await res.json()
      if (data.success) {
        onShowToast(`RAG Modu ${nextState ? 'AÇILDI' : 'KAPATILDI'}`, 'success')
        loadStatus()
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    }
  }

  const handleSaveConfig = async () => {
    try {
      const res = await fetch('/api/rag/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      const data = await res.json()
      if (data.success) {
        onShowToast('vLLM & Sistem Kaynak Ayarları Kaydedildi', 'success')
        loadStatus()
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    }
  }

  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchResults([])
    try {
      if (searchMode === 'image') {
        const res = await fetch('/api/rag/search-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textQuery: searchQuery.trim(), topK: 6 })
        })
        const data = await res.json()
        setSearchResults(data.results || [])
      } else {
        const res = await fetch('/api/rag/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery.trim(), topK: 5 })
        })
        const data = await res.json()
        setSearchResults(data.results || [])
      }
    } catch (e: any) {
      onShowToast(`Arama hatası: ${e.message}`, 'error')
    } finally {
      setIsSearching(false)
    }
  }

  const navigateTo = (dirName: string) => {
    const next = browsePath === '/' ? `/${dirName}` : `${browsePath}/${dirName}`
    browse(next)
  }

  const navigateToParent = () => {
    if (parentPath && parentPath !== browsePath) {
      browse(parentPath)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🧠 RAG Bilgi Bankası & pgvector Yönetimi"
      maxWidth="840px"
    >
      <div className="rag-modal-container">
        {/* Navigation Tabs */}
        <div className="rag-tabs-header">
          <button
            type="button"
            className={`rag-tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveTab('sources')}
          >
            📁 İndeksli Klasörler ({status?.sources?.length || 0})
          </button>
          <button
            type="button"
            className={`rag-tab-btn ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            ⚙️ vLLM & Sistem Kaynakları
          </button>
          <button
            type="button"
            className={`rag-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            🔎 Canlı Semantik Test
          </button>
        </div>

        {/* Global Summary Badge */}
        <div className="rag-summary-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="rag-stat-item">
              <span className="rag-stat-label">Toplam Doküman:</span>
              <span className="rag-stat-value">{status?.totalDocumentsCount || 0}</span>
            </div>
            <div className="rag-stat-item">
              <span className="rag-stat-label">Vektör Parçası:</span>
              <span className="rag-stat-value">{status?.totalChunksCount || 0}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Turbo Mode Toggle */}
            <button
              type="button"
              onClick={handleToggleTurboMode}
              style={{
                cursor: 'pointer',
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: indexingMode === 'turbo' ? '#f59e0b' : '#334155',
                background: indexingMode === 'turbo' ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: indexingMode === 'turbo' ? '0 0 12px rgba(245, 158, 11, 0.4)' : 'none',
                transition: 'all 0.2s ease'
              }}
              title="200-300GB büyük veri setleri için 8 Worker ve yüksek batch boyutunu açar"
            >
              {indexingMode === 'turbo' ? '🚀 TURBO MOD (8 Worker)' : '🟢 Standart Mod'}
            </button>

            {/* RAG Active Toggle */}
            <button
              type="button"
              className={`rag-mode-toggle-btn ${status?.ragModeActive ? 'on' : 'off'}`}
              onClick={handleToggleRagMode}
            >
              {status?.ragModeActive ? '⚡ RAG AKTİF' : '○ PASİF'}
            </button>
          </div>
        </div>

        {/* ⚡ REAL-TIME DISTRIBUTED QUEUE PROGRESS BAR */}
        {progress && (progress.status === 'running' || progress.status === 'paused' || (progress.totalFiles > 0 && progress.processedFiles < progress.totalFiles)) && (
          <div style={{
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '10px',
            padding: '14px 16px',
            margin: '0 0 16px 0',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Header & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: progress.status === 'paused' ? '#eab308' : '#10b981',
                  boxShadow: progress.status === 'paused' ? '0 0 8px #eab308' : '0 0 8px #10b981',
                  display: 'inline-block'
                }} />
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>
                  {progress.status === 'paused' ? '⏸️ İndeksleme Duraklatıldı' : '⚡ Büyük Veri İndeksleme Sürüyor (Redis Kuyruğu)'}
                </span>
                <span style={{
                  fontSize: '11px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#818cf8',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}>
                  {workerCount} Paralel Worker
                </span>
              </div>

              {/* Pause / Resume / Cancel Action Buttons */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {progress.status === 'running' && (
                  <button
                    type="button"
                    onClick={handlePauseIndexing}
                    style={{
                      cursor: 'pointer',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      background: '#eab30822',
                      border: '1px solid #eab308',
                      color: '#eab308',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    ⏸️ Duraklat
                  </button>
                )}
                {progress.status === 'paused' && (
                  <button
                    type="button"
                    onClick={handleResumeIndexing}
                    style={{
                      cursor: 'pointer',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      background: '#10b98122',
                      border: '1px solid #10b981',
                      color: '#10b981',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    ▶️ Devam Et
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancelIndexing}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    borderRadius: '5px',
                    background: '#ef444422',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  ⏹️ İptal Et
                </button>
              </div>
            </div>

            {/* Progress Track */}
            <div style={{
              width: '100%',
              height: '10px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '5px',
              overflow: 'hidden',
              marginBottom: '8px'
            }}>
              <div style={{
                width: `${progress.percent}%`,
                height: '100%',
                background: progress.status === 'paused'
                  ? 'linear-gradient(90deg, #eab308, #ca8a04)'
                  : 'linear-gradient(90deg, #6366f1, #38bdf8)',
                borderRadius: '5px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            {/* Progress Stats Meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
              <span>📄 <b>{progress.processedFiles.toLocaleString()}</b> / {progress.totalFiles.toLocaleString()} Dosya (%{progress.percent})</span>
              <span>🧩 <b>{progress.totalChunks.toLocaleString()}</b> Vektör</span>
              {progress.speedFilesPerSec ? <span>⚡ <b>{progress.speedFilesPerSec}</b> dosya/sn</span> : null}
              {progress.estimatedRemainingSec ? <span>🕒 Kalan Süre: ~<b>{Math.ceil(progress.estimatedRemainingSec / 60)}</b> dk</span> : null}
            </div>

            {/* Active File Name */}
            {progress.currentFile && (
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ color: '#94a3b8' }}>İşlenen:</span> <code>{progress.currentFile}</code>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: SOURCES */}
        {activeTab === 'sources' && (
          <div className="rag-tab-content">
            <div className="rag-add-section">
              <label className="form-label">Bilgisayarınızdan Klasör / Bilgi Kaynağı Seçin</label>
              
              <div className="workspace-path-bar">
                <input
                  type="text"
                  className="form-input ws-input"
                  value={newFolderPath}
                  onChange={(e) => setNewFolderPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      browse(newFolderPath)
                    }
                  }}
                  placeholder="/home/user/docs veya /proje/referanslar"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => browse(newFolderPath)}
                  title="Dizine Git"
                >
                  Git ↵
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAddFolder}
                  disabled={isLoading || !newFolderPath.trim()}
                >
                  {isLoading ? 'İndeksleniyor...' : '⚡ Bu Klasörü İndeksle'}
                </Button>
              </div>

              {/* Quick Shortcuts & File Limit Control */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', margin: '8px 0 12px 0' }}>
                <div className="ws-shortcuts-bar" style={{ margin: 0 }}>
                  <span className="ws-shortcut-label">Hızlı Erişim:</span>
                  <button
                    type="button"
                    className="ws-shortcut-chip"
                    onClick={() => browse('/mnt/nvmes/nvme1/RAG-data')}
                    style={{ borderColor: 'var(--brand-cyan)' }}
                  >
                    💾 RAG-data
                  </button>
                  <button
                    type="button"
                    className="ws-shortcut-chip"
                    onClick={() => browse('/mnt/nvmes/nvme1/RAG-data/books')}
                  >
                    📚 books
                  </button>
                  <button
                    type="button"
                    className="ws-shortcut-chip"
                    onClick={() => browse('/mnt/nvmes/nvme1/RAG-data/imagenetmini')}
                  >
                    🖼️ imagenetmini
                  </button>
                  <button
                    type="button"
                    className="ws-shortcut-chip"
                    onClick={() => browse('/mnt/nvmes/nvme1/RAG-data/teknik-resimler')}
                  >
                    📐 teknik-resimler
                  </button>
                  <button
                    type="button"
                    className="ws-shortcut-chip"
                    onClick={() => browse('/home/huseyina/code_mode')}
                  >
                    ⚡ code_mode
                  </button>
                </div>

                {/* Max Files Limit Selector */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>🎯 Dosya Limiti:</span>
                  <input
                    type="number"
                    min="1"
                    step="10"
                    className="form-input"
                    style={{ width: '80px', padding: '3px 6px', fontSize: '12px', textAlign: 'center' }}
                    placeholder="Sınırsız"
                    value={(config as any).maxFiles || ''}
                    onChange={(e) => setConfig({ ...config, maxFiles: e.target.value ? Number(e.target.value) : undefined } as any)}
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, maxFiles: 100 } as any)}
                      style={{ cursor: 'pointer', padding: '2px 6px', fontSize: '11px', borderRadius: '4px', background: (config as any).maxFiles === 100 ? '#6366f1' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
                    >
                      100
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, maxFiles: 500 } as any)}
                      style={{ cursor: 'pointer', padding: '2px 6px', fontSize: '11px', borderRadius: '4px', background: (config as any).maxFiles === 500 ? '#6366f1' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
                    >
                      500
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, maxFiles: undefined } as any)}
                      style={{ cursor: 'pointer', padding: '2px 6px', fontSize: '11px', borderRadius: '4px', background: !(config as any).maxFiles ? '#10b981' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
                    >
                      Tümü
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive Folder Explorer */}
              <div className="ws-browser-section">
                <div className="ws-browser-header">
                  <span>Dizin Gezgini: <code style={{ color: 'var(--brand-cyan)' }}>{browsePath}</code></span>
                  {isBrowsing && <span className="ws-loading-hint">Taranıyor...</span>}
                </div>

                <div className="ws-dir-list" style={{ maxHeight: '220px' }}>
                  {parentPath && parentPath !== browsePath && (
                    <div className="ws-dir-item parent-dir" onClick={navigateToParent}>
                      <span className="ws-dir-icon">📁</span>
                      <span className="ws-dir-name">.. (Üst Dizine Çık)</span>
                    </div>
                  )}

                  {/* Directories */}
                  {directories.map((dir) => (
                    <div
                      key={`dir_${dir}`}
                      className={`ws-dir-item ${newFolderPath === `${browsePath}/${dir}` ? 'selected' : ''}`}
                      onClick={() => navigateTo(dir)}
                    >
                      <span className="ws-dir-icon">📂</span>
                      <span className="ws-dir-name">{dir}</span>
                      <span className="ws-dir-action">Klasörü Aç →</span>
                    </div>
                  ))}

                  {/* Individual Files (PDF, Images, Code, Docs) */}
                  {files.map((file) => {
                    const filePath = `${browsePath}/${file}`
                    const isSelected = newFolderPath === filePath
                    const ext = file.split('.').pop()?.toLowerCase() || ''
                    let icon = '📄'
                    let tag = 'Dosya'
                    if (ext === 'pdf') { icon = '📑'; tag = 'PDF' }
                    else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) { icon = '🖼️'; tag = 'OCR Görsel' }
                    else if (['ts', 'tsx', 'js', 'py', 'json', 'md', 'html', 'css'].includes(ext)) { icon = '💻'; tag = 'Kod' }

                    return (
                      <div
                        key={`file_${file}`}
                        className={`ws-dir-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => setNewFolderPath(filePath)}
                        style={{ background: isSelected ? 'rgba(77, 147, 248, 0.15)' : undefined }}
                      >
                        <span className="ws-dir-icon">{icon}</span>
                        <span className="ws-dir-name" style={{ color: isSelected ? 'var(--brand-cyan)' : undefined }}>
                          {file}
                        </span>
                        <span className="badge badge-gray" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          {tag}
                        </span>
                        <span className="ws-dir-action" style={{ color: 'var(--brand-primary-light)' }}>
                          {isSelected ? '✓ Seçildi' : 'Seç'}
                        </span>
                      </div>
                    )
                  })}

                  {directories.length === 0 && files.length === 0 && !isBrowsing && (
                    <div className="ws-empty-hint">Bu dizinde dosya veya alt klasör bulunamadı.</div>
                  )}
                </div>
              </div>

              <div className="form-hint">
                💡 <b>İster tek bir PDF/görsel/kod dosyasını</b> tıklayıp seçin, ister tüm klasörü tek seferde indeksleyin. PDF metinleri ve <code>zai-org/GLM-OCR</code> görsel OCR ayrıştırması otomatik yapılır.
              </div>
            </div>

            <div className="rag-sources-list">
              <div className="rag-sources-header">
                <span>İndekslenen Kaynaklar</span>
                {status?.sources?.length > 0 && (
                  <Button variant="danger" size="sm" onClick={handleClearAll}>
                    Tümünü Temizle
                  </Button>
                )}
              </div>

              {(!status?.sources || status.sources.length === 0) ? (
                <div className="ws-empty-hint">Erişim yetkiniz olan veya indekslenmiş bir klasör bulunmuyor.</div>
              ) : (
                status.sources.map((src: any) => {
                  const isEditingThis = editingPermSourceId === src.id
                  const isOwner = src.ownerId === currentUser?.id
                  const isAdmin = currentUser?.role === 'admin'

                  return (
                    <div key={src.id} className="rag-source-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                        <div className="rag-source-info" style={{ flex: 1 }}>
                          <div className="rag-source-path" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>📂 {src.path}</span>
                            {src.isPublic ? (
                              <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                🌐 Herkese Açık
                              </span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                🔒 Özel İzinli ({src.allowedUserIds?.filter((u: string) => u !== '*').length || 0} Kişi)
                              </span>
                            )}
                          </div>
                          <div className="rag-source-meta">
                            <span>📄 {src.fileCount} dosya</span>
                            <span>🧩 {src.chunkCount} vektör</span>
                            <span>🕒 {new Date(src.lastIndexedAt).toLocaleDateString()}</span>
                            <span className={`rag-source-badge ${src.status}`}>{src.status}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {isAdmin && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => isEditingThis ? setEditingPermSourceId(null) : handleOpenPermissions(src)}
                              style={{ fontSize: '12px', padding: '4px 8px' }}
                            >
                              {isEditingThis ? '✕ Kapat' : '🔒 İzin Ayarla'}
                            </Button>
                          )}
                          {(isAdmin || isOwner) && (
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveFolder(src.id)}>
                              🗑️ Sil
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Permission Editor Drawer for Admin */}
                      {isEditingThis && isAdmin && (
                        <div className="rag-perm-editor" style={{
                          marginTop: '10px',
                          padding: '12px',
                          background: 'rgba(0, 0, 0, 0.35)',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d8b4fe', marginBottom: '8px' }}>
                            🛡️ Bu RAG Klasörünün Erişim İzinlerini Belirleyin:
                          </div>

                          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ececec', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={`perm_mode_${src.id}`}
                                checked={permIsPublic}
                                onChange={() => setPermIsPublic(true)}
                              />
                              <span>🌐 Herkese Açık (Tüm Kiracılar Görebilir)</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ececec', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={`perm_mode_${src.id}`}
                                checked={!permIsPublic}
                                onChange={() => setPermIsPublic(false)}
                              />
                              <span>🔒 Sadece Seçili Kullanıcılar</span>
                            </label>
                          </div>

                          {!permIsPublic && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>İzin verilecek kullanıcıları seçin:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {users.map((u: any) => {
                                  const isAllowed = permAllowedUsers.includes(u.id) || permAllowedUsers.includes('*')
                                  return (
                                    <label
                                      key={u.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '11.5px',
                                        padding: '4px 8px',
                                        background: isAllowed ? 'rgba(16, 163, 126, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${isAllowed ? 'var(--brand-primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isAllowed}
                                        onChange={() => handleToggleUserPermission(u.id)}
                                      />
                                      <span>{u.avatar || '👤'} {u.name} (@{u.username})</span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingPermSourceId(null)}
                            >
                              İptal
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isSavingPerms}
                              onClick={() => handleSavePermissions(src.id)}
                            >
                              {isSavingPerms ? 'Kaydediliyor...' : '💾 İzinleri Kaydet'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CONFIG & RESOURCES */}
        {activeTab === 'config' && (
          <div className="rag-tab-content">
            {/* Distributed Architecture Banner */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontWeight: 600, color: '#818cf8' }}>⚡ Dağıtık Redis Kuyruğu:</span>
                <span style={{ marginLeft: '8px', color: '#94a3b8' }}>custom-harness-redis (Port 16379) Bağlı</span>
              </div>
              <span style={{ background: '#10b98122', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                HAZIR
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">İndeksleme Modu & Paralel Worker Sayısı ({workerCount} Eşzamanlı Worker)</label>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                value={workerCount}
                onChange={(e) => {
                  const count = Number(e.target.value)
                  setWorkerCount(count)
                  setConfig({ ...config, workerConcurrency: count })
                }}
              />
              <div className="form-hint">200-300 GB büyük veri setlerinde aynı anda çalışan bağımsız işlemci sayısı (Önerilen Turbo: 8 Worker).</div>
            </div>

            <div className="form-group">
              <label className="form-label">vLLM Embedding Endpoint</label>
              <input
                type="text"
                className="form-input"
                value={config.embeddingEndpoint}
                onChange={(e) => setConfig({ ...config, embeddingEndpoint: e.target.value })}
                placeholder="http://localhost:8001/v1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">vLLM Embedding Modeli</label>
              <input
                type="text"
                className="form-input"
                value={config.embeddingModel}
                onChange={(e) => setConfig({ ...config, embeddingModel: e.target.value })}
                placeholder="Qwen/Qwen3-Embedding-0.6B"
              />
            </div>

            <div className="form-group">
              <label className="form-label">vLLM Vision OCR Modeli (Görseller İçin)</label>
              <input
                type="text"
                className="form-input"
                value={config.visionModel}
                onChange={(e) => setConfig({ ...config, visionModel: e.target.value })}
                placeholder="zai-org/GLM-OCR"
              />
            </div>

            <div className="form-group">
              <label className="form-label">SigLIP Görsel Arama Endpoint (Vision Embeddings)</label>
              <input
                type="text"
                className="form-input"
                value={(config as any).imageSearchEndpoint || 'http://localhost:8011'}
                onChange={(e) => setConfig({ ...config, imageSearchEndpoint: e.target.value } as any)}
                placeholder="http://localhost:8011"
              />
              <div className="form-hint">768-boyutlu SigLIP çok modlu görsel arama servis uç noktası.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Sistem Kaynak Ayarı: Embedding Batch Boyutu ({config.batchSize} chunk / istek)</label>
              <input
                type="range"
                min="8"
                max="256"
                step="8"
                value={config.batchSize}
                onChange={(e) => setConfig({ ...config, batchSize: Number(e.target.value) })}
              />
              <div className="form-hint">vLLM'e tek seferde gönderilen vektör parçası sayısı. 200GB gibi büyük verilerde 64-128 önerilir.</div>
            </div>

            <div className="form-group">
              <label className="form-label">pgvector Toplu Kayıt Boyutu (Bulk Insert: {(config as any).bulkInsertSize || 50} chunk / SQL)</label>
              <input
                type="range"
                min="20"
                max="500"
                step="20"
                value={(config as any).bulkInsertSize || 50}
                onChange={(e) => setConfig({ ...config, bulkInsertSize: Number(e.target.value) } as any)}
              />
              <div className="form-hint">PostgreSQL veritabanına tek sorguda toplu yazılan vektör miktarı. Disk I/O ve işlem süresini 50 kat hızlandırır.</div>
            </div>

            <div className="form-group">
              <label className="form-label">GPU Throttling / Dinlendirme Gecikmesi ({(config as any).throttleDelayMs || 0} ms)</label>
              <input
                type="range"
                min="0"
                max="500"
                step="25"
                value={(config as any).throttleDelayMs || 0}
                onChange={(e) => setConfig({ ...config, throttleDelayMs: Number(e.target.value) } as any)}
              />
              <div className="form-hint">Her dosya sonrasında GPU VRAM'in boşaltılması ve ısınmayı önlemek için milisaniye cinsinden bekleme süresi.</div>
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="skipExisting"
                checked={(config as any).skipExistingUnchanged !== false}
                onChange={(e) => setConfig({ ...config, skipExistingUnchanged: e.target.checked } as any)}
              />
              <label htmlFor="skipExisting" className="form-label" style={{ cursor: 'pointer', marginBottom: 0 }}>
                ⚡ Değişmeyen Dokümanları Atla (Content-Hash Resume / Hızlı Yeniden Tarama)
              </label>
            </div>

            <Button variant="primary" onClick={handleSaveConfig}>
              Ayarları Kaydet & Uygula
            </Button>
          </div>
        )}

        {/* TAB 3: LIVE SEARCH */}
        {activeTab === 'search' && (
          <div className="rag-tab-content">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => { setSearchMode('text'); setSearchResults([]); }}
                style={{
                  cursor: 'pointer',
                  padding: '7px 15px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #334155)',
                  background: searchMode === 'text' ? '#6366f1' : 'transparent',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease'
                }}
              >
                📝 Metin & Kod Arama (Qwen3)
              </button>
              <button
                type="button"
                onClick={() => { setSearchMode('image'); setSearchResults([]); }}
                style={{
                  cursor: 'pointer',
                  padding: '7px 15px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #334155)',
                  background: searchMode === 'image' ? '#6366f1' : 'transparent',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease'
                }}
              >
                🖼️ Görsel / Şema Arama (SigLIP)
              </button>
            </div>

            <form onSubmit={handleTestSearch} className="rag-search-bar">
              <input
                type="text"
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchMode === 'image' ? "Görsel veya şema açıklamasını yazın (örn: 'auth akışı mimari şeması', 'login ekranı')..." : "Semantik olarak aramak istediğiniz kavramı veya kod işlevini yazın..."}
              />
              <Button variant="primary" type="submit" disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? 'Aranıyor...' : 'Ara 🔎'}
              </Button>
            </form>

            <div className="rag-results-container">
              {searchResults.length === 0 && !isSearching && (
                <div className="ws-empty-hint">Arama sonucu bulunamadı veya henüz sorgu yapılmadı.</div>
              )}

              {searchResults.map((res, i) => (
                searchMode === 'image' ? (
                  <div key={res.filePath || i} className="rag-result-card" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{ width: '70px', height: '70px', background: '#1e293b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                      🖼️
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="rag-result-header" style={{ marginBottom: '4px' }}>
                        <span className="rag-result-file" style={{ wordBreak: 'break-all', fontWeight: 600 }}>{res.filePath}</span>
                        <span className="rag-result-sim" style={{ background: '#10b98122', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                          Görsel Benzerlik: {res.similarity ? (res.similarity * 100).toFixed(1) + '%' : 'N/A'}
                        </span>
                      </div>
                      {res.ocrText && (
                        <div style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.03)', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <b>OCR:</b> {res.ocrText}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={res.id || i} className="rag-result-card">
                    <div className="rag-result-header">
                      <span className="rag-result-file">📄 {res.sourcePath}</span>
                      <span className="rag-result-sim">
                        Benzerlik: {res.similarity ? (res.similarity * 100).toFixed(1) + '%' : 'N/A'}
                      </span>
                    </div>
                    <pre className="rag-result-snippet">{res.content}</pre>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: LIVE SEARCH */}
        {activeTab === 'search' && (
          <div className="rag-tab-content">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => { setSearchMode('text'); setSearchResults([]); }}
                style={{
                  cursor: 'pointer',
                  padding: '7px 15px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #334155)',
                  background: searchMode === 'text' ? '#6366f1' : 'transparent',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease'
                }}
              >
                📝 Metin & Kod Arama (Qwen3)
              </button>
              <button
                type="button"
                onClick={() => { setSearchMode('image'); setSearchResults([]); }}
                style={{
                  cursor: 'pointer',
                  padding: '7px 15px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #334155)',
                  background: searchMode === 'image' ? '#6366f1' : 'transparent',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease'
                }}
              >
                🖼️ Görsel / Şema Arama (SigLIP)
              </button>
            </div>

            <form onSubmit={handleTestSearch} className="rag-search-bar">
              <input
                type="text"
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchMode === 'image' ? "Görsel veya şema açıklamasını yazın (örn: 'auth akışı mimari şeması', 'login ekranı')..." : "Semantik olarak aramak istediğiniz kavramı veya kod işlevini yazın..."}
              />
              <Button variant="primary" type="submit" disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? 'Aranıyor...' : 'Ara 🔎'}
              </Button>
            </form>

            <div className="rag-results-container">
              {searchResults.length === 0 && !isSearching && (
                <div className="ws-empty-hint">Arama sonucu bulunamadı veya henüz sorgu yapılmadı.</div>
              )}

              {searchResults.map((res, i) => (
                searchMode === 'image' ? (
                  <div key={res.filePath || i} className="rag-result-card" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{ width: '70px', height: '70px', background: '#1e293b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                      🖼️
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="rag-result-header" style={{ marginBottom: '4px' }}>
                        <span className="rag-result-file" style={{ wordBreak: 'break-all', fontWeight: 600 }}>{res.filePath}</span>
                        <span className="rag-result-sim" style={{ background: '#10b98122', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                          Görsel Benzerlik: {res.similarity ? (res.similarity * 100).toFixed(1) + '%' : 'N/A'}
                        </span>
                      </div>
                      {res.ocrText && (
                        <div style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.03)', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <b>OCR:</b> {res.ocrText}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={res.id || i} className="rag-result-card">
                    <div className="rag-result-header">
                      <span className="rag-result-file">📄 {res.sourcePath}</span>
                      <span className="rag-result-sim">
                        Benzerlik: {res.similarity ? (res.similarity * 100).toFixed(1) + '%' : 'N/A'}
                      </span>
                    </div>
                    <pre className="rag-result-snippet">{res.content}</pre>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
