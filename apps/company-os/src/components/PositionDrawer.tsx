import React, { useState, useEffect, useMemo } from 'react'
import type { Position, PositionLevel, ActivityReceipt } from '../types.js'
import { fetchSkills, fetchPresets, fetchTools, savePreset, browseWorkspace } from '../api.js'
import { TOOL_CLASSES, ToolCategory, getToolCategory, getToolCategoryMeta } from '../toolCategories.js'

interface PositionDrawerProps {
  position: Position | null
  onClose: () => void
  onSendInstruction: (pos: Position, prompt: string) => void
  onViewReport: (reportPath: string) => void
  receipts: ActivityReceipt[]
  isExecuting: boolean
  onUpdatePosition: (updated: Position) => void
  onDeletePosition: (positionId: string) => void
  companyWorkspace?: string
}

export const PositionDrawer: React.FC<PositionDrawerProps> = ({
  position,
  onClose,
  onSendInstruction,
  onViewReport,
  receipts,
  isExecuting,
  onUpdatePosition,
  onDeletePosition,
  companyWorkspace
}) => {
  const [prompt, setPrompt] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Edit form states with safe fallbacks
  const [editTitle, setEditTitle] = useState(position?.title || '')
  const [editRole, setEditRole] = useState(position?.role || '')
  const [editIcon, setEditIcon] = useState(position?.icon || '👔')
  const [editLevel, setEditLevel] = useState<PositionLevel>(position?.level || 2)
  const [editPresetId, setEditPresetId] = useState(position?.presetId || 'novatrend-cfo')
  const [isCustomPreset, setIsCustomPreset] = useState(false)
  const [editWorkspace, setEditWorkspace] = useState(position?.workspace || '')
  const [editSpecialization, setEditSpecialization] = useState(position?.specialization || '')
  const [editSystemPrompt, setEditSystemPrompt] = useState(position?.systemPrompt || '')
  const [editTools, setEditTools] = useState<string[]>(position?.tools || [])
  const [editSkills, setEditSkills] = useState<string[]>(position?.skills || [])
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([])

  const rootWs = companyWorkspace || '/home/huseyina/code_mode/COMPANY_ABC'

  useEffect(() => {
    browseWorkspace(rootWs).then(res => {
      if (res?.directories) {
        setWorkspaceFolders(res.directories)
      }
    })
  }, [rootWs])

  // Dynamic tools, skills & presets from backend API
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

  // Reset form when position or available presets change
  useEffect(() => {
    if (position) {
      setEditTitle(position.title)
      setEditRole(position.role)
      setEditIcon(position.icon)
      setEditLevel(position.level)
      setEditPresetId(position.presetId)
      setEditWorkspace(position.workspace)
      setEditSpecialization(position.specialization || '')
      const matchingPreset = availablePresets.find(p => p.id === position.presetId)
      setEditSystemPrompt(position.systemPrompt || matchingPreset?.systemPrompt || '')
      setEditTools(position.tools || [])
      setEditSkills(position.skills || [])
      setIsEditing(false)
    }
  }, [position, availablePresets])

  // Load available tools, skills and presets on mount
  useEffect(() => {
    refreshTools()
    refreshSkills()
    fetchPresets().then(list => {
      if (list && list.length > 0) {
        setAvailablePresets(list)
      }
    })
  }, [])

  const allToolNames = liveTools.map(t => t.name)
  const toggleTool = (toolName: string) => {
    setEditTools(prev => prev.includes(toolName) ? prev.filter(t => t !== toolName) : [...prev, toolName])
  }
  const handleSelectAllTools = () => {
    setEditTools([...allToolNames])
  }
  const handleDeselectAllTools = () => {
    setEditTools([])
  }

  const allSkillIds = liveSkills.map(s => s.id || s.name)
  const toggleSkill = (skillId: string) => {
    setEditSkills(prev => prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId])
  }
  const handleSelectAllSkills = () => {
    setEditSkills([...allSkillIds])
  }
  const handleDeselectAllSkills = () => {
    setEditSkills([])
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
    setEditTools(prev => Array.from(new Set([...prev, ...catTools])))
  }

  const handleDeselectCategoryTools = () => {
    if (activeToolCategory === 'all') {
      handleDeselectAllTools()
      return
    }
    const catToolNames = new Set(liveTools.filter(t => getToolCategory(t.name) === activeToolCategory).map(t => t.name))
    setEditTools(prev => prev.filter(name => !catToolNames.has(name)))
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

  const filteredSkills = liveSkills.filter(s =>
    !skillSearchTerm ||
    s.name.toLowerCase().includes(skillSearchTerm.toLowerCase()) ||
    (s.id && s.id.toLowerCase().includes(skillSearchTerm.toLowerCase())) ||
    (s.description && s.description.toLowerCase().includes(skillSearchTerm.toLowerCase()))
  )

  if (!position) return null

  const positionReceipts = receipts.filter(r => r.positionId === position.id)

  const handleSubmitInstruction = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isExecuting) return
    onSendInstruction(position, prompt.trim())
    setPrompt('')
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    const updated: Position = {
      ...position,
      title: editTitle.trim() || position.title,
      role: editRole.trim() || position.role,
      icon: editIcon.trim() || position.icon,
      level: editLevel,
      presetId: editPresetId.trim() || position.presetId,
      workspace: editWorkspace.trim() || position.workspace,
      specialization: editSpecialization.trim() || undefined,
      systemPrompt: editSystemPrompt.trim() || undefined,
      tools: editTools,
      skills: editSkills
    }
    onUpdatePosition(updated)

    // Also persist to backend preset file
    savePreset({
      id: editPresetId.trim() || position.presetId,
      name: editTitle.trim() || position.title,
      systemPrompt: editSystemPrompt.trim(),
      enabledTools: editTools,
      enabledSkills: editSkills
    })

    setIsEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm(`"${position.title}" koltuğunu organizasyondan silmek istediğinize emin misiniz?`)) {
      onDeletePosition(position.id)
    }
  }

  return (
    <div className="drawer-overlay">
      <div className="drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="card-avatar">{position.icon}</div>
          <div>
            <h2 style={{ fontSize: '18px', color: '#ffffff' }}>{position.title}</h2>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Level {position.level} • Preset: <span className="mono">{position.presetId}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isEditing ? (
            <>
              <button
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => setIsEditing(true)}
                title="Koltuğu ve Yetkilerini Düzenle"
              >
                ✏️ Düzenle
              </button>
              <button
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                onClick={handleDelete}
                title="Koltuğu Şemadan Sil"
              >
                🗑️ Sil
              </button>
            </>
          ) : (
            <button
              className="btn-secondary"
              style={{ padding: '5px 10px', fontSize: '12px' }}
              onClick={() => setIsEditing(false)}
            >
              Vazgeç
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="drawer-body">
        {isEditing ? (
          /* ================= EDIT MODE ================= */
          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">İkon:</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ textAlign: 'center', fontSize: '20px' }}
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  maxLength={4}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Koltuk Unvanı:</label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Görev & Sorumluluk Açıklaması:</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: '60px' }}
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🧠 Sistem İstemi & Persona Talimatları (System Prompt):</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ajanın düşünce ve yazım kuralları</span>
              </label>
              <textarea
                className="form-textarea"
                style={{ minHeight: '110px', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.45 }}
                value={editSystemPrompt}
                onChange={(e) => setEditSystemPrompt(e.target.value)}
                placeholder="Örn: Sen NovaTrend Kalite Güvence Müdürüsün. Net ve öz ol, karmaşık tablolar yerine madde imleri kullan, rapor sonuna '--- RAPOR TAMAMLANDI ---' ekle..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Hiyerarşi Seviyesi:</label>
                <select
                  className="form-select"
                  value={editLevel}
                  onChange={(e) => setEditLevel(Number(e.target.value) as PositionLevel)}
                >
                  <option value={1}>Level 1 — Genel Yönetim (C-Suite)</option>
                  <option value={2}>Level 2 — İcra Direktörlüğü / Bölüm Müdürlüğü</option>
                  <option value={3}>Level 3 — Uzman Analist / Takım Liderliği</option>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Ajan Preseti:</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomPreset(!isCustomPreset)}
                    style={{
                      fontSize: '11px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: isCustomPreset ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${isCustomPreset ? '#a855f7' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: isCustomPreset ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    {isCustomPreset ? '📋 Listeden Seç' : '✏️ Özel ID Yaz'}
                  </button>
                </div>
                {isCustomPreset ? (
                  <input
                    type="text"
                    className="form-input mono"
                    value={editPresetId}
                    onChange={(e) => setEditPresetId(e.target.value)}
                    placeholder="Örn: onursal-baskan, ozel-preset"
                  />
                ) : (
                  <select
                    className="form-select mono"
                    value={editPresetId}
                    onChange={(e) => {
                      const newId = e.target.value
                      setEditPresetId(newId)
                      const pr = availablePresets.find(p => p.id === newId)
                      if (pr?.systemPrompt) {
                        setEditSystemPrompt(pr.systemPrompt)
                      }
                    }}
                  >
                    {availablePresets.map(p => (
                      <option key={p.id} value={p.id}>{p.id} ({p.name || p.id})</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Çalışma Alanı (Workspace):</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ajanın görebileceği kök dizin</span>
              </label>
              <input
                type="text"
                className="form-input mono"
                value={editWorkspace}
                onChange={(e) => setEditWorkspace(e.target.value)}
                required
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEditWorkspace(rootWs)}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: editWorkspace === rootWs ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${editWorkspace === rootWs ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: editWorkspace === rootWs ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  🏢 Kök Dizin
                </button>
                {workspaceFolders.map(dir => {
                  const fullDir = `${rootWs}/${dir}`
                  const isSelected = editWorkspace === fullDir
                  return (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setEditWorkspace(fullDir)}
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
                        color: isSelected ? '#34d399' : '#94a3b8',
                        cursor: 'pointer'
                      }}
                    >
                      📁 /{dir}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Uzmanlık Verileri / Dosyalar:</label>
              <input
                type="text"
                className="form-input mono"
                value={editSpecialization}
                onChange={(e) => setEditSpecialization(e.target.value)}
                placeholder="Örn: finans/Q3_2025_Butce_ve_Harcamalar.csv"
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
                    {editTools.length} Seçili
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px', maxHeight: '340px', overflowY: 'auto' }}>
                {filteredTools.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    Seçili Tool Sınıfında veya arama sonucunda araç bulunamadı.
                  </div>
                ) : (
                  filteredTools.map((t) => {
                    const isSelected = editTools.includes(t.name)
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
                    {editSkills.length} Seçili
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px', maxHeight: '260px', overflowY: 'auto' }}>
                {filteredSkills.length === 0 ? (
                  <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '12px' }}>
                    Tanımlı aktif beceri bulunamadı.
                  </div>
                ) : (
                  filteredSkills.map((s) => {
                    const skillId = s.id || s.name
                    const isSelected = editSkills.includes(skillId) || editSkills.includes(s.name)
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                💾 Değişiklikleri Kaydet
              </button>
              <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>
                Vazgeç
              </button>
            </div>
          </form>
        ) : (
          /* ================= VIEW MODE ================= */
          <>
            {/* Role & Specialization */}
            <div>
              <h4 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Görev & Sorumluluk
              </h4>
              <p style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: 1.5 }}>{position.role}</p>
            </div>

            {/* System Prompt & Persona */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h4 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', margin: 0 }}>
                  🧠 Sistem İstemi & Persona Talimatları
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11.5px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  ✏️ Değiştir
                </button>
              </div>
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '12px',
                color: '#cbd5e1',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                maxHeight: '140px',
                overflowY: 'auto'
              }}>
                {position.systemPrompt || availablePresets.find(p => p.id === position.presetId)?.systemPrompt || 'Özel sistem istemi atanmamış. Varsayılan sistem talimatı kullanılıyor.'}
              </div>
            </div>

            {/* Specialization & Workspace */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Çalışma Alanı (Workspace):</div>
              <div className="mono" style={{ fontSize: '12px', color: '#38bdf8' }}>{position.workspace}</div>

              {position.specialization && (
                <>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', marginBottom: '4px' }}>Uzmanlık Verileri:</div>
                  <div className="mono" style={{ fontSize: '12px', color: '#fde68a' }}>{position.specialization}</div>
                </>
              )}
            </div>

            {/* Tools Assigned */}
            <div>
              <h4 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Yetkili Araçlar ({position.tools.length})
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {position.tools.map(t => (
                  <span key={t} className="tool-tag" style={{ fontSize: '11px', padding: '3px 8px' }}>
                    ⚙️ {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Skills Assigned */}
            {position.skills && position.skills.length > 0 && (
              <div>
                <h4 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Yetkili Uzmanlık Becerileri (Skills - {position.skills.length})
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {position.skills.map(s => (
                    <span
                      key={s}
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#fde68a',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                      }}
                    >
                      ⚡ {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Instruction Form */}
            <div>
              <h4 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Bu Koltuğa Doğrudan Görev Ver
              </h4>
              <form onSubmit={handleSubmitInstruction}>
                <textarea
                  className="form-textarea"
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                  placeholder={`Örn: ${position.title} için özel analiz veya denetim talimatı...`}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isExecuting}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                  disabled={isExecuting || !prompt.trim()}
                >
                  <span>{isExecuting ? '⏳ Görev Yürütülüyor...' : '🚀 Görevi Başlat'}</span>
                </button>
              </form>
            </div>

            {/* Latest Report */}
            {position.lastReport && (
              <div>
                <h4 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Son Üretilen Rapor
                </h4>
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '14px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                      {position.lastReport.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#38bdf8' }}>
                      Tarih: {position.lastReport.date}
                    </div>
                  </div>
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => onViewReport(position.lastReport!.path)}
                  >
                    Görüntüle ➔
                  </button>
                </div>
              </div>
            )}

            {/* Activity Receipts / Audit Trail */}
            <div>
              <h4 style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Eylem Günlüğü (Audit Trail)
              </h4>
              {positionReceipts.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  Bu koltuk için henüz kayıtlı eylem bulunmuyor.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {positionReceipts.map(r => (
                    <div
                      key={r.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        padding: '10px',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: '4px' }}>
                        <span className="mono">[{r.actionType.toUpperCase()}]</span>
                        <span>{new Date(r.timestamp).toLocaleTimeString('tr-TR')}</span>
                      </div>
                      <div style={{ color: '#e2e8f0' }}>{r.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
