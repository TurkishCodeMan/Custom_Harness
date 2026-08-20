import React, { useState, useEffect } from 'react'
import { Modal, Button, Badge } from '@custom-harness/client-ui-primitives'
import type { UploadedAttachment } from '@custom-harness/client-ui-conversation'

export { UploadedAttachment }

export interface MyFilesModalProps {
  isOpen: boolean
  onClose: () => void
  onAttachFile: (file: UploadedAttachment) => void
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void
  currentUser?: any
  onUploadFiles?: (files: File[]) => void
}

export function MyFilesModal({
  isOpen,
  onClose,
  onAttachFile,
  onShowToast,
  currentUser,
  onUploadFiles
}: MyFilesModalProps) {
  const [files, setFiles] = useState<UploadedAttachment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'spreadsheet' | 'pdf' | 'image' | 'document'>('all')

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    const token = localStorage.getItem('artificax_jwt_token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    if (currentUser?.id) {
      headers['X-User-Id'] = currentUser.id
    }
    return headers
  }

  const loadMyFiles = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/files/my-files', {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data && Array.isArray(data.files)) {
        setFiles(data.files)
      } else {
        setFiles([])
      }
    } catch (e: any) {
      console.error('[Load My Files Error]:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadMyFiles()
    }
  }, [isOpen, currentUser?.id])

  const handleDeleteFile = async (filePath: string, fileName: string) => {
    if (!window.confirm(`"${fileName}" dosyasını silmek istediğinizden emin misiniz?`)) return
    try {
      const res = await fetch('/api/files/my-files', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ filePath })
      })
      const data = await res.json()
      if (data.success) {
        onShowToast(`"${fileName}" dosyası silindi`, 'info')
        setFiles(prev => prev.filter(f => f.filePath !== filePath))
      } else {
        onShowToast(`Silinemedi: ${data.error}`, 'error')
      }
    } catch (e: any) {
      onShowToast(`Hata: ${e.message}`, 'error')
    }
  }

  const handleAttach = (file: UploadedAttachment) => {
    onAttachFile(file)
    onShowToast(`✓ "${file.fileName}" sohbete bağlandı`, 'success')
    onClose()
  }

  const filteredFiles = files.filter(f => {
    const matchesSearch = f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.summary && f.summary.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = categoryFilter === 'all' || f.fileCategory === categoryFilter
    return matchesSearch && matchesCategory
  })

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'spreadsheet': return '📊'
      case 'pdf': return '📕'
      case 'image': return '🖼️'
      case 'code': return '💻'
      default: return '📄'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📁 Dosyalarım (Kayıtlı Yüklemeler)"
      maxWidth="780px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Top bar: Search & Filters */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px', width: '100%', margin: 0 }}
              placeholder="Dosya adına veya içeriğe göre ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: '13px' }}>
              🔍
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'spreadsheet', 'pdf', 'image', 'document'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: categoryFilter === cat ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  background: categoryFilter === cat ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.5)',
                  color: categoryFilter === cat ? '#c7d2fe' : '#94a3b8',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat === 'all' ? 'Tümü' : cat === 'spreadsheet' ? '📊 Excel/CSV' : cat === 'pdf' ? '📕 PDF' : cat === 'image' ? '🖼️ Görsel' : '📄 Metin'}
              </button>
            ))}
          </div>
        </div>

        {/* File Count & Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8', padding: '0 2px' }}>
          <span>
            Toplam <b>{filteredFiles.length}</b> dosya bulundu (Kiracı: <code style={{ color: '#818cf8' }}>{currentUser?.name || currentUser?.id}</code>)
          </span>
          <Button size="sm" variant="secondary" onClick={loadMyFiles} disabled={isLoading}>
            {isLoading ? 'Yenileniyor...' : '🔄 Yenile'}
          </Button>
        </div>

        {/* Files Grid / List */}
        {filteredFiles.length === 0 && !isLoading && (
          <div className="ws-empty-hint" style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
            <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px', marginBottom: '4px' }}>
              {searchQuery ? 'Aramanıza uygun dosya bulunamadı' : 'Henüz yüklenmiş bir dosyanız bulunmuyor'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Sohbet ekranındaki ataş butonuyla veya sürükle-bırak yöntemiyle dosya yükleyebilirsiniz.
            </div>
          </div>
        )}

        <div style={{
          maxHeight: '440px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '4px'
        }}>
          {filteredFiles.map(file => (
            <div
              key={file.filePath || file.id}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                transition: 'border-color 0.15s ease, background 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '22px',
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.06)',
                  flexShrink: 0
                }}>
                  {getCategoryIcon(file.fileCategory)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13.5px' }} title={file.fileName}>
                      {file.fileName}
                    </span>
                    <span style={{
                      fontSize: '10.5px',
                      background: 'rgba(99, 102, 241, 0.18)',
                      color: '#a5b4fc',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid rgba(99, 102, 241, 0.25)'
                    }}>
                      {file.fileCategory.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {formatFileSize(file.fileSize)}
                    </span>
                    {file.uploadedAt && (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        · {new Date(file.uploadedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {file.summary && (
                    <div style={{
                      fontSize: '11.5px',
                      color: '#94a3b8',
                      lineHeight: '1.4',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '520px'
                    }}>
                      {file.summary}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAttach(file)}
                  title="Bu dosyayı aktif sohbete bağla"
                >
                  📎 Sohbete Ekle
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteFile(file.filePath, file.fileName)}
                  title="Dosyayı Sil"
                >
                  🗑️
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
