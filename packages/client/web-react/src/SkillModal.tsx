import React, { useState, useEffect } from 'react'
import { Modal, Button, Badge } from '@custom-harness/client-ui-primitives'

export interface SkillItem {
  id: string
  name: string
  description: string
  filePath?: string
  content?: string
  rawContent?: string
  ownerId?: string
  isGlobal?: boolean
  allowedUserIds?: string[]
  isPublic?: boolean
  enabled?: boolean
}

export interface SkillModalProps {
  isOpen: boolean
  onClose: () => void
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void
  currentUser?: any
  users?: any[]
}

export function SkillModal({ isOpen, onClose, onShowToast, currentUser, users = [] }: SkillModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'edit'>('list')
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null)
  const [togglingSkillId, setTogglingSkillId] = useState<string | null>(null)

  // Permissions state
  const [editingPermSkillId, setEditingPermSkillId] = useState<string | null>(null)
  const [permAllowedUsers, setPermAllowedUsers] = useState<string[]>([])
  const [permIsPublic, setPermIsPublic] = useState<boolean>(true)
  const [isSavingPerms, setIsSavingPerms] = useState<boolean>(false)

  // Form State
  const [skillId, setSkillId] = useState('')
  const [skillName, setSkillName] = useState('')
  const [skillDesc, setSkillDesc] = useState('')
  const [skillEnabled, setSkillEnabled] = useState<boolean>(true)
  const [rawContent, setRawContent] = useState('')
  const [isGlobal, setIsGlobal] = useState(false)
  const [editorMode, setEditorMode] = useState<'code' | 'preview'>('code')

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

  const defaultTemplate = (name: string, desc: string) => `---
name: ${name || 'yeni-beceri'}
description: ${desc || 'Bu becerinin ne yaptığı ve model tarafından ne zaman kullanılacağı'}
version: 1.0.0
---

# ${(name || 'YENİ BECERİ').toUpperCase()} Talimatları

Bu beceri aktif edildiğinde aşağıdaki kuralları ve adımları izleyin:

## 1. Amaç & Kapsam
${desc || 'Bu beceri modelin belirli bir işi uzmanlık seviyesinde tamamlamasını sağlar.'}

## 2. Talimatlar ve İş Akışı
1. Kullanıcıdan gelen isteği ve proje mimarisini analiz et.
2. Gereksinimlere göre en uygun çözümü planla.
3. Çıktıyı temiz, hatasız ve standartlara uygun olarak üret.
`

  const loadSkills = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/skills', {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setSkills(data)
      } else if (data && data.skills && Array.isArray(data.skills)) {
        setSkills(data.skills)
      }
    } catch (e: any) {
      console.error('[Load Skills Error]:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setEditingPermSkillId(null)
    setPermAllowedUsers([])
    if (isOpen) {
      loadSkills()
    } else {
      setActiveTab('list')
      setSelectedSkill(null)
    }
  }, [isOpen, currentUser?.id])

  const handleStartCreate = () => {
    const initialName = 'yeni-uzmanlik'
    const initialDesc = 'Özel görevler ve iş akışları için uzmanlık talimatı'
    setSkillId(initialName)
    setSkillName(initialName)
    setSkillDesc(initialDesc)
    setSkillEnabled(true)
    setIsGlobal(false)
    setRawContent(defaultTemplate(initialName, initialDesc))
    setSelectedSkill(null)
    setActiveTab('create')
  }

  const handleStartEdit = (skill: SkillItem) => {
    setSelectedSkill(skill)
    setSkillId(skill.id)
    setSkillName(skill.name || skill.id)
    setSkillDesc(skill.description || '')
    setSkillEnabled(skill.enabled !== false)
    setIsGlobal(Boolean(skill.isGlobal))
    setRawContent(skill.rawContent || defaultTemplate(skill.name || skill.id, skill.description || ''))
    setEditorMode('code')
    setActiveTab('edit')
  }

  const handleToggleSkill = async (skill: SkillItem) => {
    const nextState = skill.enabled === false ? true : false
    setTogglingSkillId(skill.id)
    // Optimistic UI update
    setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, enabled: nextState } : s))

    try {
      const res = await fetch(`/api/skills/${skill.id}/toggle`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled: nextState })
      })
      const data = await res.json()
      if (data.success) {
        onShowToast(
          nextState
            ? `🟢 "${skill.name || skill.id}" becerisi AÇILDI (ON) - Artık model tarafından kullanılabilir`
            : `⚪ "${skill.name || skill.id}" becerisi KAPATILDI (OFF) - Modelin önünden kaldırıldı`,
          nextState ? 'success' : 'info'
        )
      } else {
        // Rollback
        setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, enabled: !nextState } : s))
        onShowToast(`Durum değiştirme hatası: ${data.error || 'İşlem başarısız'}`, 'error')
      }
    } catch (e: any) {
      setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, enabled: !nextState } : s))
      onShowToast(`Hata: ${e.message}`, 'error')
    } finally {
      setTogglingSkillId(null)
    }
  }

  const handleOpenPermissionEditor = (skill: SkillItem) => {
    if (editingPermSkillId === skill.id) {
      setEditingPermSkillId(null)
      return
    }
    setEditingPermSkillId(skill.id)
    setPermIsPublic(skill.isPublic !== false)
    const allowed = (skill.allowedUserIds || []).filter((u: string) => u !== '*')
    setPermAllowedUsers(allowed)
  }

  const handleSavePermissions = async (targetSkillId: string) => {
    setIsSavingPerms(true)
    try {
      const res = await fetch('/api/skills/permissions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          skillId: targetSkillId,
          allowedUserIds: permIsPublic ? ['*'] : permAllowedUsers,
          isPublic: permIsPublic
        })
      })
      const data = await res.json()
      if (data.success) {
        onShowToast('✓ Beceri erişim izinleri başarıyla güncellendi', 'success')
        setEditingPermSkillId(null)
        loadSkills()
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

  const handleSaveSkill = async () => {
    let effectiveName = skillName.trim()
    let effectiveDesc = skillDesc.trim()
    if (rawContent.startsWith('---')) {
      const matchName = rawContent.match(/^name:\s*(.+)$/m)
      if (matchName && matchName[1]) {
        effectiveName = matchName[1].trim().replace(/^['"]|['"]$/g, '')
      }
      const matchDesc = rawContent.match(/^description:\s*(.+)$/m)
      if (matchDesc && matchDesc[1]) {
        effectiveDesc = matchDesc[1].trim().replace(/^['"]|['"]$/g, '')
      }
    }

    const effectiveId = (effectiveName || skillId || 'custom-skill').toLowerCase().replace(/[^a-z0-9_-]/g, '-')

    if (!effectiveName && !effectiveId) {
      onShowToast('Lütfen bir beceri adı veya ID girin', 'info')
      return
    }

    setIsLoading(true)
    try {
      if (activeTab === 'edit' && selectedSkill) {
        const res = await fetch(`/api/skills/${selectedSkill.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: effectiveName,
            description: effectiveDesc,
            rawContent,
            enabled: skillEnabled
          })
        })
        const data = await res.json()
        if (data.success) {
          onShowToast(`✓ "${effectiveName}" becerisi başarıyla güncellendi`, 'success')
          await loadSkills()
          setActiveTab('list')
        } else {
          onShowToast(`Hata: ${data.error || 'Güncellenemedi'}`, 'error')
        }
      } else {
        const res = await fetch('/api/skills', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id: effectiveId,
            name: effectiveName,
            description: effectiveDesc,
            rawContent,
            isGlobal: Boolean(isGlobal && currentUser?.role === 'admin'),
            enabled: skillEnabled
          })
        })
        const data = await res.json()
        if (data.success) {
          onShowToast(`✓ "${effectiveName}" becerisi başarıyla oluşturuldu`, 'success')
          await loadSkills()
          setActiveTab('list')
        } else {
          onShowToast(`Hata: ${data.error || 'Oluşturulamadı'}`, 'error')
        }
      }
    } catch (e: any) {
      onShowToast(`İşlem hatası: ${e.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSkill = async (skill: SkillItem) => {
    if (!confirm(`"${skill.name || skill.id}" becerisini silmek istediğinize emin misiniz?`)) return

    try {
      const res = await fetch(`/api/skills/${skill.id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data.success) {
        onShowToast(`"${skill.name || skill.id}" silindi`, 'info')
        await loadSkills()
      } else {
        onShowToast(`Silme hatası: ${data.error || 'Silinemedi'}`, 'error')
      }
    } catch (e: any) {
      onShowToast(`Silme hatası: ${e.message}`, 'error')
    }
  }

  // Synchronize Form input edits into rawContent frontmatter
  const updateFrontmatterFromInputs = (newName: string, newDesc: string) => {
    setSkillName(newName)
    setSkillDesc(newDesc)
    const slug = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    setSkillId(slug)

    if (rawContent.startsWith('---')) {
      const parts = rawContent.split('---')
      if (parts.length >= 3) {
        const body = parts.slice(2).join('---')
        setRawContent(`---
name: ${newName}
description: ${newDesc}
version: 1.0.0
---${body}`)
        return
      }
    }
    setRawContent(defaultTemplate(newName, newDesc))
  }

  const handleRawContentChange = (newRaw: string) => {
    setRawContent(newRaw)
    if (newRaw.startsWith('---')) {
      const matchName = newRaw.match(/^name:\s*(.+)$/m)
      if (matchName && matchName[1]) {
        const parsedName = matchName[1].trim().replace(/^['"]|['"]$/g, '')
        setSkillName(parsedName)
        setSkillId(parsedName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))
      }
      const matchDesc = newRaw.match(/^description:\s*(.+)$/m)
      if (matchDesc && matchDesc[1]) {
        setSkillDesc(matchDesc[1].trim().replace(/^['"]|['"]$/g, ''))
      }
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="✨ Uzmanlık Becerileri (Skills) Yönetimi"
      maxWidth="960px"
      height="88vh"
    >
      <div className="rag-modal-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Navigation Tabs */}
        <div className="rag-tabs-header">
          <button
            type="button"
            className={`rag-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            📁 Mevcut Beceriler ({skills.length})
          </button>
          <button
            type="button"
            className={`rag-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={handleStartCreate}
          >
            ✨ Yeni Beceri Tanımla
          </button>
          {activeTab === 'edit' && (
            <button
              type="button"
              className="rag-tab-btn active"
            >
              📝 Beceriyi Düzenle ({selectedSkill?.name || selectedSkill?.id})
            </button>
          )}
        </div>

        {/* TAB 1: LIST OF SKILLS */}
        {activeTab === 'list' && (
          <div className="rag-tab-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px' }}>Yüklü Ajan Becerileri</span>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Model bu becerileri ihtiyaç duyduğunda otomatik olarak çağırıp çalıştırabilir.
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={handleStartCreate}>
                + Yeni Beceri Ekle
              </Button>
            </div>

            {skills.length === 0 && !isLoading && (
              <div className="ws-empty-hint">
                Henüz tanımlanmış bir özel beceri bulunmuyor. Yeni bir beceri eklemek için yukarıdaki butona tıklayın.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {skills.map((s) => {
                const isAdmin = currentUser?.role === 'admin'
                const isOwner = s.ownerId === currentUser?.id
                const canEdit = isAdmin || isOwner
                const canDelete = isAdmin || (isOwner && !s.isGlobal)
                const canManagePerms = isAdmin || isOwner
                const isPermOpen = editingPermSkillId === s.id
                const isEnabled = s.enabled !== false

                return (
                  <div
                    key={s.id}
                    style={{
                      background: isEnabled ? 'rgba(30, 41, 59, 0.75)' : 'rgba(15, 23, 42, 0.55)',
                      border: isEnabled ? '1px solid rgba(255, 255, 255, 0.1)' : '1px dashed rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      opacity: isEnabled ? 1 : 0.75,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '16px' }}>⚡</span>
                          <span style={{ fontWeight: 600, color: isEnabled ? '#f8fafc' : '#94a3b8', fontSize: '14px' }}>{s.name || s.id}</span>
                          <span style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                            <code>{s.id}</code>
                          </span>
                          
                          {/* ON / OFF Status Badge */}
                          {isEnabled ? (
                            <span style={{ fontSize: '10.5px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 600 }}>
                              🟢 Modelde Aktif (ON)
                            </span>
                          ) : (
                            <span style={{ fontSize: '10.5px', background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(100, 116, 139, 0.3)', fontWeight: 500 }}>
                              ⚪ Model Önünde Kapalı (OFF)
                            </span>
                          )}

                          {s.isGlobal ? (
                            <span style={{ fontSize: '10px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                              🌐 Global Sistem
                            </span>
                          ) : s.isPublic !== false ? (
                            <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                              🌐 Herkese Açık
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                              🔒 Özel İzinli ({s.allowedUserIds?.filter((u: string) => u !== '*').length || 0} Kişi)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12.5px', color: isEnabled ? '#cbd5e1' : '#64748b', lineHeight: '1.4', marginBottom: '6px' }}>
                          {s.description || 'Açıklama belirtilmemiş.'}
                        </div>
                        {s.filePath && (
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            📂 <code>{s.filePath}</code>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {/* Live ON / OFF Toggle Switch Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleSkill(s)}
                          disabled={togglingSkillId === s.id}
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '12px',
                            transition: 'all 0.2s ease',
                            border: isEnabled ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                            background: isEnabled 
                              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.15) 100%)' 
                              : 'rgba(30, 41, 59, 0.6)',
                            color: isEnabled ? '#34d399' : '#94a3b8',
                            boxShadow: isEnabled ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'
                          }}
                          title={isEnabled ? 'Beceriyi modelin önünden kaldır (OFF)' : 'Beceriyi modelin önüne koy ve aktif et (ON)'}
                        >
                          <span>{isEnabled ? '🟢 ON' : '⚪ OFF'}</span>
                          <span style={{ fontSize: '11px', opacity: 0.9 }}>
                            {isEnabled ? 'Açık' : 'Kapalı'}
                          </span>
                        </button>

                        {canManagePerms && (
                          <Button
                            variant={isPermOpen ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => handleOpenPermissionEditor(s)}
                            title="Bu beceriyi kimlerin görebileceğini ayarla"
                          >
                            🔒 İzin
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => handleStartEdit(s)}>
                          {canEdit ? '✏️ Düzenle' : '👁️ İncele'}
                        </Button>
                        {canDelete && (
                          <Button variant="danger" size="sm" onClick={() => handleDeleteSkill(s)}>
                            🗑️
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Permission Editor Drawer */}
                    {isPermOpen && (
                      <div style={{
                        marginTop: '6px',
                        padding: '12px 14px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                            🔐 Beceri Erişim İzinleri: <code style={{ color: '#818cf8' }}>{s.name || s.id}</code>
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Sahip: <b>{s.ownerId || 'admin'}</b>
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: '#f8fafc' }}>
                            <input
                              type="radio"
                              name={`skill-perm-type-${s.id}`}
                              checked={permIsPublic}
                              onChange={() => setPermIsPublic(true)}
                            />
                            <span>🌐 <b>Herkese Açık</b> (Tüm kiracılar ve kullanıcılar bu beceriyi kullanabilir)</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: '#f8fafc' }}>
                            <input
                              type="radio"
                              name={`skill-perm-type-${s.id}`}
                              checked={!permIsPublic}
                              onChange={() => setPermIsPublic(false)}
                            />
                            <span>🔒 <b>Sadece Seçili Kullanıcılar</b> (Yalnızca izin verilen kiracılar erişebilir)</span>
                          </label>
                        </div>

                        {!permIsPublic && (
                          <div style={{
                            background: 'rgba(0, 0, 0, 0.25)',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                              Erişim İzni Olan Kullanıcılar:
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                              {users.map(u => {
                                const isChecked = permAllowedUsers.includes(u.id)
                                return (
                                  <label
                                    key={u.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '12px',
                                      color: '#e2e8f0',
                                      cursor: 'pointer',
                                      background: isChecked ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                      padding: '4px 6px',
                                      borderRadius: '4px',
                                      border: isChecked ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleUserPermission(u.id)}
                                    />
                                    <span>{u.name || u.username} ({u.role})</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <Button size="sm" variant="secondary" onClick={() => setEditingPermSkillId(null)}>
                            İptal
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleSavePermissions(s.id)}
                            disabled={isSavingPerms}
                          >
                            {isSavingPerms ? 'Kaydediliyor...' : '💾 İzinleri Kaydet'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 2 & 3: CREATE & EDIT SKILL */}
        {(activeTab === 'create' || activeTab === 'edit') && (
          <div className="rag-tab-content">
            <div style={{ marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Beceri Adı / ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={skillName}
                  onChange={(e) => updateFrontmatterFromInputs(e.target.value, skillDesc)}
                  placeholder="örn: docker-expert veya pdf-analiz"
                  disabled={activeTab === 'edit'}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Açıklama (Ne Zaman ve Nasıl Kullanılacağı)</label>
              <input
                type="text"
                className="form-input"
                value={skillDesc}
                onChange={(e) => updateFrontmatterFromInputs(skillName, e.target.value)}
                placeholder="Modelin bu beceriyi hangi durumlarda seçeceğini açıklayın"
              />
            </div>

            {/* Model ON / OFF Toggle in Form */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: skillEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)', border: skillEnabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '6px' }}>
              <input
                type="checkbox"
                id="chk-skill-enabled"
                checked={skillEnabled}
                onChange={(e) => setSkillEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="chk-skill-enabled" style={{ fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {skillEnabled ? '🟢' : '⚪'} <b>Model Önünde Aktif Et (ON)</b> — İşaretli olduğunda model bu beceriyi görür ve çağırabilir.
              </label>
            </div>

            {currentUser?.role === 'admin' && activeTab === 'create' && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                <input
                  type="checkbox"
                  id="chk-skill-global"
                  checked={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.checked)}
                />
                <label htmlFor="chk-skill-global" style={{ fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', margin: 0 }}>
                  🌐 <b>Global Sistem Becerisi Olarak Kaydet</b> (Tüm kiracılar ve kullanıcılar bu beceriyi görebilir)
                </label>
              </div>
            )}

            {/* Template & Code Editor */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  📄 SKILL.md İçeriği (YAML Frontmatter + Talimatlar)
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setEditorMode('code')}
                    style={{
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: editorMode === 'code' ? '#6366f1' : 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '11px'
                    }}
                  >
                    Editör
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('preview')}
                    style={{
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: editorMode === 'preview' ? '#6366f1' : 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '11px'
                    }}
                  >
                    Önizleme
                  </button>
                  <button
                    type="button"
                    onClick={() => setRawContent(defaultTemplate(skillName, skillDesc))}
                    style={{
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#94a3b8',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '11px'
                    }}
                    title="Varsayılan Şablonu Yeniden Yükle"
                  >
                    🔄 Şablonu Sıfırla
                  </button>
                </div>
              </div>

              {editorMode === 'code' ? (
                <textarea
                  className="form-input"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12.5px',
                    lineHeight: '1.5',
                    minHeight: '420px',
                    resize: 'vertical',
                    background: '#0f172a'
                  }}
                  value={rawContent}
                  onChange={(e) => handleRawContentChange(e.target.value)}
                  placeholder="---&#10;name: beceri-adi&#10;description: ...&#10;---&#10;&#10;# Talimatlar"
                />
              ) : (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '12px',
                  minHeight: '420px',
                  maxHeight: '520px',
                  overflowY: 'auto',
                  fontSize: '13px',
                  color: '#cbd5e1',
                  whiteSpace: 'pre-wrap'
                }}>
                  {rawContent}
                </div>
              )}
              <div className="form-hint">
                💡 <b>---</b> işaretleri arasındaki YAML frontmatter bölümü beceri metaverilerini tanımlar. Altındaki Markdown kısmı ise modelin okuyacağı uzmanlık rehberidir.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <Button variant="secondary" onClick={() => setActiveTab('list')}>
                İptal
              </Button>
              <Button variant="primary" onClick={handleSaveSkill} disabled={isLoading}>
                {isLoading ? 'Kaydediliyor...' : activeTab === 'edit' ? '✓ Değişiklikleri Kaydet' : '✨ Beceriyi Oluştur & Aktifleştir'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
