import React, { useState, useEffect } from 'react'
import type { Position } from '../types.js'
import { fetchSettings } from '../api.js'

interface SettingsPageProps {
  companyName: string
  companyWorkspace: string
  positions: Position[]
  onSaveWorkspace: (name: string, workspace: string, updateAllPositions: boolean) => void
  skillsCount?: number
  threadsCount?: number
}

interface RealModelItem {
  id: string
  name: string
  providerId: string
  providerName: string
  baseURL: string
  contextWindow?: number
  maxTokens?: number
  reasoningFormat?: string
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  companyName,
  companyWorkspace,
  positions,
  onSaveWorkspace,
  skillsCount = 0,
  threadsCount = 0
}) => {
  const [name, setName] = useState(companyName)
  const [workspace, setWorkspace] = useState(companyWorkspace)
  const [updateAllPositions, setUpdateAllPositions] = useState(true)
  const [isSavedRecently, setIsSavedRecently] = useState(false)
  const [isLoadingBackend, setIsLoadingBackend] = useState(true)

  // Real backend configuration state
  const [availableModels, setAvailableModels] = useState<RealModelItem[]>([])
  const [defaultModel, setDefaultModel] = useState<string>('')
  const [defaultProvider, setDefaultProvider] = useState<string>('')
  const [sandboxMode, setSandboxMode] = useState<string>('workspace-write')
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(true)
  const [activePluginsList, setActivePluginsList] = useState<{ id: string; name: string; category?: string }[]>([])

  // Load real settings from backend port 3080
  useEffect(() => {
    setName(companyName)
    setWorkspace(companyWorkspace)

    async function loadRealSettings() {
      setIsLoadingBackend(true)
      try {
        const data = await fetchSettings()
        if (data) {
          if (data.workspace) {
            setWorkspace(data.workspace)
          }
          if (data.sandboxMode) {
            setSandboxMode(data.sandboxMode)
          }
          if (typeof data.thinkingEnabled === 'boolean') {
            setThinkingEnabled(data.thinkingEnabled)
          }

          // Extract real models from providers
          const models: RealModelItem[] = []
          const allProviders: Record<string, any> = {
            ...(data.providers || {})
          }
          if (Object.keys(allProviders).length === 0 && data['llm-pi-ai']?.providers) {
            Object.assign(allProviders, data['llm-pi-ai'].providers)
          }

          for (const [pId, pData] of Object.entries(allProviders)) {
            const pName = pData.displayName || pData.name || pId
            const baseURL = pData.baseURL || ''
            if (Array.isArray(pData.models)) {
              for (const m of pData.models) {
                models.push({
                  id: m.id,
                  name: m.name || m.id,
                  providerId: pId,
                  providerName: pName,
                  baseURL,
                  contextWindow: m.contextWindow,
                  maxTokens: m.maxTokens,
                  reasoningFormat: m.reasoningFormat
                })
              }
            }
          }

          setAvailableModels(models)

          const activeProviderId = data['agent-default-model']?.provider || data.defaultProvider || models[0]?.providerId || ''
          const activeModelId = data['agent-default-model']?.model || data.defaultModel || models.find(m => m.providerId === activeProviderId)?.id || models[0]?.id || ''
          setDefaultModel(activeModelId)
          setDefaultProvider(activeProviderId)

          // Extract active plugins
          if (data.plugins) {
            const plugins = Object.values(data.plugins)
              .filter((p: any) => p && p.enabled !== false)
              .map((p: any) => ({
                id: p.id,
                name: p.name || p.id,
                category: p.category || 'tool'
              }))
            setActivePluginsList(plugins)
          }
        }
      } catch (err) {
        console.error('[SettingsPage] Backend ayarları alınamadı:', err)
      } finally {
        setIsLoadingBackend(false)
      }
    }

    loadRealSettings()
  }, [companyName, companyWorkspace])

  const quickPaths = [
    { label: 'COMPANY_ABC (E-Ticaret Verileri & Raporlar)', path: '/home/huseyina/code_mode/COMPANY_ABC' },
    { label: 'custom-harness (Sistem & Kod Monorepo)', path: '/home/huseyina/code_mode/custom-harness' }
  ]

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !workspace.trim()) return

    // 1. Save workspace & company in frontend and sync with backend
    onSaveWorkspace(name.trim(), workspace.trim(), updateAllPositions)

    // 2. Persist real settings directly to backend port 3080
    try {
      // Update sandbox mode via real endpoint
      await fetch('/api/settings/sandbox-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: sandboxMode })
      })

      // Update default model & thinking
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: workspace.trim(),
          defaultModel,
          defaultProvider,
          thinkingEnabled,
          'agent-default-model': {
            model: defaultModel,
            provider: defaultProvider
          }
        })
      })
    } catch (err) {
      console.warn('[SettingsPage] Backend güncelleme hatası:', err)
    }

    setIsSavedRecently(true)
    setTimeout(() => setIsSavedRecently(false), 3000)
  }

  const selectedModelDetails = availableModels.find(m => m.id === defaultModel && (!defaultProvider || m.providerId === defaultProvider)) || availableModels.find(m => m.id === defaultModel)

  return (
    <div style={{
      padding: '28px 36px',
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      color: '#f8fafc'
    }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px'
          }}>
            ⚙️
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
              Sistem Ayarları & Çalışma Alanı
            </h1>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Şirket kök dizini, yerel LLM modelleri (Port 3080 backend), sandbox yalıtımı ve runtime orkestrasyonu.
            </p>
          </div>
        </div>

        {/* Global Save Indicator */}
        {isSavedRecently && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600
          }}>
            ✓ Ayarlar backend (Port 3080) ile senkronize edildi
          </div>
        )}
      </div>

      <form onSubmit={handleSaveAll} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Row 1: Workspace & Real LLM Models */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px'
        }}>
          {/* Card 1: Şirket Bilgileri & Workspace */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>🏢</span>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
                Şirket & Ana Çalışma Alanı
              </h3>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1' }}>
                Şirket / Organizasyon Adı:
              </label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: COMPANY_ABC, NOVA_HOLDING..."
                required
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#ffffff',
                  fontSize: '13.5px'
                }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1' }}>
                  Ana Kök Dizin (Root Workspace):
                </label>
                <span style={{ fontSize: '11px', color: '#38bdf8' }}>Dosya & Rapor Kök Dizini</span>
              </div>
              <input
                type="text"
                className="form-input mono"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="/home/huseyina/code_mode/COMPANY_ABC"
                required
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#38bdf8',
                  fontSize: '12.5px',
                  fontFamily: 'monospace'
                }}
              />

              {/* Quick Select Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Hızlı Seçiciler:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {quickPaths.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => setWorkspace(item.path)}
                      style={{
                        fontSize: '11.5px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: workspace === item.path ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${workspace === item.path ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                        color: workspace === item.path ? '#38bdf8' : '#cbd5e1',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      📁 {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sync All Positions Checkbox */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <input
                type="checkbox"
                id="updateAllPositionsSettings"
                checked={updateAllPositions}
                onChange={(e) => setUpdateAllPositions(e.target.checked)}
                style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#6366f1' }}
              />
              <label htmlFor="updateAllPositionsSettings" style={{ cursor: 'pointer', fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.45 }}>
                <strong>Tüm bağlı departman koltuklarının çalışma alanını senkronize et</strong>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                  CEO, CFO, Tedarik ve Operasyon ajanları bu kök dizine yönlendirilir. (Özel atanmış CTO monorepo hariç tutulur).
                </div>
              </label>
            </div>
          </div>

          {/* Card 2: Real LLM Models & Providers (From Backend Port 3080) */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🧠</span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
                  Yerel Model Sağlayıcıları & LLM Runtime
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                {isLoadingBackend ? 'Yükleniyor...' : `${availableModels.length} Model Hazır`}
              </span>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1' }}>
                Sistem Aktif Modeli:
              </label>
              <select
                className="form-input"
                value={defaultProvider && defaultModel ? `${defaultProvider}:::${defaultModel}` : defaultModel}
                onChange={(e) => {
                  const val = e.target.value
                  if (val.includes(':::')) {
                    const [pId, mId] = val.split(':::')
                    setDefaultProvider(pId)
                    setDefaultModel(mId)
                  } else {
                    setDefaultModel(val)
                    const found = availableModels.find(m => m.id === val)
                    if (found) setDefaultProvider(found.providerId)
                  }
                }}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#ffffff',
                  fontSize: '13px'
                }}
              >
                {availableModels.map(m => (
                  <option key={`${m.providerId}_${m.id}`} value={`${m.providerId}:::${m.id}`}>
                    {m.name} — {m.providerName}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Model Real Technical Details */}
            {selectedModelDetails && (
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Sunucu / Endpoint:</span>
                  <span className="mono" style={{ color: '#38bdf8' }}>{selectedModelDetails.baseURL}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Bağlam Penceresi (Context Window):</span>
                  <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{selectedModelDetails.contextWindow ? `${selectedModelDetails.contextWindow.toLocaleString()} token` : 'Standart'}</span>
                </div>
                {selectedModelDetails.reasoningFormat && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Muhakeme Formatı:</span>
                    <span style={{ color: '#c084fc', fontWeight: 600 }}>{selectedModelDetails.reasoningFormat}</span>
                  </div>
                )}
              </div>
            )}

            {/* Real Thinking & Reasoning Toggle */}
            <div style={{
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#f8fafc' }}>
                  Düşünce Süreci (Thinking & CoT)
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Modelin yanıt üretmeden önce muhakeme adımlarını görünür kılmasını sağlar.
                </div>
              </div>
              <input
                type="checkbox"
                checked={thinkingEnabled}
                onChange={(e) => setThinkingEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#38bdf8' }}
              />
            </div>

            {/* Governance & Real Backend Sandbox Mode */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1' }}>
                Backend Sandbox Güvenlik Modu:
              </label>
              <select
                className="form-input"
                value={sandboxMode}
                onChange={(e) => setSandboxMode(e.target.value)}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#ffffff',
                  fontSize: '13px'
                }}
              >
                <option value="workspace-write">workspace-write (Sadece Kök Dizin İçine Yazma - Güvenli)</option>
                <option value="read-only">read-only (Salt Okunur - Dosya Yazma Engelli)</option>
                <option value="danger-full-access">danger-full-access (Tam Sistem Erişimi)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Active Positions & System Telemetry Summary */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>👥</span>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
                Departman Koltukları & Dizin Atamaları
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Toplam <strong>{positions.length}</strong> Aktif Koltuk
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '12px'
          }}>
            {positions.map((pos) => (
              <div
                key={pos.id}
                style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{pos.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pos.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {pos.role} • Seviye {pos.level}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <div className="mono" style={{
                    fontSize: '11px',
                    color: pos.workspace.includes('custom-harness') ? '#c084fc' : '#38bdf8',
                    background: pos.workspace.includes('custom-harness') ? 'rgba(192, 132, 252, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                    padding: '3px 8px',
                    borderRadius: '4px'
                  }}>
                    {pos.workspace.split('/').slice(-1)[0] || 'root'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Active Backend Plugins */}
        {activePluginsList.length > 0 && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🔌</span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#f1f5f9' }}>
                  Aktif Çekirdek & Araç Eklentileri ({activePluginsList.length})
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Backend Yüklü Modüller</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {activePluginsList.map(plug => (
                <div
                  key={plug.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: plug.category === 'tool' ? '#38bdf8' : '#a78bfa'
                  }}
                >
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: plug.category === 'tool' ? '#38bdf8' : '#a78bfa' }} />
                  <span>{plug.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Stats Bar & Action Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '16px 20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Telemetry chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#cbd5e1' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span>Backend Core: <strong>Çevrimiçi (Port 3080)</strong></span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
              Kayıtlı Beceri: <strong>{skillsCount}</strong>
            </div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
              Aktif Oturum / Case: <strong>{threadsCount}</strong>
            </div>
          </div>

          {/* Action button */}
          <button
            type="submit"
            className="btn-primary"
            style={{
              padding: '10px 24px',
              fontSize: '13.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            💾 Ayarları Backend'e Kaydet (Port 3080)
          </button>
        </div>
      </form>
    </div>
  )
}
