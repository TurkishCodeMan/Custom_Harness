import React, { useState, useEffect } from 'react'
import { Modal, Button, Badge } from '@custom-harness/client-ui-primitives'

export interface SkillItem {
  id: string
  name: string
  description: string
  filePath?: string
  content?: string
  rawContent?: string
}

export interface SkillModalProps {
  isOpen: boolean
  onClose: () => void
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void
}

export function SkillModal({ isOpen, onClose, onShowToast }: SkillModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'edit'>('list')
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null)

  // Form State
  const [skillId, setSkillId] = useState('')
  const [skillName, setSkillName] = useState('')
  const [skillDesc, setSkillDesc] = useState('')
  const [rawContent, setRawContent] = useState('')
  const [editorMode, setEditorMode] = useState<'code' | 'preview'>('code')

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
      const res = await fetch('/api/skills')
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
    if (isOpen) {
      loadSkills()
    }
  }, [isOpen])

  const handleStartCreate = () => {
    const initialName = 'yeni-uzmanlik'
    const initialDesc = 'Özel görevler ve iş akışları için uzmanlık talimatı'
    setSkillId(initialName)
    setSkillName(initialName)
    setSkillDesc(initialDesc)
    setRawContent(defaultTemplate(initialName, initialDesc))
    setSelectedSkill(null)
    setActiveTab('create')
  }

  const handleStartEdit = (skill: SkillItem) => {
    setSelectedSkill(skill)
    setSkillId(skill.id)
    setSkillName(skill.name || skill.id)
    setSkillDesc(skill.description || '')
    setRawContent(skill.rawContent || defaultTemplate(skill.name || skill.id, skill.description || ''))
    setEditorMode('code')
    setActiveTab('edit')
  }

  const handleSaveSkill = async () => {
    if (!skillName.trim() && !skillId.trim()) {
      onShowToast('Lütfen bir beceri adı veya ID girin', 'info')
      return
    }

    setIsLoading(true)
    try {
      if (activeTab === 'edit' && selectedSkill) {
        const res = await fetch(`/api/skills/${selectedSkill.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: skillName.trim(),
            description: skillDesc.trim(),
            rawContent
          })
        })
        const data = await res.json()
        if (data.success) {
          onShowToast(`✓ "${skillName}" becerisi başarıyla güncellendi`, 'success')
          await loadSkills()
          setActiveTab('list')
        } else {
          onShowToast(`Hata: ${data.error || 'Güncellenemedi'}`, 'error')
        }
      } else {
        const res = await fetch('/api/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: skillId.trim() || skillName.trim(),
            name: skillName.trim(),
            description: skillDesc.trim(),
            rawContent
          })
        })
        const data = await res.json()
        if (data.success) {
          onShowToast(`✓ "${skillName}" becerisi başarıyla oluşturuldu`, 'success')
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
      const res = await fetch(`/api/skills/${skill.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        onShowToast(`"${skill.name || skill.id}" silindi`, 'info')
        await loadSkills()
      }
    } catch (e: any) {
      onShowToast(`Silme hatası: ${e.message}`, 'error')
    }
  }

  // Synchronize Form input edits into rawContent frontmatter
  const updateFrontmatterFromInputs = (newName: string, newDesc: string) => {
    setSkillName(newName)
    setSkillDesc(newDesc)
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

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="✨ Uzmanlık Becerileri (Skills) Yönetimi"
      maxWidth="840px"
    >
      <div className="rag-modal-container">
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
              {skills.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>⚡</span>
                      <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px' }}>{s.name || s.id}</span>
                      <span style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        <code>{s.id}</code>
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.4', marginBottom: '6px' }}>
                      {s.description || 'Açıklama belirtilmemiş.'}
                    </div>
                    {s.filePath && (
                      <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        📂 <code>{s.filePath}</code>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <Button variant="secondary" size="sm" onClick={() => handleStartEdit(s)}>
                      ✏️ Düzenle
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteSkill(s)}>
                      🗑️
                    </Button>
                  </div>
                </div>
              ))}
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
                    fontSize: '12px',
                    lineHeight: '1.5',
                    minHeight: '260px',
                    resize: 'vertical',
                    background: '#0f172a'
                  }}
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  placeholder="---&#10;name: beceri-adi&#10;description: ...&#10;---&#10;&#10;# Talimatlar"
                />
              ) : (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '12px',
                  minHeight: '260px',
                  maxHeight: '340px',
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
