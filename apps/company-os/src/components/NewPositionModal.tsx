import React, { useState, useEffect, useMemo } from 'react'
import type { Position, PositionLevel } from '../types.js'
import { fetchTools, fetchSkills, fetchPresets, savePreset } from '../api.js'
import { TOOL_CLASSES, ToolCategory, getToolCategory, getToolCategoryMeta } from '../toolCategories.js'

interface NewPositionModalProps {
  isOpen: boolean
  onClose: () => void
  positions: Position[]
  onAddPosition: (newPos: Position) => void
}

export const COMPANY_SKILLS = [
  { id: 'kalite-ve-iade-kontrol', name: 'Kalite & İade Denetimi', icon: '🛡️' },
  { id: 'butce-denetim', name: 'Bütçe & Harcama Denetimi', icon: '📊' },
  { id: 'tedarikci-denetim', name: 'Tedarikçi & Stok Denetimi', icon: '📦' }
]

export const PRESET_TEMPLATES: Record<string, any> = {
  'novatrend-kalite': {
    id: 'novatrend-kalite',
    name: 'NovaTrend Kalite Güvence & İade Müdürü',
    icon: '🛡️',
    description: 'Ürün iade oranlarını, kusurlu serileri ve sözleşme cezalarını denetler; kritik stoklarla çapraz kontrol yapar.',
    systemPrompt: `You are the Quality Assurance & Returns Operations Director for NovaTrend Global E-Ticaret A.Ş. Your mission is to monitor customer return rates, identify defect patterns, and enforce supplier contract penalty clauses (e.g. fee deductions or batch rejection). Cross-check return spikes with critical inventory levels to prevent re-ordering defective batches. Use the kalite-ve-iade-kontrol skill whenever auditing quality.\n\n[Kurumsal Raporlama Standardı]:\n- Asla karmaşık markdown tablosu oluşturma; verileri düz madde imleri (-) ile yaz.\n- Raporu en fazla 4-5 maddede özetle (aşırı uzun ve tekrarlı metinlerden kaçın).\n- Rapor tamamlandığında altına mutlaka "--- RAPOR BİTTİ ---" yazıp dur.`,
    tools: ['read_file', 'write_file', 'list_dir', 'grep_search', 'skill', 'schedule_create', 'schedule_list', 'schedule_delete'],
    skills: ['kalite-ve-iade-kontrol'],
    workspace: '/home/huseyina/code_mode/COMPANY_ABC/operasyon_ve_iadeler',
    specialization: 'musteri_iade_analizi.csv, tedarikci_sozlesme_ozetleri.md'
  },
  'novatrend-cfo': {
    id: 'novatrend-cfo',
    name: 'Kıdemli CFO & Finans Denetçisi',
    icon: '📊',
    description: 'Bütçe aşımları, harcama sapmaları, maliyet analizleri ve finansal denetim.',
    systemPrompt: `You are the Chief Financial Officer (CFO) and Chief Auditor for COMPANY_ABC. Analyze budget variance, identify cost overruns, and verify supplier price competitiveness.\n\n[Kurumsal Raporlama Standardı]:\n- Asla karmaşık markdown tablosu oluşturma; verileri düz madde imleri (-) ile yaz.\n- Raporu en fazla 4-5 maddede özetle (aşırı uzun ve tekrarlı metinlerden kaçın).\n- Rapor tamamlandığında altına mutlaka "--- RAPOR BİTTİ ---" yazıp dur.`,
    tools: ['read_file', 'write_file', 'list_dir', 'grep_search', 'skill', 'schedule_create', 'schedule_list', 'schedule_delete'],
    skills: ['butce-denetim'],
    workspace: '/home/huseyina/code_mode/COMPANY_ABC/finans',
    specialization: 'Q3_2025_Butce_ve_Harcamalar.csv, tedarikci_fiyat_karsilastirma.json'
  },
  'novatrend-tedarik': {
    id: 'novatrend-tedarik',
    name: 'Tedarik Zinciri & Satın Alma Müdürü',
    icon: '📦',
    description: 'Kritik stok seviyeleri, tükenme riski, satın alma sipariş taslakları.',
    systemPrompt: `You are the Supply Chain & Procurement Director for COMPANY_ABC. Monitor inventory, reorder levels, and critical stockouts.\n\n[Kurumsal Raporlama Standardı]:\n- Asla karmaşık markdown tablosu oluşturma; verileri düz madde imleri (-) ile yaz.\n- Raporu en fazla 4-5 maddede özetle (aşırı uzun ve tekrarlı metinlerden kaçın).\n- Rapor tamamlandığında altına mutlaka "--- RAPOR BİTTİ ---" yazıp dur.`,
    tools: ['read_file', 'write_file', 'list_dir', 'grep_search', 'skill', 'schedule_create', 'schedule_list', 'schedule_delete'],
    skills: ['tedarikci-denetim'],
    workspace: '/home/huseyina/code_mode/COMPANY_ABC/tedarik_ve_stok',
    specialization: 'kritik_stok_ve_siparisler.json'
  },
  'ceo': {
    id: 'ceo',
    name: 'Genel Müdür & İcra Kurulu Başkanı (CEO)',
    icon: '👑',
    description: 'Şirket stratejisini belirler, kurumsal direktifler yayınlar, departmanlar arası koordinasyonu ve denetimi sağlar.',
    systemPrompt: `You are the Chief Executive Officer (CEO) and Executive Chairman for COMPANY_ABC. Synthesize strategic decisions, coordinate with departments, and verify real data.\n\n[Kurumsal Raporlama Standardı]:\n- Asla karmaşık markdown tablosu oluşturma; verileri düz madde imleri (-) ile yaz.\n- Raporu en fazla 4-5 maddede özetle (aşırı uzun ve tekrarlı metinlerden kaçın).\n- Rapor tamamlandığında altına mutlaka "--- RAPOR BİTTİ ---" yazıp dur.`,
    tools: ['read_file', 'write_file', 'list_dir', 'grep_search', 'skill', 'schedule_create', 'schedule_list', 'schedule_delete', 'invoke_subagent', 'check_subagent'],
    skills: ['butce-denetim', 'kalite-ve-iade-kontrol', 'tedarikci-denetim'],
    workspace: '/home/huseyina/code_mode/COMPANY_ABC',
    specialization: 'Stratejik Kararlar, Kurumsal Direktifler'
  },
  'test-preset': {
    id: 'test-preset',
    name: 'Custom Test Preset',
    icon: '🧪',
    description: 'Testing presets endpoints & automated verification',
    systemPrompt: `You are a test assistant for automated harness verification.\n\n[Kurumsal Raporlama Standardı]:\n- Asla karmaşık markdown tablosu oluşturma; verileri düz madde imleri (-) ile yaz.\n- Raporu en fazla 4-5 maddede özetle (aşırı uzun ve tekrarlı metinlerden kaçın).\n- Rapor tamamlandığında altına mutlaka "--- RAPOR BİTTİ ---" yazıp dur.`,
    tools: ['bash', 'skill', 'read_file', 'write_file'],
    skills: [],
    workspace: '/home/huseyina/code_mode/COMPANY_ABC',
    specialization: 'test_raporu.md'
  }
}

export const NewPositionModal: React.FC<NewPositionModalProps> = ({
  isOpen,
  onClose,
  positions,
  onAddPosition
}) => {
  const [title, setTitle] = useState('')
  const [role, setRole] = useState('')
  const [icon, setIcon] = useState('👔')
  const [level, setLevel] = useState<PositionLevel>(2)
  const [parentId, setParentId] = useState<string>('ceo')
  const [presetId, setPresetId] = useState('novatrend-cfo')
  const [isCustomPreset, setIsCustomPreset] = useState(false)
  const [customPresetId, setCustomPresetId] = useState('')
  const [customPresetName, setCustomPresetName] = useState('')
  const [customPresetDesc, setCustomPresetDesc] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [customSkillInput, setCustomSkillInput] = useState('')
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(
    `[Kurumsal Raporlama Standardı]:\n- Asla karmaşık markdown tablosu oluşturma; verileri düz madde imleri (-) ile yaz.\n- Raporu en fazla 4-5 maddede özetle (aşırı uzun ve tekrarlı metinlerden kaçın).\n- Rapor tamamlandığında altına mutlaka "--- RAPOR BİTTİ ---" yazıp dur.`
  )
  const [isPromptEdited, setIsPromptEdited] = useState(false)

  const [workspace, setWorkspace] = useState('/home/huseyina/code_mode/COMPANY_ABC')
  const [specialization, setSpecialization] = useState('')
  const [selectedTools, setSelectedTools] = useState<string[]>(['read_file', 'write_file', 'grep_search', 'list_dir'])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])

  const [liveTools, setLiveTools] = useState<Array<{ name: string; description: string }>>([])
  const [toolSearchTerm, setToolSearchTerm] = useState('')
  const [liveSkills, setLiveSkills] = useState<Array<{ id: string; name: string; description?: string }>>([])
  const [skillSearchTerm, setSkillSearchTerm] = useState('')
  const [availablePresets, setAvailablePresets] = useState<any[]>([])

  const refreshTools = () => {
    fetchTools().then(list => {
      if (Array.isArray(list) && list.length > 0) {
        setLiveTools(list)
      }
    })
  }

  const refreshSkills = () => {
    fetchSkills().then(list => {
      if (Array.isArray(list) && list.length > 0) {
        setLiveSkills(list.map((s: any) => ({
          id: s.id || s.name,
          name: s.name || s.id,
          description: s.description || ''
        })))
      }
    })
  }

  useEffect(() => {
    refreshTools()
    refreshSkills()
    fetchPresets().then(list => {
      if (list && list.length > 0) {
        setAvailablePresets(list)
      }
    })
  }, [])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!isPromptEdited) {
      setSystemPrompt(
        `Sen ${val.trim() || 'Yeni Koltuk'} rolündesin. ${role.trim() || ''}\n\n[Kurumsal Raporlama Standardı]:\n- Asla karmaşık markdown tablosu oluşturma; verileri düz madde imleri (-) ile yaz.\n- Raporu en fazla 4-5 maddede özetle (aşırı uzun ve tekrarlı metinlerden kaçın).\n- Rapor tamamlandığında altına mutlaka "--- RAPOR BİTTİ ---" yazıp dur.`
      )
    }
    if (isCustomPreset && !customPresetId) {
      const slug = val
        .toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      if (slug) setCustomPresetId(slug)
    }
  }

  const handleRoleChange = (val: string) => {
    setRole(val)
    if (!isPromptEdited) {
      setSystemPrompt(
        `Sen ${title.trim() || 'Yeni Koltuk'} rolündesin. ${val.trim() || ''}\n\n[Kurumsal Raporlama Standardı]:\n- Asla karmaşık markdown tablosu oluşturma; verileri düz madde imleri (-) ile yaz.\n- Raporu en fazla 4-5 maddede özetle (aşırı uzun ve tekrarlı metinlerden kaçın).\n- Rapor tamamlandığında altına mutlaka "--- RAPOR BİTTİ ---" yazıp dur.`
      )
    }
  }

  const [activeToolCategory, setActiveToolCategory] = useState<ToolCategory>('all')

  const toolCounts = useMemo(() => {
    const counts: Record<ToolCategory, number> = {
      all: liveTools.length,
      fs: 0,
      terminal: 0,
      planning: 0,
      subagent: 0,
      schedule: 0,
      rag_web: 0,
      mcp_skills: 0
    }
    liveTools.forEach(t => {
      const cat = getToolCategory(t.name)
      if (counts[cat] !== undefined) {
        counts[cat]++
      }
    })
    return counts
  }, [liveTools])

  const handleSelectCategoryTools = () => {
    if (activeToolCategory === 'all') {
      handleSelectAllTools()
      return
    }
    const catTools = liveTools.filter(t => getToolCategory(t.name) === activeToolCategory).map(t => t.name)
    setSelectedTools(prev => Array.from(new Set([...prev, ...catTools])))
  }

  const handleDeselectCategoryTools = () => {
    if (activeToolCategory === 'all') {
      handleDeselectAllTools()
      return
    }
    const catToolNames = new Set(liveTools.filter(t => getToolCategory(t.name) === activeToolCategory).map(t => t.name))
    setSelectedTools(prev => prev.filter(name => !catToolNames.has(name)))
  }

  const filteredTools = useMemo(() => {
    return liveTools.filter(t => {
      if (activeToolCategory !== 'all') {
        const cat = getToolCategory(t.name)
        if (cat !== activeToolCategory) return false
      }
      if (toolSearchTerm) {
        const term = toolSearchTerm.toLowerCase()
        const matchName = t.name.toLowerCase().includes(term)
        const matchDesc = t.description && t.description.toLowerCase().includes(term)
        if (!matchName && !matchDesc) return false
      }
      return true
    })
  }, [liveTools, activeToolCategory, toolSearchTerm])

  const allToolNames = liveTools.map(t => t.name)
  const toggleTool = (toolName: string) => {
    setSelectedTools(prev => prev.includes(toolName) ? prev.filter(t => t !== toolName) : [...prev, toolName])
  }
  const handleSelectAllTools = () => {
    setSelectedTools([...allToolNames])
  }
  const handleDeselectAllTools = () => {
    setSelectedTools([])
  }

  const allSkillIds = liveSkills.map(s => s.id || s.name)
  const toggleSkill = (skillId: string) => {
    setSelectedSkills(prev => prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId])
  }
  const handleSelectAllSkills = () => {
    setSelectedSkills([...allSkillIds])
  }
  const handleDeselectAllSkills = () => {
    setSelectedSkills([])
  }

  const handleApplyTemplate = (templateKey: string) => {
    if (!templateKey) return
    const tmpl = PRESET_TEMPLATES[templateKey] || availablePresets.find(p => p.id === templateKey)
    if (!tmpl) return

    setCustomPresetId(tmpl.id ? `${tmpl.id}-v2` : `preset-${Date.now().toString(36)}`)
    setCustomPresetName(tmpl.name || '')
    setCustomPresetDesc(tmpl.description || '')
    setTitle(tmpl.name || title)
    setRole(tmpl.description || role)
    setIcon(tmpl.icon || icon)
    setSystemPrompt(tmpl.systemPrompt || tmpl.personaPrompt || systemPrompt)
    setIsPromptEdited(true)
    if (tmpl.workspace) setWorkspace(tmpl.workspace)
    if (tmpl.specialization) setSpecialization(tmpl.specialization)
    if (Array.isArray(tmpl.tools || tmpl.enabledTools)) {
      setSelectedTools(tmpl.tools || tmpl.enabledTools)
    }
    if (Array.isArray(tmpl.skills || tmpl.enabledSkills)) {
      setSelectedSkills(tmpl.skills || tmpl.enabledSkills)
    }
  }

  const handleAddCustomSkill = () => {
    const trimmed = customSkillInput.trim().toLowerCase()
    if (!trimmed) return
    if (!selectedSkills.includes(trimmed)) {
      setSelectedSkills(prev => [...prev, trimmed])
    }
    setCustomSkillInput('')
  }


  const filteredSkills = liveSkills.filter(s =>
    !skillSearchTerm ||
    s.name.toLowerCase().includes(skillSearchTerm.toLowerCase()) ||
    (s.id && s.id.toLowerCase().includes(skillSearchTerm.toLowerCase())) ||
    (s.description && s.description.toLowerCase().includes(skillSearchTerm.toLowerCase()))
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const id = `pos-${Date.now().toString(36)}`
    const effectivePresetId = isCustomPreset
      ? (customPresetId.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `preset-${Date.now().toString(36)}`)
      : presetId.trim()

    const effectivePresetName = (isCustomPreset && customPresetName.trim())
      ? customPresetName.trim()
      : title.trim()

    const effectivePresetDesc = (isCustomPreset && customPresetDesc.trim())
      ? customPresetDesc.trim()
      : (role.trim() || 'Özel tanımlanmış kurumsal ajan')

    // Save custom preset to backend so backend server permanently knows this preset
    savePreset({
      id: effectivePresetId,
      name: effectivePresetName,
      description: effectivePresetDesc,
      icon: icon.trim() || '👔',
      systemPrompt: systemPrompt.trim(),
      enabledTools: selectedTools,
      enabledSkills: selectedSkills
    }).catch(err => console.warn('[NewPositionModal] Preset save error:', err))

    const newPos: Position = {
      id,
      title: title.trim(),
      role: role.trim() || 'Departman görevi',
      icon: icon.trim() || '👔',
      level,
      parentId: parentId || undefined,
      presetId: effectivePresetId,
      workspace: workspace.trim() || '/home/huseyina/code_mode/COMPANY_ABC',
      specialization: specialization.trim() || undefined,
      tools: selectedTools,
      skills: selectedSkills,
      status: 'idle',
      currentAction: 'Yeni tanımlandı',
      systemPrompt: systemPrompt.trim()
    }

    onAddPosition(newPos)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>➕</span>
            <h2 style={{ fontSize: '20px', color: '#ffffff' }}>Organizasyona Yeni Koltuk Ekle</h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">İkon:</label>
              <input
                type="text"
                className="form-input"
                style={{ textAlign: 'center', fontSize: '22px' }}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Koltuk / Pozisyon Adı:</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Örn: Onursal Başkan, İnsan Kaynakları Müdürü"
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Görev ve Sorumluluk Açıklaması:</label>
            <input
              type="text"
              className="form-input"
              value={role}
              onChange={(e) => handleRoleChange(e.target.value)}
              placeholder="Örn: Yüksek stratejik kararlar, kurumsal vizyon ve teftiş"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">Hiyerarşi Seviyesi:</label>
              <select
                className="form-select"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value) as PositionLevel)}
              >
                <option value={1}>Level 1 — Genel Yönetim / C-Suite</option>
                <option value={2}>Level 2 — İcra Direktörlüğü / Bölüm Müdürlüğü</option>
                <option value={3}>Level 3 — Uzman Analist / Takım Liderliği</option>
                <option value={4}>Level 4 — Operasyonel Uzman / Mühendis</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Bağlı Olduğu Üst Koltuk (Rapor Yeri):</label>
              <select
                className="form-select"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                {positions.map(p => (
                  <option key={p.id} value={p.id}>{p.icon} {p.title} (Level {p.level})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Ajan Preseti:</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setIsCustomPreset(false)}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: !isCustomPreset ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${!isCustomPreset ? '#6366f1' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: !isCustomPreset ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    📋 Mevcut Seç
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomPreset(true)
                      if (!customPresetId && title) {
                        const slug = title
                          .toLowerCase()
                          .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '')
                        setCustomPresetId(slug)
                      }
                    }}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: isCustomPreset ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${isCustomPreset ? '#a855f7' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: isCustomPreset ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    ✨ Özel Preset Tanımla
                  </button>
                </div>
              </div>

              {isCustomPreset ? (
                <div style={{
                  padding: '9px 12px',
                  background: 'rgba(168, 85, 247, 0.12)',
                  border: '1px dashed rgba(168, 85, 247, 0.4)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#d8b4fe',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>✨</span>
                  <span>Özel Preset Modu Aktif (Aşağıdaki mor panelden yapılandırın)</span>
                </div>
              ) : (
                <select
                  className="form-select mono"
                  value={presetId}
                  onChange={(e) => {
                    if (e.target.value === '__new_custom__') {
                      setIsCustomPreset(true)
                    } else {
                      setPresetId(e.target.value)
                    }
                  }}
                >
                  <option value="__new_custom__">✨ + Yeni Özel Preset Tanımla...</option>
                  {availablePresets.map(p => (
                    <option key={p.id} value={p.id}>{p.id} ({p.name || p.id})</option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Çalışma Alanı (Workspace):</label>
              <input
                type="text"
                className="form-input mono"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="/home/huseyina/code_mode/COMPANY_ABC"
              />
            </div>
          </div>

          {/* Dedicated Colored Custom Preset Configuration Card */}
          {isCustomPreset && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(168, 85, 247, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>✨</span>
                  <span style={{ fontWeight: 600, color: '#f3e8ff', fontSize: '14px' }}>Özel Agent Preseti (Profile) Yapılandırması</span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.25)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.35)' }}>
                    novatrend-kalite & test preset standardı
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowJsonPreview(!showJsonPreview)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    background: showJsonPreview ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    color: '#d8b4fe',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {showJsonPreview ? '👁️ JSON Gizle' : '📄 JSON Önizleme'}
                </button>
              </div>

              {/* Template Loader Box */}
              <div style={{ marginBottom: '14px', background: 'rgba(0, 0, 0, 0.35)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#e9d5ff', margin: 0 }}>
                    📥 Bir Presetten Şablon Kopyala (İsteğe Bağlı):
                  </label>
                  <span style={{ fontSize: '10px', color: '#c084fc' }}>novatrend-kalite, ceo veya test presetini baz al</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-select mono"
                    style={{ fontSize: '12px', padding: '6px 10px', flex: 1 }}
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    <option value="">— Bir Şablon Seç —</option>
                    <option value="novatrend-kalite">🛡️ novatrend-kalite (Kalite & İade Müdürü)</option>
                    <option value="novatrend-cfo">📊 novatrend-cfo (Kıdemli CFO & Finans)</option>
                    <option value="novatrend-tedarik">📦 novatrend-tedarik (Tedarik Zinciri & Stok)</option>
                    <option value="ceo">👑 ceo (Genel Müdür & CEO)</option>
                    <option value="test-preset">🧪 test-preset (Otomasyon & Test Preseti)</option>
                    {availablePresets.filter(p => !['novatrend-kalite', 'novatrend-cfo', 'novatrend-tedarik', 'ceo', 'test-preset'].includes(p.id)).map(p => (
                      <option key={p.id} value={p.id}>{p.icon || '👤'} {p.id} ({p.name || p.id})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(selectedTemplateId)}
                    disabled={!selectedTemplateId}
                    style={{
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: selectedTemplateId ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: selectedTemplateId ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ⚡ Şablonu Yükle
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', color: '#d8b4fe', marginBottom: '4px' }}>
                    Preset ID (Slug / Dosya Adı) *
                  </label>
                  <input
                    type="text"
                    className="form-input mono"
                    value={customPresetId}
                    onChange={(e) => setCustomPresetId(e.target.value)}
                    placeholder="Örn: novatrend-kalite, test-preset, hr-lead"
                    required
                  />
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
                    Backend'de <code>{customPresetId || 'yeni-preset'}.json</code> olarak saklanır.
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '11px', color: '#d8b4fe', marginBottom: '4px' }}>
                    Preset Profil Adı (Name)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={customPresetName !== '' ? customPresetName : title}
                    onChange={(e) => setCustomPresetName(e.target.value)}
                    placeholder={title || "Örn: NovaTrend Kalite Güvence Müdürü"}
                  />
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
                    Ajan listelerinde görünecek resmi profil adı
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '11px', color: '#d8b4fe', marginBottom: '4px' }}>
                  Preset Görev & Sorumluluk Özeti (Description)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={customPresetDesc !== '' ? customPresetDesc : role}
                  onChange={(e) => setCustomPresetDesc(e.target.value)}
                  placeholder={role || "Örn: Ürün iade oranlarını, kusurlu serileri ve sözleşme cezalarını denetler..."}
                />
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
                  Preset dosyasındaki ("description") görev tanımı
                </div>
              </div>

              {/* Preset Metadata Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Preset Eşleşmesi:</span>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }}>
                  İkon: {icon || '👔'}
                </span>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}>
                  🛠️ {selectedTools.length} Araç Aktif
                </span>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.2)', color: '#fde047' }}>
                  ⚡ {selectedSkills.length} Beceri Aktif
                </span>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.2)', color: '#86efac' }}>
                  🧠 Sistem Promptu Bağlı
                </span>
              </div>

              {showJsonPreview && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#d8b4fe', fontWeight: 600, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📄 Oluşturulacak Preset JSON (novatrend-kalite.json & test preset formatı):</span>
                    <span className="mono" style={{ color: '#94a3b8' }}>{customPresetId || 'yeni-preset'}.json</span>
                  </div>
                  <pre style={{
                    background: '#090d16',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '11px',
                    color: '#a7f3d0',
                    fontFamily: 'var(--font-mono)',
                    overflowX: 'auto',
                    maxHeight: '220px',
                    margin: 0,
                    lineHeight: 1.5
                  }}>
                    {JSON.stringify({
                      id: customPresetId || 'yeni-preset',
                      name: (customPresetName !== '' ? customPresetName : title) || 'Yeni Koltuk',
                      icon: icon || '👔',
                      description: (customPresetDesc !== '' ? customPresetDesc : role) || 'Özel tanımlanmış kurumsal ajan',
                      systemPrompt: systemPrompt.length > 80 ? `${systemPrompt.slice(0, 80)}...` : systemPrompt,
                      enabledTools: selectedTools,
                      enabledSkills: selectedSkills
                    }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* System Prompt / Persona Field */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🧠 Sistem İstemi & Persona Talimatları (System Prompt):</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ajanın düşünce tarzı, kuralları ve uzmanlığı</span>
            </label>
            <textarea
              className="form-textarea"
              style={{ minHeight: '90px', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.45 }}
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value)
                setIsPromptEdited(true)
              }}
              placeholder="Ajanın rol ve davranış talimatları..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Uzmanlık Dosyaları / Rotalar:</label>
            <input
              type="text"
              className="form-input mono"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="Örn: ik/bordro_harcamalari.csv, sozl/sozlesmeler.md"
            />
          </div>

          {/* Available Tools Selector */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#e2e8f0' }}>
                  🛠️ Yetkili Servis Araçları ({liveTools.length} Araç Aktif)
                </label>
                <span style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.2)', color: '#c7d2fe', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
                  {selectedTools.length} Seçili
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={refreshTools}
                  title="Araç Listesini Yenile"
                  style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '4px', color: '#93c5fd', cursor: 'pointer' }}
                >
                  🔄 Yenile
                </button>
                {activeToolCategory !== 'all' && (
                  <>
                    <button
                      type="button"
                      onClick={handleSelectCategoryTools}
                      title="Yalnızca bu sınıftaki araçları seç"
                      style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(56, 189, 248, 0.2)', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '4px', color: '#7dd3fc', cursor: 'pointer' }}
                    >
                      ✓ Bu Sınıfı Seç
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectCategoryTools}
                      title="Bu sınıftaki araçların seçimini kaldır"
                      style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', color: '#fca5a5', cursor: 'pointer' }}
                    >
                      ✕ Bu Sınıfı Kaldır
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleSelectAllTools}
                  style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '4px', color: '#c7d2fe', cursor: 'pointer' }}
                >
                  ✓ Tümünü Seç
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllTools}
                  style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', color: '#fca5a5', cursor: 'pointer' }}
                >
                  ✕ Tümünü Kaldır
                </button>
              </div>
            </div>

            {/* Tool Class Category Filter Pills */}
            <div style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '8px',
              marginBottom: '10px'
            }}>
              {TOOL_CLASSES.map(cls => {
                const isActive = activeToolCategory === cls.id
                const count = toolCounts[cls.id] || 0
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setActiveToolCategory(cls.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      border: isActive ? `1px solid ${cls.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isActive ? cls.badgeBg : 'rgba(255, 255, 255, 0.03)',
                      color: isActive ? '#fff' : '#94a3b8',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{cls.icon}</span>
                    <span>{cls.label}</span>
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: isActive ? cls.color : 'rgba(255, 255, 255, 0.08)',
                      color: isActive ? '#000' : '#64748b',
                      fontWeight: 700
                    }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div style={{ marginBottom: '8px' }}>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '12px', padding: '6px 10px' }}
                placeholder="🔍 Araç veya açıklama ara (örn: bash, edit, rag, sql)..."
                value={toolSearchTerm}
                onChange={(e) => setToolSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px', maxHeight: '240px', overflowY: 'auto' }}>
              {filteredTools.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  Seçili Tool Sınıfında veya arama sonucunda araç bulunamadı.
                </div>
              ) : (
                filteredTools.map((t) => {
                  const isSelected = selectedTools.includes(t.name)
                  const meta = getToolCategoryMeta(t.name)
                  return (
                    <label
                      key={t.name}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '8px 10px',
                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        border: isSelected ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTool(t.name)}
                        style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#6366f1' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <code style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#f1f5f9' : '#cbd5e1' }}>
                            {t.name}
                          </code>
                          <span style={{
                            fontSize: '9px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: meta.badgeBg,
                            color: meta.color,
                            fontWeight: 600,
                            lineHeight: 1.2
                          }}>
                            {meta.icon} {meta.label}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', lineHeight: 1.3 }}>
                          {t.description || 'Araç tanımı mevcut değil'}
                        </span>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* Available Skills Selector */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#e2e8f0' }}>
                  ⚡ Yetkili Uzmanlık Becerileri ({liveSkills.length} Beceri Mevcut)
                </label>
                <span style={{ fontSize: '11px', background: 'rgba(168, 85, 247, 0.2)', color: '#e9d5ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
                  {selectedSkills.length} Seçili
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={refreshSkills}
                  title="Beceri Listesini Yenile"
                  style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '4px', color: '#93c5fd', cursor: 'pointer' }}
                >
                  🔄 Yenile
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllSkills}
                  style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '4px', color: '#e9d5ff', cursor: 'pointer' }}
                >
                  ✓ Tümünü Seç
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllSkills}
                  style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', color: '#fca5a5', cursor: 'pointer' }}
                >
                  ✕ Tümünü Kaldır
                </button>
              </div>
            </div>

            {/* Quick Company Skills Badges */}
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>🏢 Hızlı Şirket Becerileri:</span>
              {COMPANY_SKILLS.map(cs => {
                const isSel = selectedSkills.includes(cs.id)
                return (
                  <button
                    key={cs.id}
                    type="button"
                    onClick={() => toggleSkill(cs.id)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: isSel ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${isSel ? '#a855f7' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: isSel ? '#f3e8ff' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    {cs.icon} {cs.id} {isSel ? '✓' : '+'}
                  </button>
                )
              })}
            </div>

            {/* Custom Skill Input */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="text"
                className="form-input mono"
                style={{ fontSize: '12px', padding: '6px 10px', flex: 1 }}
                placeholder="Özel beceri adı yaz (örn: kalite-ve-iade-kontrol, musteri-analizi)..."
                value={customSkillInput}
                onChange={(e) => setCustomSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomSkill()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddCustomSkill}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  background: 'rgba(168, 85, 247, 0.25)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  color: '#e9d5ff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                + Beceri Ekle
              </button>
            </div>

            {/* Selected Skills Chips */}
            {selectedSkills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', alignSelf: 'center' }}>Seçili:</span>
                {selectedSkills.map(sk => (
                  <span
                    key={sk}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(168, 85, 247, 0.25)',
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      color: '#f3e8ff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <code>{sk}</code>
                    <span
                      onClick={() => toggleSkill(sk)}
                      style={{ cursor: 'pointer', color: '#fca5a5', fontWeight: 'bold' }}
                      title="Kaldır"
                    >
                      ✕
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div style={{ marginBottom: '8px' }}>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '12px', padding: '6px 10px' }}
                placeholder="🔍 Beceri veya açıklama ara (örn: butce, tedarik, sql, rag)..."
                value={skillSearchTerm}
                onChange={(e) => setSkillSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
              {filteredSkills.length === 0 ? (
                <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '12px' }}>
                  Tanımlı aktif beceri bulunamadı.
                </div>
              ) : (
                filteredSkills.map((s) => {
                  const skillId = s.id || s.name
                  const isSelected = selectedSkills.includes(skillId) || selectedSkills.includes(s.name)
                  return (
                    <label
                      key={skillId}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '8px 10px',
                        background: isSelected ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: isSelected ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSkill(skillId)}
                        style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#a855f7' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <code style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#f1f5f9' : '#94a3b8' }}>
                          {s.name}
                        </code>
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                          {s.description || 'Özel uzmanlık becerisi'}
                        </span>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Vazgeç
            </button>
            <button type="submit" className="btn-primary">
              Koltuk Tanımını Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
