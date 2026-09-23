import React, { useState, useEffect } from 'react'
import {
  fetchRagStatus,
  browseWorkspace,
  searchRag,
  searchRagImages,
  indexRagFolder,
  removeRagSource,
  clearRagAll,
  getRagProgress,
  pauseRagIndexing,
  resumeRagIndexing,
  cancelRagIndexing,
  updateRagConfig,
  toggleRagMode,
  updateRagPermissions,
  fetchUsers,
  type RagSearchResult,
  type RagProgress
} from '../api.js'
import {
  KnowledgeIcon,
  SearchIcon,
  CpuIcon,
  SparklesIcon,
  CheckCircleIcon,
  FlowIcon,
  TerminalIcon,
  OrganizationIcon,
  LedgerIcon,
  TrashIcon
} from '../components/Icons.js'

interface KnowledgeBasePageProps {
  companyWorkspace: string
  companyName?: string
  onOpenFile?: (path: string) => void
}

export const KnowledgeBasePage: React.FC<KnowledgeBasePageProps> = ({
  companyWorkspace,
  companyName = 'COMPANY_ABC',
  onOpenFile
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'config' | 'search'>('sources')
  const [ragStatus, setRagStatus] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Directory Browser State (Zero Hardcoding - Fully dynamic and unrestricted)
  const [browsePath, setBrowsePath] = useState<string>(companyWorkspace)
  const [parentPath, setParentPath] = useState<string>('')
  const [newFolderPath, setNewFolderPath] = useState<string>(companyWorkspace)
  const [directories, setDirectories] = useState<string[]>([])
  const [files, setFiles] = useState<string[]>([])
  const [isBrowsing, setIsBrowsing] = useState(false)
  const [fileFilter, setFileFilter] = useState('')

  // Indexing Mode & Progress State
  const [indexingMode, setIndexingMode] = useState<'standard' | 'turbo'>('standard')
  const [workerCount, setWorkerCount] = useState(4)
  const [progress, setProgress] = useState<RagProgress | null>(null)

  // Config State
  const [config, setConfig] = useState({
    embeddingEndpoint: 'http://localhost:8001/v1',
    embeddingModel: 'Qwen/Qwen3-Embedding-0.6B',
    visionEndpoint: 'http://localhost:8010/v1',
    visionModel: 'zai-org/GLM-OCR',
    visionApiKey: 'sk-agent-key',
    rerankerEndpoint: 'http://localhost:8006/v1/rerank',
    rerankerModel: 'Qwen/Qwen3-Reranker-0.6B',
    imageSearchEndpoint: 'http://localhost:8011',
    workerConcurrency: 4,
    indexingMode: 'standard',
    batchSize: 32,
    bulkInsertSize: 100,
    throttleDelayMs: 0,
    chunkSize: 1000,
    chunkOverlap: 150,
    skipExistingUnchanged: true,
    maxFiles: undefined as number | undefined
  })

  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'text' | 'image'>('text')
  const [searchTopK, setSearchTopK] = useState<number>(5)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Permissions State
  const [editingPermSourceId, setEditingPermSourceId] = useState<string | null>(null)
  const [permAllowedUsers, setPermAllowedUsers] = useState<string[]>([])
  const [permIsPublic, setPermIsPublic] = useState(true)
  const [isSavingPerms, setIsSavingPerms] = useState(false)
  const [users, setUsers] = useState<any[]>([])

  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedbackMsg({ text, type })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // Browse Directory dynamically
  const browse = async (target: string) => {
    setIsBrowsing(true)
    try {
      const data = await browseWorkspace(target)
      if (data && data.current) {
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

  const navigateTo = (dirName: string) => {
    const cleanBase = browsePath === '/' ? '' : browsePath.replace(/\/+$/, '')
    const next = `${cleanBase}/${dirName}`
    browse(next)
  }

  const navigateToParent = () => {
    if (parentPath && parentPath !== browsePath) {
      browse(parentPath)
    }
  }

  // Load Status, Config, and Users
  const loadStatus = async () => {
    setIsLoading(true)
    try {
      const [rag, userList] = await Promise.all([
        fetchRagStatus(),
        fetchUsers()
      ])
      if (rag) {
        setRagStatus(rag)
        if (rag.progress) {
          setProgress(rag.progress)
        }
        if (rag.resourceConfig) {
          setConfig(prev => ({ ...prev, ...rag.resourceConfig }))
          if (rag.resourceConfig.indexingMode) setIndexingMode(rag.resourceConfig.indexingMode)
          if (rag.resourceConfig.workerConcurrency) setWorkerCount(rag.resourceConfig.workerConcurrency)
        }
      }
      if (userList && userList.length > 0) {
        setUsers(userList)
      } else {
        setUsers([
          { id: 'user_admin', name: 'Hüseyin', username: 'admin', avatar: '👨‍💼', role: 'admin' },
          { id: 'ceo_agent', name: 'Genel Müdür (CEO)', username: 'ceo', avatar: '🏢', role: 'agent' },
          { id: 'finance_agent', name: 'Finans Müdürü', username: 'finans', avatar: '💰', role: 'agent' },
          { id: 'supply_agent', name: 'Tedarik Müdürü', username: 'tedarik', avatar: '📦', role: 'agent' }
        ])
      }
    } catch (e: any) {
      console.error('[RAG Status Error]:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadStatus()
    browse(companyWorkspace || '/home/huseyina/code_mode')
  }, [companyWorkspace])

  // Periodic progress polling
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const prog = await getRagProgress()
        if (prog) {
          setProgress(prog)
          if (prog.status === 'running' || prog.status === 'paused') {
            setRagStatus((prev: any) => ({ ...prev, isIndexing: true }))
          } else if (prog.status === 'completed') {
            fetchRagStatus().then(r => r && setRagStatus(r))
          }
        }
      } catch {}
    }, 1400)

    return () => clearInterval(timer)
  }, [])

  // Turbo Mode Toggle
  const handleToggleTurboMode = async () => {
    const nextMode = indexingMode === 'standard' ? 'turbo' : 'standard'
    const nextWorkers = nextMode === 'turbo' ? 8 : 2
    setIndexingMode(nextMode)
    setWorkerCount(nextWorkers)
    showNotification(
      `İndeksleme Modu: ${nextMode === 'turbo' ? '🚀 TURBO MOD (8 Worker / 200 Bulk Insert)' : '🟢 STANDART MOD (2 Worker)'}`,
      'info'
    )
    try {
      await updateRagConfig({ indexingMode: nextMode, workerConcurrency: nextWorkers })
      loadStatus()
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    }
  }

  // RAG Mode Toggle (Active / Passive)
  const handleToggleRagMode = async () => {
    const nextState = !ragStatus?.ragModeActive
    try {
      const res = await toggleRagMode(nextState)
      if (res && res.success) {
        showNotification(`RAG Bilgi Bankası Modu ${nextState ? 'AÇILDI (Canlı Aktif)' : 'KAPATILDI (Pasif)'}`, 'success')
        loadStatus()
      }
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    }
  }

  // Pause / Resume / Cancel Indexing
  const handlePauseIndexing = async () => {
    try {
      const res = await pauseRagIndexing()
      if (res?.success) {
        showNotification('⏸️ İndeksleme kuyruğu duraklatıldı', 'info')
        if (res.progress) setProgress(res.progress)
      }
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    }
  }

  const handleResumeIndexing = async () => {
    try {
      const res = await resumeRagIndexing()
      if (res?.success) {
        showNotification('▶️ İndeksleme kuyruğu devam ettiriliyor', 'success')
        if (res.progress) setProgress(res.progress)
      }
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    }
  }

  const handleCancelIndexing = async () => {
    if (!confirm('Devam eden indeksleme işlemini iptal etmek istediğinize emin misiniz?')) return
    try {
      const res = await cancelRagIndexing()
      if (res?.success) {
        showNotification('⏹️ İndeksleme işlemi iptal edildi', 'info')
        setProgress(null)
        loadStatus()
      }
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    }
  }

  // Index Folder or File
  const handleIndexTarget = async (targetPath?: string) => {
    const path = (targetPath || newFolderPath).trim()
    if (!path) return
    setIsLoading(true)
    showNotification(`"${path}" taranıyor ve vektörleştiriliyor...`, 'info')
    try {
      const res = await indexRagFolder(path, {
        ...config,
        indexingMode,
        workerConcurrency: workerCount
      })
      if (res && res.success) {
        showNotification(`Klasör/Dosya başarıyla indekslendi (${res.source?.chunkCount || 0} vektör parçası)`, 'success')
        loadStatus()
      } else {
        showNotification(`İndeksleme hatası: ${res?.error || 'Bilinmeyen hata'}`, 'error')
      }
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Remove Source
  const handleRemoveSource = async (sourceId: string) => {
    if (!confirm(`"${sourceId}" kaynağını ve ilişkili vektör kayıtlarını silmek istediğinize emin misiniz?`)) return
    try {
      const res = await removeRagSource(sourceId)
      if (res?.success) {
        showNotification('Kaynak RAG veritabanından kaldırıldı', 'success')
        loadStatus()
      }
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    }
  }

  // Clear All Database
  const handleClearAll = async () => {
    if (!confirm('TÜM RAG VEKTÖR VERİTABANINI VE İNDEKSLERİNİ SIFIRLAMAK İSTEDİĞİNİZE EMİN MİSİNİZ? Bu işlem geri alınamaz!')) return
    try {
      const res = await clearRagAll()
      if (res?.success) {
        showNotification('Tüm RAG veritabanı temizlendi', 'success')
        setProgress(null)
        loadStatus()
      }
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    }
  }

  // Permissions Drawer Handlers
  const handleOpenPermissions = (src: any) => {
    setEditingPermSourceId(src.id)
    setPermAllowedUsers(src.allowedUserIds || ['*'])
    setPermIsPublic(src.isPublic !== false)
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

  const handleSavePermissions = async (sourceId: string) => {
    setIsSavingPerms(true)
    try {
      const res = await updateRagPermissions(
        sourceId,
        permIsPublic ? ['*'] : permAllowedUsers,
        permIsPublic
      )
      if (res?.success) {
        showNotification('RAG klasörü izinleri başarıyla güncellendi', 'success')
        setEditingPermSourceId(null)
        loadStatus()
      } else {
        showNotification(`İzin hatası: ${res?.error || 'Güncellenemedi'}`, 'error')
      }
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    } finally {
      setIsSavingPerms(false)
    }
  }

  // Save System & vLLM Config
  const handleSaveConfig = async () => {
    try {
      const res = await updateRagConfig({
        ...config,
        workerConcurrency: workerCount,
        indexingMode
      })
      if (res?.success) {
        showNotification('vLLM & Sistem Kaynak Ayarları Kaydedildi', 'success')
        loadStatus()
      } else {
        showNotification('Ayarlar uygulanamadı', 'error')
      }
    } catch (e: any) {
      showNotification(`Hata: ${e.message}`, 'error')
    }
  }

  // Multimodal Test Search (Text & SigLIP Vision)
  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim() || isSearching) return
    setIsSearching(true)
    setSearchResults([])
    setSearchError(null)

    try {
      if (searchMode === 'image') {
        const results = await searchRagImages(searchQuery.trim(), undefined, searchTopK)
        setSearchResults(results || [])
        if (!results || results.length === 0) {
          showNotification('Görsel/şema arama kriterine uygun sonuç bulunamadı.', 'info')
        }
      } else {
        const results = await searchRag(searchQuery.trim(), searchTopK)
        setSearchResults(results || [])
        if (!results || results.length === 0) {
          showNotification('Semantik metin arama kriterine uygun vektör bulunamadı.', 'info')
        }
      }
    } catch (err: any) {
      setSearchError(err.message)
      showNotification(`Arama hatası: ${err.message}`, 'error')
    } finally {
      setIsSearching(false)
    }
  }

  const filteredFiles = files.filter(f =>
    f.toLowerCase().includes(fileFilter.toLowerCase())
  )

  const filteredDirs = directories.filter(d =>
    d.toLowerCase().includes(fileFilter.toLowerCase())
  )

  return (
    <div className="knowledge-view-container">
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div className={`rag-feedback-banner ${feedbackMsg.type}`}>
          <span>{feedbackMsg.type === 'success' ? '✓' : feedbackMsg.type === 'error' ? '✕' : 'ℹ️'}</span>
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Header & Title */}
      <div className="knowledge-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                boxShadow: '0 0 16px rgba(56, 189, 248, 0.2)'
              }}
            >
              <KnowledgeIcon size={20} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Şirket Bilgi Tabanı & Vektör RAG Motoru
            </h2>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              PGVECTOR MULTI-MODAL
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
            Kurumsal pgvector altyapısı, çok modlu (Qwen3 & SigLIP) semantik arama, dosya gezgini ve vLLM kaynak yönetimi.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '3px',
            gap: '4px'
          }}
        >
          <button
            type="button"
            className={`rag-tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveTab('sources')}
            style={{
              background: activeTab === 'sources' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              border: activeTab === 'sources' ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid transparent',
              color: activeTab === 'sources' ? '#c7d2fe' : '#94a3b8',
              padding: '6px 14px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: activeTab === 'sources' ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <FlowIcon size={14} />
            <span>Dosya & Bilgi Kaynakları ({ragStatus?.sources?.length || 0})</span>
          </button>
          <button
            type="button"
            className={`rag-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
            style={{
              background: activeTab === 'search' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
              border: activeTab === 'search' ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
              color: activeTab === 'search' ? '#7dd3fc' : '#94a3b8',
              padding: '6px 14px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: activeTab === 'search' ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <SearchIcon size={14} />
            <span>Canlı Semantik Test</span>
          </button>
          <button
            type="button"
            className={`rag-tab-btn ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
            style={{
              background: activeTab === 'config' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
              border: activeTab === 'config' ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid transparent',
              color: activeTab === 'config' ? '#34d399' : '#94a3b8',
              padding: '6px 14px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: activeTab === 'config' ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <CpuIcon size={14} />
            <span>vLLM & Sistem Kaynakları</span>
            {progress?.status === 'running' && <span className="pulse-dot-amber" style={{ marginLeft: '4px' }} />}
          </button>
        </div>
      </div>

      {/* KPI Telemetry Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px 20px',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Toplam Doküman
            </span>
            <FlowIcon size={14} color="#94a3b8" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {ragStatus?.totalDocumentsCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
            İndekslenmiş metin ve tablolar
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '12px',
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
              Vektör Parçası (Chunks)
            </span>
            <TerminalIcon size={14} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
            {ragStatus?.totalChunksCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
            pgvector gömme vektörleri
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '12px',
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase' }}>
              Aktif Kaynak
            </span>
            <KnowledgeIcon size={14} color="#818cf8" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#818cf8', marginTop: '6px' }}>
            {ragStatus?.sources?.length || 0} Klasör
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
            Dinamik workspace kaynakları
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>
              Embedding Motoru
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>ONLINE</span>
            </div>
          </div>
          <div
            style={{
              fontSize: '11.5px',
              fontFamily: 'var(--font-mono)',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '4px 8px',
              borderRadius: '6px',
              marginTop: '6px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={ragStatus?.resourceConfig?.embeddingModel || config.embeddingModel}
          >
            {ragStatus?.resourceConfig?.embeddingModel || config.embeddingModel}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleToggleTurboMode}
              style={{
                cursor: 'pointer',
                padding: '4px 10px',
                borderRadius: '6px',
                border: indexingMode === 'turbo' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                background: indexingMode === 'turbo' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: indexingMode === 'turbo' ? '#fbbf24' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <SparklesIcon size={11} />
              <span>{indexingMode === 'turbo' ? 'Turbo (8 W)' : 'Standart'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleRagMode}
              style={{
                cursor: 'pointer',
                padding: '4px 10px',
                borderRadius: '6px',
                border: ragStatus?.ragModeActive ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                background: ragStatus?.ragModeActive ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                color: ragStatus?.ragModeActive ? '#34d399' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <CheckCircleIcon size={11} />
              <span>{ragStatus?.ragModeActive ? 'Aktif' : 'Pasif'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ⚡ REAL-TIME DISTRIBUTED QUEUE PROGRESS BAR */}
      {progress && (progress.status === 'running' || progress.status === 'paused') && (
        <div style={{
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
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
              width: `${Math.max(progress.percent, 2)}%`,
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
            <span>📄 <b>{progress.processedFiles?.toLocaleString() || 0}</b> / {progress.totalFiles?.toLocaleString() || 0} Dosya (%{progress.percent})</span>
            <span>🧩 <b>{progress.totalChunks?.toLocaleString() || 0}</b> Vektör</span>
            {progress.speedFilesPerSec ? <span>⚡ <b>{progress.speedFilesPerSec.toFixed(1)}</b> dosya/sn</span> : null}
            {progress.estimatedRemainingSec ? <span>🕒 Kalan Süre: ~<b>{Math.ceil(progress.estimatedRemainingSec / 60)}</b> dk</span> : null}
          </div>

          {/* Active File Name */}
          {progress.currentFile && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ color: '#94a3b8' }}>İşleniyor:</span> <code>{progress.currentFile}</code>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: SOURCES & INTERACTIVE DIRECTORY BROWSER */}
      {activeTab === 'sources' && (
        <div className="rag-tab-content">
          <div
            className="rag-add-section"
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '18px 20px',
              marginBottom: '20px'
            }}
          >
            <label style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
              Dinamik Workspace ve Klasör Gezgini:
            </label>

            {/* Editable Path Input Bar with Git & Index Buttons */}
            <div className="workspace-path-bar" style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <input
                type="text"
                className="form-input ws-input"
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.4)',
                  color: '#f8fafc',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    browse(newFolderPath)
                  }
                }}
                placeholder="/home/huseyina/code_mode/COMPANY_ABC veya taranacak dizin"
              />
              <button
                type="button"
                className="btn-secondary"
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12.5px'
                }}
                onClick={() => browse(newFolderPath)}
                title="Yolu Tara ve Aç"
              >
                Gözat ↵
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={() => handleIndexTarget(newFolderPath)}
                disabled={isLoading || !newFolderPath.trim()}
              >
                <SparklesIcon size={13} />
                <span>{isLoading ? 'İndeksleniyor...' : 'Seçiliyi İndeksle'}</span>
              </button>
            </div>

            {/* Quick Shortcuts & File Limit Control */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', margin: '10px 0 14px 0' }}>
              <div className="ws-shortcuts-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="ws-shortcut-label" style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>Hızlı Erişim:</span>
                <button
                  type="button"
                  className="ws-shortcut-chip"
                  onClick={() => browse(companyWorkspace)}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    background: 'rgba(56, 189, 248, 0.1)',
                    color: '#7dd3fc',
                    fontSize: '11.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <OrganizationIcon size={12} />
                  <span>{companyName}</span>
                </button>
                <button
                  type="button"
                  className="ws-shortcut-chip"
                  onClick={() => browse('/home/huseyina/code_mode')}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#e2e8f0',
                    fontSize: '11.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <TerminalIcon size={12} />
                  <span>code_mode</span>
                </button>
                <button
                  type="button"
                  className="ws-shortcut-chip"
                  onClick={() => browse(`${companyWorkspace}/finans`)}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#e2e8f0',
                    fontSize: '11.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <LedgerIcon size={12} />
                  <span>finans</span>
                </button>
                <button
                  type="button"
                  className="ws-shortcut-chip"
                  onClick={() => browse(`${companyWorkspace}/tedarik_ve_stok`)}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#e2e8f0',
                    fontSize: '11.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <FlowIcon size={12} />
                  <span>tedarik_ve_stok</span>
                </button>
                <button
                  type="button"
                  className="ws-shortcut-chip"
                  onClick={() => browse(`${companyWorkspace}/operasyon_ve_iadeler`)}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#e2e8f0',
                    fontSize: '11.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <FlowIcon size={12} />
                  <span>operasyon</span>
                </button>
                <button
                  type="button"
                  className="ws-shortcut-chip"
                  onClick={() => browse('/mnt/nvmes/nvme1/RAG-data')}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#34d399',
                    fontSize: '11.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <KnowledgeIcon size={12} />
                  <span>RAG-data</span>
                </button>
              </div>

              {/* Max Files Limit Selector */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>🎯 Dosya Limiti:</span>
                <input
                  type="number"
                  min="1"
                  step="10"
                  style={{ width: '75px', padding: '3px 6px', fontSize: '12px', textAlign: 'center', borderRadius: '4px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc' }}
                  placeholder="Sınırsız"
                  value={config.maxFiles || ''}
                  onChange={(e) => setConfig({ ...config, maxFiles: e.target.value ? Number(e.target.value) : undefined })}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, maxFiles: 100 })}
                    style={{ cursor: 'pointer', padding: '2px 7px', fontSize: '11px', borderRadius: '4px', background: config.maxFiles === 100 ? '#6366f1' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
                  >
                    100
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, maxFiles: 500 })}
                    style={{ cursor: 'pointer', padding: '2px 7px', fontSize: '11px', borderRadius: '4px', background: config.maxFiles === 500 ? '#6366f1' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
                  >
                    500
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, maxFiles: undefined })}
                    style={{ cursor: 'pointer', padding: '2px 7px', fontSize: '11px', borderRadius: '4px', background: !config.maxFiles ? '#10b981' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
                  >
                    Tümü
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Folder & File Explorer */}
            <div className="ws-browser-section" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px' }}>
              <div className="ws-browser-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Açık Dizin:</span>
                  <code style={{ color: '#38bdf8', fontSize: '12.5px', fontWeight: 600 }}>{browsePath}</code>
                  {isBrowsing && <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '6px' }}>⏳ Taranıyor...</span>}
                </div>

                <input
                  type="text"
                  placeholder="Filtrele..."
                  style={{ width: '160px', padding: '3px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #334155', background: '#1e293b', color: '#f8fafc' }}
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                />
              </div>

              <div className="ws-dir-list" style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Parent Directory Link (Always available if not at root) */}
                {parentPath && parentPath !== browsePath && (
                  <div
                    className="ws-dir-item parent-dir"
                    onClick={navigateToParent}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)' }}
                  >
                    <span className="ws-dir-icon">📁</span>
                    <span className="ws-dir-name" style={{ color: '#93c5fd', fontWeight: 600, fontSize: '12.5px' }}>.. (Üst Dizine Çık)</span>
                  </div>
                )}

                {/* Subdirectories */}
                {filteredDirs.map((dir) => (
                  <div
                    key={`dir_${dir}`}
                    className={`ws-dir-item ${newFolderPath === `${browsePath}/${dir}` ? 'selected' : ''}`}
                    onClick={() => navigateTo(dir)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', transition: 'background 0.15s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ws-dir-icon">📂</span>
                      <span className="ws-dir-name" style={{ color: '#f8fafc', fontSize: '13px' }}>{dir}/</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleIndexTarget(`${browsePath}/${dir}`)
                        }}
                        style={{ cursor: 'pointer', padding: '2px 8px', fontSize: '11px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#60a5fa' }}
                        title="Bu alt klasörü doğrudan indeksle"
                      >
                        ⚡ İndeksle
                      </button>
                      <span className="ws-dir-action" style={{ fontSize: '12px', color: '#64748b' }}>Aç →</span>
                    </div>
                  </div>
                ))}

                {/* Individual Files (PDF, Images, Code, Docs) */}
                {filteredFiles.map((file) => {
                  const filePath = browsePath === '/' ? `/${file}` : `${browsePath}/${file}`
                  const isSelected = newFolderPath === filePath
                  const ext = file.split('.').pop()?.toLowerCase() || ''
                  let icon = '📄'
                  let tag = 'Dosya'
                  let tagColor = '#94a3b8'
                  if (ext === 'pdf') { icon = '📑'; tag = 'PDF'; tagColor = '#f87171' }
                  else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) { icon = '🖼️'; tag = 'OCR Görsel'; tagColor = '#fbbf24' }
                  else if (['ts', 'tsx', 'js', 'py', 'json', 'md', 'html', 'css'].includes(ext)) { icon = '💻'; tag = 'Kod'; tagColor = '#60a5fa' }
                  else if (['csv', 'xlsx'].includes(ext)) { icon = '📊'; tag = 'Veri'; tagColor = '#34d399' }

                  return (
                    <div
                      key={`file_${file}`}
                      className={`ws-dir-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setNewFolderPath(filePath)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span className="ws-dir-icon">{icon}</span>
                        <span className="ws-dir-name" style={{ color: isSelected ? '#38bdf8' : '#e2e8f0', fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file}
                        </span>
                        <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: tagColor, border: `1px solid ${tagColor}44` }}>
                          {tag}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {ext === 'md' && onOpenFile && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenFile(filePath)
                            }}
                            style={{ cursor: 'pointer', padding: '2px 6px', fontSize: '11px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #34d399', color: '#34d399' }}
                          >
                            Görüntüle 📄
                          </button>
                        )}
                        <span style={{ fontSize: '11px', color: isSelected ? '#38bdf8' : '#64748b' }}>
                          {isSelected ? '✓ Seçildi' : 'Seç'}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {filteredDirs.length === 0 && filteredFiles.length === 0 && !isBrowsing && (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '12.5px' }}>
                    Bu dizinde dosya veya alt klasör bulunamadı.
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8' }}>
              💡 <b>İster tek bir PDF/görsel/kod dosyasını</b> tıklayıp seçin, ister tüm klasörü tek seferde indeksleyin.
              PDF metinleri ve <code>zai-org/GLM-OCR</code> görsel OCR ayrıştırması otomatik yapılır.
            </div>
          </div>

          {/* Indexed Sources List */}
          <div
            className="rag-sources-list"
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '18px 20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '13.5px' }}>
                İndekslenen Kaynaklar ({ragStatus?.sources?.length || 0})
              </span>
              {ragStatus?.sources?.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <TrashIcon size={12} />
                  <span>Tümünü Temizle</span>
                </button>
              )}
            </div>

            {(!ragStatus?.sources || ragStatus.sources.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', fontSize: '13px' }}>
                Henüz indekslenmiş bir RAG klasörü veya dosyası bulunmuyor. Yukarıdan bir klasör seçip "Seçiliyi İndeksle" butonuna basın.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ragStatus.sources.map((src: any) => {
                  const isEditingThis = editingPermSourceId === src.id

                  return (
                    <div
                      key={src.id || src.path}
                      style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <KnowledgeIcon size={14} color="#38bdf8" />
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>
                              {src.path || src.id}
                            </span>
                            {src.isPublic ? (
                              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                Genel Erişim
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                Özel Yetkili ({src.allowedUserIds?.filter((u: string) => u !== '*').length || 0} Rol)
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '14px', fontSize: '11.5px', color: '#94a3b8' }}>
                            <span>{src.fileCount || 1} dosya</span>
                            <span>•</span>
                            <span>{src.chunkCount || 0} vektör</span>
                            <span>•</span>
                            <span>{src.lastIndexedAt ? new Date(src.lastIndexedAt).toLocaleDateString('tr-TR') : 'Bugün'}</span>
                            <span>•</span>
                            <span style={{ color: src.status === 'indexed' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{src.status === 'indexed' ? 'İndekslendi' : src.status || 'Aktif'}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => isEditingThis ? setEditingPermSourceId(null) : handleOpenPermissions(src)}
                            style={{
                              cursor: 'pointer',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#e2e8f0',
                              fontSize: '11.5px',
                              fontWeight: 600
                            }}
                          >
                            {isEditingThis ? '✕ Kapat' : 'İzin Ayarla'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSource(src.id || src.path)}
                            style={{
                              cursor: 'pointer',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: 'transparent',
                              border: 'none',
                              color: '#f87171',
                              fontSize: '11.5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Kaynağı Sil"
                          >
                            <TrashIcon size={12} />
                            <span>Sil</span>
                          </button>
                        </div>
                      </div>

                      {/* Permission Editor Drawer */}
                      {isEditingThis && (
                        <div style={{
                          marginTop: '8px',
                          padding: '12px',
                          background: 'rgba(0, 0, 0, 0.35)',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d8b4fe', marginBottom: '8px' }}>
                            🛡️ Bu RAG Kaynağının Erişim Yetkilerini Belirleyin:
                          </div>

                          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ececec', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={`perm_mode_${src.id}`}
                                checked={permIsPublic}
                                onChange={() => setPermIsPublic(true)}
                              />
                              <span>🌐 Herkese Açık (Tüm Kullanıcılar / Departmanlar Görebilir)</span>
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
                                        background: isAllowed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${isAllowed ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
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
                            <button
                              type="button"
                              onClick={() => setEditingPermSourceId(null)}
                              style={{ cursor: 'pointer', padding: '4px 10px', borderRadius: '4px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', fontSize: '11.5px' }}
                            >
                              İptal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSavePermissions(src.id)}
                              disabled={isSavingPerms}
                              style={{ cursor: 'pointer', padding: '4px 12px', borderRadius: '4px', background: '#8b5cf6', border: 'none', color: '#fff', fontSize: '11.5px', fontWeight: 600 }}
                            >
                              {isSavingPerms ? 'Kaydediliyor...' : '💾 İzinleri Kaydet'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE MULTIMODAL SEARCH (TEXT & SIGLIP IMAGE) */}
      {activeTab === 'search' && (
        <div className="rag-tab-content">
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '18px 20px',
              marginBottom: '16px'
            }}
          >
            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => { setSearchMode('text'); setSearchResults([]); }}
                style={{
                  cursor: 'pointer',
                  padding: '7px 15px',
                  borderRadius: '7px',
                  border: searchMode === 'text' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: searchMode === 'text' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  color: searchMode === 'text' ? '#c7d2fe' : '#94a3b8',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <TerminalIcon size={13} />
                <span>Metin & Kod Arama (Qwen3)</span>
              </button>
              <button
                type="button"
                onClick={() => { setSearchMode('image'); setSearchResults([]); }}
                style={{
                  cursor: 'pointer',
                  padding: '7px 15px',
                  borderRadius: '7px',
                  border: searchMode === 'image' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: searchMode === 'image' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: searchMode === 'image' ? '#7dd3fc' : '#94a3b8',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FlowIcon size={13} />
                <span>Görsel / Şema Arama (SigLIP)</span>
              </button>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleTestSearch} style={{ display: 'flex', gap: '10px' }}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '4px 12px'
                }}
              >
                <SearchIcon size={15} color="#94a3b8" />
                <input
                  type="text"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    padding: '6px 0'
                  }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchMode === 'image'
                      ? "Görsel veya şema açıklamasını yazın (örn: 'auth akışı mimari şeması', 'stok rapor grafiği')..."
                      : "Semantik olarak aramak istediğiniz kavram veya kod fonksiyonunu yazın (örn: 'gecikme cezaları', 'kritik stok')..."
                  }
                />
              </div>

              <select
                style={{
                  width: '110px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.4)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                value={searchTopK}
                onChange={(e) => setSearchTopK(Number(e.target.value))}
              >
                <option value={3}>3 Sonuç</option>
                <option value={5}>5 Sonuç</option>
                <option value={6}>6 Sonuç</option>
                <option value={10}>10 Sonuç</option>
                <option value={20}>20 Sonuç</option>
              </select>

              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="btn-primary"
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <SearchIcon size={14} />
                <span>{isSearching ? 'Aranıyor...' : 'Semantik Ara'}</span>
              </button>
            </form>
          </div>

          {/* Results Container */}
          <div className="rag-results-container">
            {searchError && (
              <div className="rag-search-error" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px' }}>
                ⚠️ {searchError}
              </div>
            )}

            {searchResults.length === 0 && !isSearching && !searchError && (
              <div style={{ textAlign: 'center', padding: '40px', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧠</div>
                <p style={{ fontWeight: 600, color: '#f8fafc', margin: '0 0 4px 0' }}>Çok Modlu Canlı RAG Laboratuvarı</p>
                <p style={{ fontSize: '13px', margin: 0 }}>
                  Ajanların arka planda kullandığı <code>rag_query</code> ve <code>rag_image_query</code> araçlarının aynısını doğrudan test edin.
                </p>
              </div>
            )}

            {searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {searchResults.map((res: any, idx: number) => {
                  const score = res.similarity ?? res.score ?? 0
                  const scorePct = Math.round(score * 100)

                  if (searchMode === 'image') {
                    return (
                      <div
                        key={res.filePath || idx}
                        style={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '12px',
                          display: 'flex',
                          gap: '14px',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ width: '70px', height: '70px', background: '#0f172a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                          🖼️
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f8fafc', fontSize: '13px', wordBreak: 'break-all' }}>
                              {res.filePath || res.sourcePath}
                            </span>
                            <span style={{ background: '#10b98122', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                              Görsel Benzerlik: %{scorePct}
                            </span>
                          </div>
                          {res.ocrText && (
                            <div style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.03)', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <b>GLM-OCR:</b> {res.ocrText}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={res.id || idx}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px' }}>📄</span>
                          <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontSize: '12.5px', fontWeight: 600 }}>
                            {res.filePath || res.sourcePath || 'Bilinmeyen Dosya'}
                          </span>
                          {res.chunkIndex !== undefined && (
                            <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>
                              Chunk #{res.chunkIndex}
                            </span>
                          )}
                        </div>
                        <span style={{ background: scorePct >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: scorePct >= 80 ? '#34d399' : '#60a5fa', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                          %{scorePct} Benzerlik
                        </span>
                      </div>

                      <pre style={{ margin: 0, padding: '8px 10px', background: '#0f172a', borderRadius: '6px', color: '#e2e8f0', fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
                        {res.text || res.content}
                      </pre>

                      {res.filePath && onOpenFile && res.filePath.endsWith('.md') && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => onOpenFile(res.filePath)}
                            style={{ cursor: 'pointer', padding: '3px 8px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #34d399', color: '#34d399', fontSize: '11.5px' }}
                          >
                            📄 Dosyayı Aç
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CONFIG & vLLM SYSTEM RESOURCES */}
      {activeTab === 'config' && (
        <div className="rag-tab-content">
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
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

            {/* Worker Concurrency Slider */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>
                İndeksleme Modu & Paralel Worker Sayısı ({workerCount} Eşzamanlı Worker)
              </label>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                style={{ width: '100%' }}
                value={workerCount}
                onChange={(e) => {
                  const count = Number(e.target.value)
                  setWorkerCount(count)
                  setConfig({ ...config, workerConcurrency: count })
                }}
              />
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                Büyük veri setlerinde aynı anda çalışan bağımsız kuyruk işlemcisi sayısı (Önerilen Turbo: 8 Worker).
              </div>
            </div>

            {/* Endpoints & Models Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
                  vLLM Embedding Endpoint
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12.5px' }}
                  value={config.embeddingEndpoint}
                  onChange={(e) => setConfig({ ...config, embeddingEndpoint: e.target.value })}
                  placeholder="http://localhost:8001/v1"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
                  vLLM Embedding Modeli
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12.5px' }}
                  value={config.embeddingModel}
                  onChange={(e) => setConfig({ ...config, embeddingModel: e.target.value })}
                  placeholder="Qwen/Qwen3-Embedding-0.6B"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
                  vLLM Vision OCR Endpoint (Port 8010)
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12.5px' }}
                  value={config.visionEndpoint}
                  onChange={(e) => setConfig({ ...config, visionEndpoint: e.target.value })}
                  placeholder="http://localhost:8010/v1"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
                  vLLM Vision OCR Modeli (Görseller & Taranmış PDF'ler)
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12.5px' }}
                  value={config.visionModel}
                  onChange={(e) => setConfig({ ...config, visionModel: e.target.value })}
                  placeholder="zai-org/GLM-OCR"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
                  vLLM Neural Reranker Endpoint (Port 8006)
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12.5px' }}
                  value={config.rerankerEndpoint}
                  onChange={(e) => setConfig({ ...config, rerankerEndpoint: e.target.value })}
                  placeholder="http://localhost:8006/v1/rerank"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
                  vLLM Neural Reranker Modeli
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12.5px' }}
                  value={config.rerankerModel}
                  onChange={(e) => setConfig({ ...config, rerankerModel: e.target.value })}
                  placeholder="Qwen/Qwen3-Reranker-0.6B"
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
                  SigLIP Görsel Arama Endpoint (Vision Embeddings - Port 8011)
                </label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12.5px' }}
                  value={config.imageSearchEndpoint}
                  onChange={(e) => setConfig({ ...config, imageSearchEndpoint: e.target.value })}
                  placeholder="http://localhost:8011"
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  768-boyutlu SigLIP çok modlu görsel arama servis uç noktası.
                </div>
              </div>
            </div>

            {/* Batch & Bulk Insert Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#f8fafc', marginBottom: '4px', fontWeight: 600 }}>
                  Embedding Batch Boyutu ({config.batchSize} chunk / istek)
                </label>
                <input
                  type="range"
                  min="8"
                  max="256"
                  step="8"
                  style={{ width: '100%' }}
                  value={config.batchSize}
                  onChange={(e) => setConfig({ ...config, batchSize: Number(e.target.value) })}
                />
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  vLLM'e tek seferde gönderilen vektör parçası sayısı (Önerilen: 32-64).
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#f8fafc', marginBottom: '4px', fontWeight: 600 }}>
                  pgvector Toplu Kayıt Boyutu ({config.bulkInsertSize} chunk / SQL)
                </label>
                <input
                  type="range"
                  min="20"
                  max="500"
                  step="20"
                  style={{ width: '100%' }}
                  value={config.bulkInsertSize}
                  onChange={(e) => setConfig({ ...config, bulkInsertSize: Number(e.target.value) })}
                />
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  PostgreSQL veritabanına tek sorguda toplu yazılan vektör miktarı (Önerilen: 100-200).
                </div>
              </div>
            </div>

            {/* Chunk Size & Overlap */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
                  Doküman Chunk Boyutu (Karakter)
                </label>
                <input
                  type="number"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12.5px' }}
                  value={config.chunkSize}
                  onChange={(e) => setConfig({ ...config, chunkSize: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
                  Chunk Örtüşme / Overlap (Karakter)
                </label>
                <input
                  type="number"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12.5px' }}
                  value={config.chunkOverlap}
                  onChange={(e) => setConfig({ ...config, chunkOverlap: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* GPU Throttling Slider */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', color: '#f8fafc', marginBottom: '4px', fontWeight: 600 }}>
                GPU Throttling / Dinlendirme Gecikmesi ({config.throttleDelayMs} ms)
              </label>
              <input
                type="range"
                min="0"
                max="500"
                step="25"
                style={{ width: '100%' }}
                value={config.throttleDelayMs}
                onChange={(e) => setConfig({ ...config, throttleDelayMs: Number(e.target.value) })}
              />
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Her dosya sonrasında GPU VRAM'in boşaltılması ve ısınmayı önlemek için bekleme süresi (Normalde 0 ms).
              </div>
            </div>

            {/* Skip Existing Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <input
                type="checkbox"
                id="skipExistingUnchanged"
                checked={config.skipExistingUnchanged}
                onChange={(e) => setConfig({ ...config, skipExistingUnchanged: e.target.checked })}
              />
              <label htmlFor="skipExistingUnchanged" style={{ cursor: 'pointer', fontSize: '12.5px', color: '#e2e8f0', fontWeight: 500 }}>
                ⚡ Değişmeyen Dokümanları Atla (Content-Hash Resume / Sıfır Maliyetli Yeniden Tarama)
              </label>
            </div>

            {/* Save Config Button */}
            <button
              type="button"
              onClick={handleSaveConfig}
              style={{ cursor: 'pointer', padding: '9px 20px', borderRadius: '6px', background: '#3b82f6', border: 'none', color: '#fff', fontWeight: 600, fontSize: '13px' }}
            >
              Ayarları Kaydet & Uygula
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
