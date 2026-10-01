import React, { useState, useEffect, useMemo } from 'react'
import {
  fetchSkills,
  createSkill,
  updateSkill,
  toggleSkill,
  deleteSkill,
  updateSkillPermissions,
  fetchUsers,
  type SkillItem
} from '../api.js'
import {
  SparklesIcon,
  SearchIcon,
  CheckCircleIcon,
  TrashIcon,
  PlusIcon,
  FlowIcon,
  TerminalIcon,
  SettingsIcon
} from '../components/Icons.js'

interface SkillsPageProps {
  companyWorkspace: string
  companyName?: string
}

interface TemplatePreset {
  id: string
  label: string
  icon: string
  name: string
  description: string
  content: string
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'data-analysis',
    label: 'Python & Veri Analizi',
    icon: '📊',
    name: 'veri-analizi-uzmani',
    description: 'Pandas, Plotly ve istatistiksel modeller ile büyük veri setlerini analiz etme ve görselleştirme.',
    content: `---
name: veri-analizi-uzmani
description: Pandas, Plotly ve istatistiksel modeller ile veri analizi ve görselleştirme
version: 1.0.0
---

# Veri Analizi ve İstatistik Uzmanlığı

Bu beceri aktif olduğunda model bir Veri Bilimci gibi davranır:

## 1. Analiz Adımları
1. Veri setini pandas ile oku (\`df.info()\`, \`df.describe()\`).
2. Eksik veya uç değerleri tespit et ve raporla.
3. İlgili korelasyonları ve eğilimleri Plotly ile interaktif grafiğe dök.
4. Bulguları yönetici seviyesinde özetle.
`
  },
  {
    id: 'api-integration',
    label: 'REST API & Web Entegrasyonu',
    icon: '🌐',
    name: 'rest-api-entegrasyonu',
    description: 'HTTP uç noktalarına güvenli istek atma, JSON şeması doğrulama ve API hatalarını yönetme.',
    content: `---
name: rest-api-entegrasyonu
description: HTTP/REST servisleri üzerinden harici sistemlerle veri alışverişi
version: 1.0.0
---

# REST API & Harici Servis Entegrasyon Becerisi

Model bu beceri aktifken aşağıdaki standartları uygular:

## 1. İstek Kuralları
1. Her API çağrısında hata durumlarını (HTTP 4xx/5xx) yakala.
2. Hassas token ve anahtarları asla düz metin olarak çıktıya yazma.
3. Gelen JSON yanıtlarını doğrula ve yalnızca istenen veri alanlarını süzerek sun.
`
  },
  {
    id: 'sql-db',
    label: 'SQL & Veritabanı Sorgulama',
    icon: '🗄️',
    name: 'sql-veritabani-yonetimi',
    description: 'PostgreSQL ve SQLite üzerinde güvenli salt-okunur analitik sorgular yazma ve optimize etme.',
    content: `---
name: sql-veritabani-yonetimi
description: SQL tablolarında analitik sorgulama, join ve veri ambarı filtreleme
version: 1.0.0
---

# SQL ve Veri Tabanı Becerisi

Bu beceri modelin veritabanı sorgularını profesyonelce oluşturmasını sağlar:

## 1. Güvenlik ve İcra
1. Yıkıcı sorgulara (DROP, TRUNCATE, DELETE) asla izin verme.
2. Analitik sorgularda indeks kullanımını ve maliyeti (\`EXPLAIN ANALYZE\`) göz önünde bulundur.
3. Sonuçları tablo formatında ve net açıklamalarla raporla.
`
  },
  {
    id: 'reporting',
    label: 'Yönetici Raporlama & Audit',
    icon: '📑',
    name: 'yonetici-rapor-formatlayici',
    description: 'Karmaşık operasyonel ve teknik verileri CEO ve yönetim kurulu için C-Level rapor formatına dönüştürme.',
    content: `---
name: yonetici-rapor-formatlayici
description: Şirket operasyonlarını ve agent çıktılarını C-Level yönetici raporuna dönüştürme
version: 1.0.0
---

# C-Level Yönetici Raporlama Becerisi

Bu beceri aktif edildiğinde çıktılar şu şablonda yapılandırılır:

## 1. Yönetici Özeti (Executive Summary)
- Durum ve temel kazanımlar (2-3 madde).
## 2. Temel Metrikler & Performans
- Tablo veya sayısal karşılaştırmalar.
## 3. Riskler & Alınacak Kararlar
- Yönetimin onayına sunulan aksiyon maddeleri.
`
  }
]

export const SkillsPage: React.FC<SkillsPageProps> = ({
  companyWorkspace,
  companyName = 'COMPANY_ABC'
}) => {
  // Tenancy identity state (simulated or active user)
  const [activeUserId, setActiveUserId] = useState<string>('user_admin')
  const [allUsers, setAllUsers] = useState<any[]>([])

  // Skill list & loading state
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [filterTenancy, setFilterTenancy] = useState<'all' | 'public' | 'private' | 'mine'>('all')
  const [togglingSkillId, setTogglingSkillId] = useState<string | null>(null)

  // Feedback Notification Toast
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Modal / Drawer Views
  const [activeViewMode, setActiveViewMode] = useState<'list' | 'create' | 'edit'>('list')
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null)

  // Expandable inspection drawer for markdown/instructions
  const [inspectingSkillId, setInspectingSkillId] = useState<string | null>(null)

  // Permissions Drawer State
  const [permDrawerSkillId, setPermDrawerSkillId] = useState<string | null>(null)
  const [permIsPublic, setPermIsPublic] = useState<boolean>(true)
  const [permAllowedUsers, setPermAllowedUsers] = useState<string[]>([])
  const [isSavingPerms, setIsSavingPerms] = useState<boolean>(false)

  // Form State (for Create & Edit)
  const [formId, setFormId] = useState<string>('')
  const [formName, setFormName] = useState<string>('')
  const [formDesc, setFormDesc] = useState<string>('')
  const [formEnabled, setFormEnabled] = useState<boolean>(true)
  const [formIsGlobal, setFormIsGlobal] = useState<boolean>(false)
  const [formRawContent, setFormRawContent] = useState<string>('')
  const [formEditorTab, setFormEditorTab] = useState<'raw' | 'preview'>('raw')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedback({ text, type })
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev))
    }, 4500)
  }

  // Load available users for Tenancy
  useEffect(() => {
    fetchUsers().then((users) => {
      if (users && users.length > 0) {
        setAllUsers(users)
      } else {
        // Fallback demo users if auth endpoint returns empty
        setAllUsers([
          { id: 'user_admin', name: 'Sistem Yöneticisi', role: 'admin', avatar: '🛡️' },
          { id: 'user_dev', name: 'Yazılım Geliştirici', role: 'user', avatar: '💻' },
          { id: 'user_analyst', name: 'Veri & İş Analisti', role: 'user', avatar: '📊' }
        ])
      }
    })
  }, [])

  // Load skills whenever active tenancy user changes
  const loadSkills = async (targetUid: string = activeUserId) => {
    setIsLoading(true)
    try {
      const data = await fetchSkills(targetUid)
      setSkills(data)
    } catch (err: any) {
      showToast(`Beceriler yüklenirken hata oluştu: ${err.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSkills(activeUserId)
  }, [activeUserId])

  const currentUserObj = useMemo(() => {
    return allUsers.find((u) => u.id === activeUserId) || {
      id: activeUserId,
      name: activeUserId === 'user_admin' ? 'Sistem Yöneticisi' : activeUserId,
      role: activeUserId === 'user_admin' ? 'admin' : 'user'
    }
  }, [allUsers, activeUserId])

  const isAdmin = currentUserObj.role === 'admin'

  // Default Template Generator
  const generateTemplate = (name: string, desc: string) => `---
name: ${name || 'yeni-beceri'}
description: ${desc || 'Bu becerinin ne yaptığı ve model tarafından ne zaman kullanılacağı'}
version: 1.0.0
---

# ${(name || 'YENİ BECERİ').toUpperCase()} Uzmanlık Talimatları

Model bu beceriyi kullandığında aşağıdaki standartlara ve iş akışına riayet eder:

## 1. Amaç & Kapsam
${desc || 'Bu beceri modelin belirli bir işi uzmanlık seviyesinde tamamlamasını sağlar.'}

## 2. Talimatlar ve İş Akışı
1. Kullanıcıdan gelen isteği ve proje mimarisini analiz et.
2. Gereksinimlere göre en uygun çözümü planla.
3. Çıktıyı temiz, hatasız ve standartlara uygun olarak üret.
`

  // Start Create Form
  const handleStartCreate = (preset?: TemplatePreset) => {
    const initialName = preset ? preset.name : 'yeni-uzmanlik'
    const initialDesc = preset ? preset.description : 'Özel şirket görevleri için uzmanlık talimatı'
    const initialContent = preset ? preset.content : generateTemplate(initialName, initialDesc)

    setFormName(initialName)
    setFormId(initialName)
    setFormDesc(initialDesc)
    setFormEnabled(true)
    setFormIsGlobal(false)
    setFormRawContent(initialContent)
    setFormEditorTab('raw')
    setSelectedSkill(null)
    setActiveViewMode('create')
  }

  // Start Edit Form
  const handleStartEdit = (skill: SkillItem) => {
    setSelectedSkill(skill)
    setFormId(skill.id)
    setFormName(skill.name || skill.id)
    setFormDesc(skill.description || '')
    setFormEnabled(skill.enabled !== false)
    setFormIsGlobal(Boolean(skill.isGlobal))
    setFormRawContent(skill.rawContent || generateTemplate(skill.name || skill.id, skill.description || ''))
    setFormEditorTab('raw')
    setActiveViewMode('edit')
  }

  // Live Toggle ON/OFF
  const handleToggle = async (skill: SkillItem) => {
    const nextState = skill.enabled === false ? true : false
    setTogglingSkillId(skill.id)

    // Optimistic UI update
    setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: nextState } : s)))

    try {
      const res = await toggleSkill(skill.id, nextState, activeUserId)
      if (res.success) {
        showToast(
          nextState
            ? `🟢 "${skill.name || skill.id}" becerisi AÇILDI (ON) - Artık model tarafından çağrılabilir.`
            : `⚪ "${skill.name || skill.id}" becerisi KAPATILDI (OFF) - Modelin önünden kaldırıldı.`,
          nextState ? 'success' : 'info'
        )
      } else {
        // Rollback
        setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: !nextState } : s)))
        showToast(`Durum değiştirme hatası: ${res.error || 'İşlem başarısız'}`, 'error')
      }
    } catch (err: any) {
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, enabled: !nextState } : s)))
      showToast(`Hata: ${err.message}`, 'error')
    } finally {
      setTogglingSkillId(null)
    }
  }

  // Delete Skill
  const handleDelete = async (skill: SkillItem) => {
    if (!window.confirm(`"${skill.name || skill.id}" becerisini tamamen silmek istediğinize emin misiniz?`)) {
      return
    }

    try {
      const res = await deleteSkill(skill.id, activeUserId)
      if (res.success) {
        showToast(`✓ "${skill.name || skill.id}" başarıyla silindi.`, 'success')
        await loadSkills(activeUserId)
      } else {
        showToast(`Silme başarısız: ${res.error || 'Bilinmeyen hata'}`, 'error')
      }
    } catch (err: any) {
      showToast(`Silme hatası: ${err.message}`, 'error')
    }
  }

  // Open Permission Editor Drawer
  const handleOpenPermissions = (skill: SkillItem) => {
    if (permDrawerSkillId === skill.id) {
      setPermDrawerSkillId(null)
      return
    }
    setPermDrawerSkillId(skill.id)
    setPermIsPublic(skill.isPublic !== false)
    const allowed = (skill.allowedUserIds || []).filter((u: string) => u !== '*')
    setPermAllowedUsers(allowed)
  }

  // Save Permissions
  const handleSavePermissions = async (targetSkillId: string) => {
    setIsSavingPerms(true)
    try {
      const res = await updateSkillPermissions(
        targetSkillId,
        permIsPublic ? ['*'] : permAllowedUsers,
        permIsPublic,
        activeUserId
      )
      if (res.success) {
        showToast('✓ Beceri erişim izinleri başarıyla güncellendi.', 'success')
        setPermDrawerSkillId(null)
        await loadSkills(activeUserId)
      } else {
        showToast(`İzin güncelleme hatası: ${res.error}`, 'error')
      }
    } catch (err: any) {
      showToast(`Hata: ${err.message}`, 'error')
    } finally {
      setIsSavingPerms(false)
    }
  }

  const handleToggleUserPermission = (targetUserId: string) => {
    setPermAllowedUsers((prev) => {
      const clean = prev.filter((id) => id !== '*')
      if (clean.includes(targetUserId)) {
        return clean.filter((id) => id !== targetUserId)
      } else {
        return [...clean, targetUserId]
      }
    })
  }

  // Keep Form Frontmatter synchronized
  const updateFrontmatterFromInputs = (newName: string, newDesc: string) => {
    setFormName(newName)
    setFormDesc(newDesc)
    const slug = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    setFormId(slug)

    if (formRawContent.startsWith('---')) {
      const parts = formRawContent.split('---')
      if (parts.length >= 3) {
        const body = parts.slice(2).join('---')
        setFormRawContent(`---
name: ${newName}
description: ${newDesc}
version: 1.0.0
---${body}`)
        return
      }
    }
    setFormRawContent(generateTemplate(newName, newDesc))
  }

  const handleRawContentChange = (newRaw: string) => {
    setFormRawContent(newRaw)
    if (newRaw.startsWith('---')) {
      const matchName = newRaw.match(/^name:\s*(.+)$/m)
      if (matchName && matchName[1]) {
        const parsedName = matchName[1].trim().replace(/^['"]|['"]$/g, '')
        setFormName(parsedName)
        setFormId(parsedName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))
      }
      const matchDesc = newRaw.match(/^description:\s*(.+)$/m)
      if (matchDesc && matchDesc[1]) {
        setFormDesc(matchDesc[1].trim().replace(/^['"]|['"]$/g, ''))
      }
    }
  }

  // Submit Create or Edit
  const handleSubmitSkill = async (e: React.FormEvent) => {
    e.preventDefault()
    let effectiveName = formName.trim()
    let effectiveDesc = formDesc.trim()

    if (formRawContent.startsWith('---')) {
      const matchName = formRawContent.match(/^name:\s*(.+)$/m)
      if (matchName && matchName[1]) {
        effectiveName = matchName[1].trim().replace(/^['"]|['"]$/g, '')
      }
      const matchDesc = formRawContent.match(/^description:\s*(.+)$/m)
      if (matchDesc && matchDesc[1]) {
        effectiveDesc = matchDesc[1].trim().replace(/^['"]|['"]$/g, '')
      }
    }

    const effectiveId = (effectiveName || formId || 'custom-skill').toLowerCase().replace(/[^a-z0-9_-]/g, '-')

    if (!effectiveName && !effectiveId) {
      showToast('Lütfen geçerli bir beceri adı veya kimliği girin.', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      if (activeViewMode === 'edit' && selectedSkill) {
        const res = await updateSkill(
          selectedSkill.id,
          {
            name: effectiveName,
            description: effectiveDesc,
            rawContent: formRawContent,
            enabled: formEnabled
          },
          activeUserId
        )
        if (res.success) {
          showToast(`✓ "${effectiveName}" becerisi başarıyla güncellendi.`, 'success')
          await loadSkills(activeUserId)
          setActiveViewMode('list')
        } else {
          showToast(`Güncelleme hatası: ${res.error || 'İşlem başarısız'}`, 'error')
        }
      } else {
        const res = await createSkill(
          {
            id: effectiveId,
            name: effectiveName,
            description: effectiveDesc,
            rawContent: formRawContent,
            isGlobal: Boolean(formIsGlobal && isAdmin),
            enabled: formEnabled
          },
          activeUserId
        )
        if (res.success) {
          showToast(`✓ "${effectiveName}" becerisi başarıyla oluşturuldu.`, 'success')
          await loadSkills(activeUserId)
          setActiveViewMode('list')
        } else {
          showToast(`Oluşturma hatası: ${res.error || 'İşlem başarısız'}`, 'error')
        }
      }
    } catch (err: any) {
      showToast(`Hata: ${err.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtered Skills List
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = (s.name || '').toLowerCase().includes(q)
        const matchesId = (s.id || '').toLowerCase().includes(q)
        const matchesDesc = (s.description || '').toLowerCase().includes(q)
        const matchesContent = (s.rawContent || '').toLowerCase().includes(q)
        if (!matchesName && !matchesId && !matchesDesc && !matchesContent) return false
      }

      // Status filter
      if (filterStatus === 'enabled' && s.enabled === false) return false
      if (filterStatus === 'disabled' && s.enabled !== false) return false

      // Tenancy filter
      if (filterTenancy === 'public' && s.isPublic === false && !s.isGlobal) return false
      if (filterTenancy === 'private' && (s.isPublic !== false || s.isGlobal)) return false
      if (filterTenancy === 'mine' && s.ownerId !== activeUserId) return false

      return true
    })
  }, [skills, searchQuery, filterStatus, filterTenancy, activeUserId])

  const stats = useMemo(() => {
    const total = skills.length
    const enabledCount = skills.filter((s) => s.enabled !== false).length
    const disabledCount = total - enabledCount
    const globalCount = skills.filter((s) => s.isGlobal).length
    const privateCount = skills.filter((s) => s.isPublic === false && !s.isGlobal).length
    return { total, enabledCount, disabledCount, globalCount, privateCount }
  }, [skills])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'radial-gradient(ellipse at top left, rgba(30, 27, 75, 0.45) 0%, rgba(10, 15, 29, 0.98) 70%)',
        color: 'var(--text-main, #f1f5f9)',
        overflowY: 'auto',
        padding: '24px 32px',
        boxSizing: 'border-box'
      }}
    >
      {/* Toast Feedback Banner */}
      {feedback && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            border:
              feedback.type === 'success'
                ? '1px solid rgba(16, 185, 129, 0.5)'
                : feedback.type === 'error'
                ? '1px solid rgba(239, 68, 68, 0.5)'
                : '1px solid rgba(56, 189, 248, 0.5)',
            background:
              feedback.type === 'success'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 78, 59, 0.9) 100%)'
                : feedback.type === 'error'
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(127, 29, 29, 0.9) 100%)'
                : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(12, 74, 110, 0.9) 100%)',
            color: '#fff',
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <span>{feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              marginLeft: '8px',
              fontSize: '14px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(99, 102, 241, 0.2) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
                boxShadow: '0 0 16px rgba(168, 85, 247, 0.25)'
              }}
            >
              <SparklesIcon size={20} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              Uzmanlık Becerileri & Yetenekler (Skills Hub)
            </h1>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#c084fc',
                background: 'rgba(168, 85, 247, 0.14)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                padding: '2px 9px',
                borderRadius: '999px',
                letterSpacing: '0.04em'
              }}
            >
              MULTI-TENANCY & RBAC
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5, maxWidth: '780px' }}>
            Agentların belirli alanlarda (veri bilimi, SQL, entegrasyonlar, kurumsal denetim) uzmanlaşmasını sağlayan
            <code> .agents/skills </code> talimatları. Her beceri için kullanıcı yetkisi (tenancy), açık/kapalı durumu ve erişim izinleri denetlenir.
          </p>
        </div>

        {/* Action Controls & Tenancy Persona Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Active Tenancy User Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '6px 12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}
            title="Aktif kiracı / kullanıcı kimliğini değiştirerek yetkilendirme filtrelerini canlı test edin"
          >
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>👤 Kiracı:</span>
            <select
              value={activeUserId}
              onChange={(e) => setActiveUserId(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                color: activeUserId === 'user_admin' ? '#34d399' : '#38bdf8',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.avatar || '👤'} {u.name || u.username} ({u.role === 'admin' ? 'Admin' : 'User'})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => loadSkills(activeUserId)}
            disabled={isLoading}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
            title="Beceri listesini yenile"
          >
            <span>{isLoading ? '⏳' : '🔄'}</span>
            <span>Yenile</span>
          </button>

          {activeViewMode === 'list' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleStartCreate()}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                boxShadow: '0 0 16px rgba(168, 85, 247, 0.35)'
              }}
            >
              <PlusIcon size={15} />
              <span>Yeni Beceri Tanımla</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveViewMode('list')}
              style={{ padding: '8px 14px', fontSize: '12.5px' }}
            >
              ← Beceriler Listesine Dön
            </button>
          )}
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '24px'
        }}
      >
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Görülebilen Beceriler
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
              {stats.total}
            </div>
          </div>
          <div style={{ fontSize: '24px', opacity: 0.85 }}>⚡</div>
        </div>

        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>
              Modelde Aktif (ON)
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
              {stats.enabledCount}
            </div>
          </div>
          <div style={{ fontSize: '24px' }}>🟢</div>
        </div>

        <div
          style={{
            background: 'rgba(100, 116, 139, 0.1)',
            border: '1px solid rgba(100, 116, 139, 0.25)',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Kapatılmış (OFF)
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#cbd5e1', marginTop: '4px' }}>
              {stats.disabledCount}
            </div>
          </div>
          <div style={{ fontSize: '24px' }}>⚪</div>
        </div>

        <div
          style={{
            background: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: '#c084fc', textTransform: 'uppercase', fontWeight: 600 }}>
              Özel İzinli (Tenancy)
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#e9d5ff', marginTop: '4px' }}>
              {stats.privateCount}
            </div>
          </div>
          <div style={{ fontSize: '24px' }}>🔒</div>
        </div>
      </div>

      {/* VIEW MODE 1: SKILL LIST */}
      {activeViewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search, Status & Tenancy Filters Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              background: 'rgba(15, 23, 42, 0.65)',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flex: '1 1 260px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '6px 12px'
              }}
            >
              <SearchIcon size={15} color="#94a3b8" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Beceri adı, açıklama veya kod içeriğinde ara..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '13px',
                  width: '100%',
                  outline: 'none'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>Durum:</span>
              <div
                style={{
                  display: 'inline-flex',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '2px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                {(['all', 'enabled', 'disabled'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilterStatus(s)}
                    style={{
                      background: filterStatus === s ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                      color: filterStatus === s ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '5px',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: filterStatus === s ? 600 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {s === 'all' ? 'Tümü' : s === 'enabled' ? '🟢 Aktif' : '⚪ Kapalı'}
                  </button>
                ))}
              </div>

              <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600, marginLeft: '6px' }}>
                Erişim:
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '2px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                {(['all', 'public', 'private', 'mine'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterTenancy(t)}
                    style={{
                      background: filterTenancy === t ? 'rgba(168, 85, 247, 0.3)' : 'transparent',
                      color: filterTenancy === t ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '5px',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: filterTenancy === t ? 600 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {t === 'all'
                      ? 'Tümü'
                      : t === 'public'
                      ? '🌐 Herkese Açık'
                      : t === 'private'
                      ? '🔒 Özel İzinli'
                      : '👤 Sahiplik'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Empty State */}
          {filteredSkills.length === 0 && !isLoading && (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: '12px'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 6px 0' }}>
                Kriterlere Uygun Beceri Bulunamadı
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                {searchQuery
                  ? 'Arama teriminize uygun bir beceri bulunamadı.'
                  : 'Aktif kullanıcının erişebildiği beceri tanımlanmamış. Yeni bir beceri ekleyerek başlayabilirsiniz.'}
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleStartCreate()}
                style={{
                  background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                  padding: '8px 18px'
                }}
              >
                + Yeni Beceri Oluştur
              </button>
            </div>
          )}

          {/* SKILLS CARDS LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredSkills.map((s) => {
              const isOwner = s.ownerId === activeUserId
              const canEdit = isAdmin || isOwner
              const canDelete = isAdmin || (isOwner && !s.isGlobal)
              const canManagePerms = isAdmin || isOwner
              const isPermOpen = permDrawerSkillId === s.id
              const isInspecting = inspectingSkillId === s.id
              const isEnabled = s.enabled !== false
              const isToggling = togglingSkillId === s.id

              return (
                <div
                  key={s.id}
                  style={{
                    background: isEnabled
                      ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%)'
                      : 'rgba(15, 23, 42, 0.5)',
                    border: isEnabled
                      ? '1px solid rgba(168, 85, 247, 0.25)'
                      : '1px dashed rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    opacity: isEnabled ? 1 : 0.72,
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isEnabled ? '0 4px 20px rgba(0, 0, 0, 0.25)' : 'none'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Left: Info & Badges */}
                    <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>⚡</span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: isEnabled ? '#f8fafc' : '#94a3b8',
                            fontSize: '15px',
                            letterSpacing: '-0.01em'
                          }}
                        >
                          {s.name || s.id}
                        </span>
                        <code
                          style={{
                            fontSize: '11px',
                            background: 'rgba(99, 102, 241, 0.18)',
                            color: '#a5b4fc',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            border: '1px solid rgba(99, 102, 241, 0.3)'
                          }}
                        >
                          {s.id}
                        </code>

                        {/* ON / OFF Status Badge */}
                        {isEnabled ? (
                          <span
                            style={{
                              fontSize: '10.5px',
                              background: 'rgba(16, 185, 129, 0.18)',
                              color: '#34d399',
                              padding: '2px 9px',
                              borderRadius: '999px',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              fontWeight: 700
                            }}
                          >
                            🟢 Modelde Aktif (ON)
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10.5px',
                              background: 'rgba(100, 116, 139, 0.2)',
                              color: '#94a3b8',
                              padding: '2px 9px',
                              borderRadius: '999px',
                              border: '1px solid rgba(100, 116, 139, 0.3)',
                              fontWeight: 600
                            }}
                          >
                            ⚪ Model Önünde Kapalı (OFF)
                          </span>
                        )}

                        {/* Tenancy Badges */}
                        {s.isGlobal ? (
                          <span
                            style={{
                              fontSize: '10.5px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              fontWeight: 600
                            }}
                          >
                            🌐 Global Sistem
                          </span>
                        ) : s.isPublic !== false ? (
                          <span
                            style={{
                              fontSize: '10.5px',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#34d399',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              fontWeight: 600
                            }}
                          >
                            👥 Herkese Açık
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10.5px',
                              background: 'rgba(168, 85, 247, 0.18)',
                              color: '#c084fc',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid rgba(168, 85, 247, 0.35)',
                              fontWeight: 600
                            }}
                          >
                            🔒 Özel İzinli ({s.allowedUserIds?.filter((u: string) => u !== '*').length || 0} Kişi)
                          </span>
                        )}

                        {/* Owner Badge */}
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#94a3b8',
                            background: 'rgba(255, 255, 255, 0.04)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                          }}
                        >
                          👤 {s.ownerId || 'admin'}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '13px',
                          color: isEnabled ? '#cbd5e1' : '#64748b',
                          lineHeight: 1.5,
                          marginBottom: '8px'
                        }}
                      >
                        {s.description || 'Açıklama belirtilmemiş.'}
                      </div>

                      {s.filePath && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            fontFamily: 'monospace',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>📂</span>
                          <span>{s.filePath}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexShrink: 0,
                        flexWrap: 'wrap'
                      }}
                    >
                      {/* Live ON/OFF Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggle(s)}
                        disabled={isToggling}
                        style={{
                          cursor: isToggling ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '12px',
                          transition: 'all 0.2s ease',
                          border: isEnabled
                            ? '1px solid rgba(16, 185, 129, 0.5)'
                            : '1px solid rgba(255, 255, 255, 0.15)',
                          background: isEnabled
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.15) 100%)'
                            : 'rgba(30, 41, 59, 0.6)',
                          color: isEnabled ? '#34d399' : '#94a3b8',
                          boxShadow: isEnabled ? '0 0 12px rgba(16, 185, 129, 0.25)' : 'none'
                        }}
                        title={
                          isEnabled
                            ? 'Bu beceriyi modelin önünden kaldır (OFF)'
                            : 'Bu beceriyi modelin önüne koy ve aktif et (ON)'
                        }
                      >
                        <span>{isEnabled ? '🟢 ON' : '⚪ OFF'}</span>
                        <span style={{ fontSize: '11px', opacity: 0.85 }}>{isEnabled ? 'Aktif' : 'Kapalı'}</span>
                      </button>

                      {/* Permissions Drawer Trigger */}
                      {canManagePerms && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleOpenPermissions(s)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: isPermOpen ? 'rgba(168, 85, 247, 0.2)' : undefined,
                            borderColor: isPermOpen ? 'rgba(168, 85, 247, 0.4)' : undefined,
                            color: isPermOpen ? '#c084fc' : undefined
                          }}
                          title="Bu becerinin kimler tarafından görülebileceğini yapılandırın"
                        >
                          <span>🔒 İzin & Tenancy</span>
                        </button>
                      )}

                      {/* Inspect Content */}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setInspectingSkillId(isInspecting ? null : s.id)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                        title="Beceri talimatlarını ve YAML konfigürasyonunu inceleyin"
                      >
                        <span>{isInspecting ? '👁️ Kapat' : '👁️ İncele'}</span>
                      </button>

                      {/* Edit Button */}
                      {canEdit && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleStartEdit(s)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Beceriyi düzenle"
                        >
                          <span>✏️ Düzenle</span>
                        </button>
                      )}

                      {/* Delete Button */}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          title="Beceriyi tamamen sil"
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DRAWER 1: Permissions & Multi-Tenancy Management */}
                  {isPermOpen && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '16px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(168, 85, 247, 0.35)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        animation: 'slideUp 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                            🔐 Beceri Çok Kiracılı Erişim İzinleri:
                          </span>
                          <code style={{ color: '#c084fc', marginLeft: '6px', fontWeight: 600 }}>{s.name || s.id}</code>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          Beceri Sahibi: <b>{s.ownerId || 'admin'}</b>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#f8fafc'
                          }}
                        >
                          <input
                            type="radio"
                            name={`skill-perm-${s.id}`}
                            checked={permIsPublic}
                            onChange={() => setPermIsPublic(true)}
                          />
                          <span>
                            🌐 <b>Herkese Açık (Public)</b> — Şirketteki tüm kullanıcılar ve kiracılar bu beceriyi çağırabilir.
                          </span>
                        </label>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#f8fafc'
                          }}
                        >
                          <input
                            type="radio"
                            name={`skill-perm-${s.id}`}
                            checked={!permIsPublic}
                            onChange={() => setPermIsPublic(false)}
                          />
                          <span>
                            🔒 <b>Yalnızca İzinli Kiracılar (Private)</b> — Sadece aşağıda yetkilendirilen kullanıcılar bu beceriyi görebilir.
                          </span>
                        </label>
                      </div>

                      {!permIsPublic && (
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.35)',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                            Erişim İzni Olan Şirket Kullanıcıları:
                          </span>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                              gap: '8px'
                            }}
                          >
                            {allUsers.map((u) => {
                              const isChecked = permAllowedUsers.includes(u.id)
                              return (
                                <label
                                  key={u.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '12.5px',
                                    color: '#e2e8f0',
                                    cursor: 'pointer',
                                    background: isChecked ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: isChecked
                                      ? '1px solid rgba(168, 85, 247, 0.4)'
                                      : '1px solid rgba(255, 255, 255, 0.05)'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleUserPermission(u.id)}
                                  />
                                  <span>{u.avatar || '👤'}</span>
                                  <span>{u.name || u.username}</span>
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>({u.role})</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setPermDrawerSkillId(null)}
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                        >
                          İptal
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleSavePermissions(s.id)}
                          disabled={isSavingPerms}
                          style={{
                            padding: '6px 18px',
                            fontSize: '12px',
                            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)'
                          }}
                        >
                          {isSavingPerms ? 'Kaydediliyor...' : '💾 İzinleri Kaydet'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* DRAWER 2: Inspect Content & Frontmatter */}
                  {isInspecting && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '14px',
                        background: 'rgba(0, 0, 0, 0.55)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        animation: 'slideUp 0.15s ease'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                          📄 SKILL.md Talimat İçeriği:
                        </span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(s.rawContent || '')}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            color: '#cbd5e1',
                            padding: '2px 8px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          📋 Kopyala
                        </button>
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: '12px',
                          background: 'rgba(10, 15, 29, 0.9)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#e2e8f0',
                          overflowX: 'auto',
                          maxHeight: '300px',
                          fontFamily: 'monospace',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {s.rawContent || s.content || '# Talimat içeriği bulunamadı'}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2 & 3: CREATE OR EDIT SKILL */}
      {(activeViewMode === 'create' || activeViewMode === 'edit') && (
        <form
          onSubmit={handleSubmitSkill}
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          {/* Header of Form */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                {activeViewMode === 'create'
                  ? '✨ Yeni Uzmanlık Becerisi Tanımla'
                  : `✏️ Beceriyi Düzenle: ${selectedSkill?.name || selectedSkill?.id}`}
              </h2>
              <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Ajanların belirli durumlarda kullanacağı sistem talimatlarını ve iş kurallarını tanımlayın.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveViewMode('list')}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              İptal / Listeye Dön
            </button>
          </div>

          {/* Quick Starter Templates (only in Create mode) */}
          {activeViewMode === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                Hızlı Başlangıç Şablonları:
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px'
                }}
              >
                {TEMPLATE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleStartCreate(p)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)'
                      e.currentTarget.style.background = 'rgba(168, 85, 247, 0.08)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#f1f5f9' }}>{p.label}</div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '180px'
                        }}
                      >
                        {p.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form Fields Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}
          >
            {/* Skill Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  marginBottom: '6px'
                }}
              >
                Beceri Adı (Skill Name)
              </label>
              <input
                type="text"
                className="form-input"
                value={formName}
                onChange={(e) => updateFrontmatterFromInputs(e.target.value, formDesc)}
                placeholder="örn: python-veri-analizi"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#f8fafc',
                  fontSize: '13px'
                }}
              />
            </div>

            {/* Skill Slug/ID */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  marginBottom: '6px'
                }}
              >
                Beceri Kimliği (ID / Klasör Adı)
              </label>
              <input
                type="text"
                className="form-input"
                value={formId}
                disabled={activeViewMode === 'edit'}
                onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                placeholder="örn: python-veri-analizi"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: activeViewMode === 'edit' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: activeViewMode === 'edit' ? '#94a3b8' : '#f8fafc',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#e2e8f0',
                marginBottom: '6px'
              }}
            >
              Açıklama (Modelin ne zaman bu beceriyi seçeceğini belirtin)
            </label>
            <input
              type="text"
              className="form-input"
              value={formDesc}
              onChange={(e) => updateFrontmatterFromInputs(formName, e.target.value)}
              placeholder="örn: Pandas ve Plotly ile veri analizi ve görselleştirme işlemleri için"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#f8fafc',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Options: Enabled & Global */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              padding: '12px 16px',
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#f8fafc'
              }}
            >
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
              />
              <span>🟢 <b>Oluşturulduğunda Modelde Aktif Olsun (ON)</b></span>
            </label>

            {isAdmin && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#38bdf8'
                }}
              >
                <input
                  type="checkbox"
                  checked={formIsGlobal}
                  onChange={(e) => setFormIsGlobal(e.target.checked)}
                />
                <span>🌐 <b>Global Sistem Becerisi Olarak Kaydet</b> (Tüm kiracılar görebilir)</span>
              </label>
            )}
          </div>

          {/* Markdown / YAML Editor Tabs */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}
            >
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setFormEditorTab('raw')}
                  style={{
                    background: formEditorTab === 'raw' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                    border: formEditorTab === 'raw' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
                    color: formEditorTab === 'raw' ? '#c084fc' : '#94a3b8',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📝 YAML / Markdown Düzenleyici
                </button>
                <button
                  type="button"
                  onClick={() => setFormEditorTab('preview')}
                  style={{
                    background: formEditorTab === 'preview' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                    border: formEditorTab === 'preview' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
                    color: formEditorTab === 'preview' ? '#c084fc' : '#94a3b8',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  👁️ Önizleme
                </button>
              </div>

              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Klasör yolu: <code>.agents/skills/{formId || 'skill'}/SKILL.md</code>
              </span>
            </div>

            {formEditorTab === 'raw' ? (
              <textarea
                value={formRawContent}
                onChange={(e) => handleRawContentChange(e.target.value)}
                rows={16}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 15, 29, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '14px',
                  color: '#e2e8f0',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10, 15, 29, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '16px',
                  color: '#e2e8f0',
                  fontSize: '13px',
                  minHeight: '260px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {formRawContent}
              </div>
            )}
          </div>

          {/* Form Submit & Cancel Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveViewMode('list')}
              style={{ padding: '10px 20px', fontSize: '13px' }}
            >
              İptal
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{
                padding: '10px 26px',
                fontSize: '13px',
                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                boxShadow: '0 0 16px rgba(168, 85, 247, 0.35)'
              }}
            >
              {isSubmitting
                ? 'Kaydediliyor...'
                : activeViewMode === 'create'
                ? '✨ Beceriyi Oluştur ve Kaydet'
                : '💾 Değişiklikleri Kaydet'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
