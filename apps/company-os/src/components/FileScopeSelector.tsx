import React, { useState, useEffect, useMemo } from 'react'
import type { FileScopeConfig } from '../types.js'
import { browseWorkspace } from '../api.js'

interface FileScopeSelectorProps {
  workspace: string
  fileScope?: FileScopeConfig
  onChange: (newScope: FileScopeConfig | undefined) => void
}

export const FileScopeSelector: React.FC<FileScopeSelectorProps> = ({
  workspace,
  fileScope,
  onChange
}) => {
  const [discoveredFolders, setDiscoveredFolders] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [customPattern, setCustomPattern] = useState('')
  const [customType, setCustomType] = useState<'read' | 'write' | 'deny'>('read')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Current scope lists
  const readList = useMemo(() => fileScope?.read || [], [fileScope?.read])
  const writeList = useMemo(() => fileScope?.write || [], [fileScope?.write])
  const denyList = useMemo(() => fileScope?.deny || [], [fileScope?.deny])

  // Scan workspace for directories (both 1st and 2nd level folders)
  useEffect(() => {
    let isMounted = true
    if (!workspace) return

    setIsLoading(true)
    browseWorkspace(workspace, { recursive: true })
      .then(res => {
        if (!isMounted) return
        const folderSet = new Set<string>()

        // 1. Top-level directories
        if (res?.directories) {
          for (const d of res.directories) {
            folderSet.add(d)
          }
        }

        // 2. Sub-directories from allFiles
        if (res?.allFiles) {
          for (const f of res.allFiles) {
            const parts = f.relativePath.split('/')
            if (parts.length > 1) {
              // Add parent folder (e.g. finance/invoices)
              folderSet.add(parts[0])
              if (parts.length > 2) {
                folderSet.add(`${parts[0]}/${parts[1]}`)
              }
            }
          }
        }

        const sorted = Array.from(folderSet).sort()
        setDiscoveredFolders(sorted)
      })
      .catch(err => {
        console.warn('[FileScopeSelector] Folder browse error:', err)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [workspace])

  // Helper to commit changes
  const updateLists = (
    newRead: string[],
    newWrite: string[],
    newDeny: string[]
  ) => {
    const cleanRead = Array.from(new Set(newRead.filter(Boolean)))
    const cleanWrite = Array.from(new Set(newWrite.filter(Boolean)))
    const cleanDeny = Array.from(new Set(newDeny.filter(Boolean)))

    if (cleanRead.length === 0 && cleanWrite.length === 0 && cleanDeny.length === 0) {
      onChange(undefined)
    } else {
      onChange({
        read: cleanRead.length > 0 ? cleanRead : undefined,
        write: cleanWrite.length > 0 ? cleanWrite : undefined,
        deny: cleanDeny.length > 0 ? cleanDeny : undefined
      })
    }
  }

  // Check if a pattern or folder is included
  const isFolderIn = (list: string[], folder: string) => {
    return list.some(pat => pat === `${folder}/**` || pat === folder || pat === `${folder}/*`)
  }

  const toggleFolder = (folder: string, type: 'read' | 'write' | 'deny') => {
    const pat = `${folder}/**`

    let newRead = [...readList]
    let newWrite = [...writeList]
    let newDeny = [...denyList]

    if (type === 'read') {
      if (isFolderIn(readList, folder)) {
        newRead = newRead.filter(p => p !== pat && p !== folder && p !== `${folder}/*`)
      } else {
        newRead.push(pat)
        // If it was denied, remove from deny
        newDeny = newDeny.filter(p => p !== pat && p !== folder && p !== `${folder}/*`)
      }
    } else if (type === 'write') {
      if (isFolderIn(writeList, folder)) {
        newWrite = newWrite.filter(p => p !== pat && p !== folder && p !== `${folder}/*`)
      } else {
        newWrite.push(pat)
        // Write implies read as well for convenience
        if (!isFolderIn(newRead, folder) && !newRead.includes('**')) {
          newRead.push(pat)
        }
        newDeny = newDeny.filter(p => p !== pat && p !== folder && p !== `${folder}/*`)
      }
    } else if (type === 'deny') {
      if (isFolderIn(denyList, folder)) {
        newDeny = newDeny.filter(p => p !== pat && p !== folder && p !== `${folder}/*`)
      } else {
        newDeny.push(pat)
        // Remove from read and write
        newRead = newRead.filter(p => p !== pat && p !== folder && p !== `${folder}/*`)
        newWrite = newWrite.filter(p => p !== pat && p !== folder && p !== `${folder}/*`)
      }
    }

    updateLists(newRead, newWrite, newDeny)
  }

  const removePattern = (pat: string, type: 'read' | 'write' | 'deny') => {
    if (type === 'read') {
      updateLists(readList.filter(p => p !== pat), writeList, denyList)
    } else if (type === 'write') {
      updateLists(readList, writeList.filter(p => p !== pat), denyList)
    } else {
      updateLists(readList, writeList, denyList.filter(p => p !== pat))
    }
  }

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = customPattern.trim()
    if (!trimmed) return

    if (customType === 'read') {
      updateLists([...readList, trimmed], writeList, denyList)
    } else if (customType === 'write') {
      updateLists(readList, [...writeList, trimmed], denyList)
    } else {
      updateLists(readList, writeList, [...denyList, trimmed])
    }
    setCustomPattern('')
  }

  const handleSetAllRead = () => {
    if (readList.includes('**')) {
      updateLists(readList.filter(p => p !== '**'), writeList, denyList)
    } else {
      updateLists(['**'], writeList, denyList)
    }
  }

  const handleClearAll = () => {
    onChange(undefined)
  }

  // Filter folders by search term
  const filteredFolders = useMemo(() => {
    if (!searchTerm.trim()) return discoveredFolders
    const lower = searchTerm.toLowerCase()
    return discoveredFolders.filter(f => f.toLowerCase().includes(lower))
  }, [discoveredFolders, searchTerm])

  const hasAllRead = readList.includes('**')

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      borderRadius: '8px',
      padding: '14px',
      marginTop: '16px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🛡️ Dosya İzin Sınırları (File Scope ACL)
          </span>
          <span style={{
            fontSize: '11px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#6ee7b7',
            padding: '1px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            {readList.length} Oku • {writeList.length} Yaz • {denyList.length} Yasak
          </span>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleSetAllRead}
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              background: hasAllRead ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${hasAllRead ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
              color: hasAllRead ? '#6ee7b7' : '#94a3b8'
            }}
            title="Tüm çalışma alanını okumaya aç"
          >
            {hasAllRead ? '✓ Tüm Çalışma Alanı (**) Açık' : '🌐 Tümünü Oku (**)'}
          </button>
          {(readList.length > 0 || writeList.length > 0 || denyList.length > 0) && (
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5'
              }}
            >
              🧹 Sıfırla
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '12px', lineHeight: 1.4 }}>
        Ajanın çalışma alanındaki klasörlere erişimini tiklerle seçin. Tanımlanmamış klasörler varsayılan güvenlik kuralına tabidir.
      </div>

      {/* Active Rules Badges Summary */}
      {(readList.length > 0 || writeList.length > 0 || denyList.length > 0) && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '8px 10px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {readList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#34d399', minWidth: '45px' }}>📖 READ:</span>
              {readList.map(pat => (
                <span
                  key={pat}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    background: 'rgba(16, 185, 129, 0.18)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {pat}
                  <button
                    type="button"
                    onClick={() => removePattern(pat, 'read')}
                    style={{ background: 'transparent', border: 'none', color: '#6ee7b7', cursor: 'pointer', padding: 0, fontSize: '11px', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {writeList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#38bdf8', minWidth: '45px' }}>✍️ WRITE:</span>
              {writeList.map(pat => (
                <span
                  key={pat}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    background: 'rgba(56, 189, 248, 0.18)',
                    color: '#bae6fd',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {pat}
                  <button
                    type="button"
                    onClick={() => removePattern(pat, 'write')}
                    style={{ background: 'transparent', border: 'none', color: '#bae6fd', cursor: 'pointer', padding: 0, fontSize: '11px', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {denyList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#f87171', minWidth: '45px' }}>🚫 DENY:</span>
              {denyList.map(pat => (
                <span
                  key={pat}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    background: 'rgba(239, 68, 68, 0.18)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {pat}
                  <button
                    type="button"
                    onClick={() => removePattern(pat, 'deny')}
                    style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0, fontSize: '11px', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Bar for Folders */}
      <div style={{ marginBottom: '8px' }}>
        <input
          type="text"
          className="form-input"
          style={{ fontSize: '12px', padding: '6px 10px', width: '100%' }}
          placeholder="🔍 Klasör ara (örn: finance, procurement, shared, cases)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Dynamic Folders Table / Checklist */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '6px',
        maxHeight: '260px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {isLoading ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
            ⏳ Çalışma alanı klasörleri taranıyor...
          </div>
        ) : filteredFolders.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
            {discoveredFolders.length === 0
              ? 'Çalışma alanında alt klasör bulunamadı.'
              : 'Arama kriterine uygun klasör bulunamadı.'}
          </div>
        ) : (
          filteredFolders.map(folder => {
            const isRead = hasAllRead || isFolderIn(readList, folder)
            const isWrite = isFolderIn(writeList, folder)
            const isDeny = isFolderIn(denyList, folder)

            return (
              <div
                key={folder}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  background: isDeny
                    ? 'rgba(239, 68, 68, 0.06)'
                    : isWrite
                    ? 'rgba(56, 189, 248, 0.06)'
                    : isRead
                    ? 'rgba(16, 185, 129, 0.06)'
                    : 'transparent',
                  gap: '8px'
                }}
              >
                {/* Folder Path & Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '13px' }}>📁</span>
                  <span className="mono" style={{
                    fontSize: '12px',
                    color: isDeny ? '#fca5a5' : isWrite ? '#bae6fd' : isRead ? '#6ee7b7' : '#e2e8f0',
                    fontWeight: isRead || isWrite || isDeny ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {folder}
                  </span>
                </div>

                {/* 3 Action Toggles */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                  {/* READ Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder, 'read')}
                    disabled={isDeny}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      cursor: isDeny ? 'not-allowed' : 'pointer',
                      opacity: isDeny ? 0.35 : 1,
                      background: isRead ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isRead ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: isRead ? '#6ee7b7' : '#94a3b8',
                      fontWeight: isRead ? 600 : 400
                    }}
                    title={`${folder} için okuma iznini aç/kapat`}
                  >
                    {isRead ? '✓ Oku' : 'Oku'}
                  </button>

                  {/* WRITE Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder, 'write')}
                    disabled={isDeny}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      cursor: isDeny ? 'not-allowed' : 'pointer',
                      opacity: isDeny ? 0.35 : 1,
                      background: isWrite ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isWrite ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: isWrite ? '#bae6fd' : '#94a3b8',
                      fontWeight: isWrite ? 600 : 400
                    }}
                    title={`${folder} için yazma/düzenleme iznini aç/kapat`}
                  >
                    {isWrite ? '✓ Yaz' : 'Yaz'}
                  </button>

                  {/* DENY Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder, 'deny')}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: isDeny ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isDeny ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: isDeny ? '#fca5a5' : '#94a3b8',
                      fontWeight: isDeny ? 600 : 400
                    }}
                    title={`${folder} erişimini tamamen engelle`}
                  >
                    {isDeny ? '✕ Yasak' : 'Yasak'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Advanced / Custom Glob input toggle */}
      <div style={{ marginTop: '10px' }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#38bdf8',
            fontSize: '11.5px',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          <span>⚙️ Gelişmiş Özel Kalıp / Wildcard Ekle (örn: <code>cases/*/agent_outputs/**</code>)</span>
        </button>

        {showAdvanced && (
          <form onSubmit={handleAddCustom} style={{
            marginTop: '8px',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as any)}
              className="form-select"
              style={{ fontSize: '11.5px', padding: '5px 8px', width: 'auto' }}
            >
              <option value="read">📖 READ (Oku)</option>
              <option value="write">✍️ WRITE (Yaz)</option>
              <option value="deny">🚫 DENY (Yasakla)</option>
            </select>
            <input
              type="text"
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
              placeholder="Örn: cases/*/agent_outputs/**, .env*"
              className="form-input mono"
              style={{ fontSize: '11.5px', padding: '5px 8px', flex: 1, minWidth: '160px' }}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ fontSize: '11.5px', padding: '5px 12px' }}
              disabled={!customPattern.trim()}
            >
              ➕ Ekle
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
