import React, { useState, useEffect } from 'react'
import { Modal, Button, Badge } from '@custom-harness/client-ui-primitives'

export interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: any
  presets: any[]
  activePresetId: string
  isAdmin?: boolean
  onSaveSettings: (newSettings: any) => Promise<void>
  onSavePreset: (preset: any) => Promise<void>
  onSetDefaultPreset: (presetId: string) => Promise<void>
  onTogglePlugin: (pluginId: string, enabled: boolean) => Promise<void>
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  presets,
  activePresetId,
  isAdmin = true,
  onSaveSettings,
  onSavePreset,
  onSetDefaultPreset,
  onTogglePlugin
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'presets' | 'plugins' | 'ui' | 'general'>('providers')
  const [localSettings, setLocalSettings] = useState<any>(settings || {})
  const [selectedPresetId, setSelectedPresetId] = useState<string>(activePresetId || 'full-stack')
  const presetList = Array.isArray(presets) ? presets : (presets as any)?.presets || []
  const [presetForm, setPresetForm] = useState<any>(
    presetList.find((p: any) => p.id === activePresetId) || presetList[0] || {}
  )

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])

  useEffect(() => {
    if (presets && Array.isArray(presets)) {
      const found = presets.find((p: any) => p.id === selectedPresetId)
      if (found) {
        setPresetForm({ ...found })
      }
    }
  }, [presets, selectedPresetId])

  if (!isOpen) return null

  const handleSelectPreset = (id: string) => {
    setSelectedPresetId(id)
    const found = presetList.find((p: any) => p.id === id)
    if (found) {
      setPresetForm({ ...found })
    }
  }

  const handleSaveAll = async () => {
    const { error, ...cleanSettings } = localSettings || {}
    await onSaveSettings(cleanSettings)
    if (presetForm && (presetForm.id || presetForm.name)) {
      await onSavePreset(presetForm)
    }
    if (selectedPresetId) {
      await onSetDefaultPreset(selectedPresetId)
    }
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="modal-title-with-icon">
          <span>⚙️</span>
          <span>Yapılandırma ve Tercihler</span>
        </div>
      }
      maxWidth="780px"
      footer={
        <div className="settings-footer-actions">
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button variant="primary" onClick={handleSaveAll}>
            Kaydet ve Uygula
          </Button>
        </div>
      }
    >
      <div className="settings-layout">
        <nav className="settings-nav-tabs">
          <button
            className={`settings-nav-tab ${activeTab === 'providers' ? 'active' : ''}`}
            onClick={() => setActiveTab('providers')}
          >
            🤖 LLM Sağlayıcıları
          </button>
          <button
            className={`settings-nav-tab ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            👤 Ajan Presetleri
          </button>
          <button
            className={`settings-nav-tab ${activeTab === 'ui' ? 'active' : ''}`}
            onClick={() => setActiveTab('ui')}
          >
            🎨 Arayüz & Başlık İstemi
          </button>
          <button
            className={`settings-nav-tab ${activeTab === 'plugins' ? 'active' : ''}`}
            onClick={() => setActiveTab('plugins')}
          >
            🧩 Eklentiler (Plugins)
          </button>
          <button
            className={`settings-nav-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            ⚙️ Genel Ayarlar
          </button>
        </nav>

        <div className="settings-tab-content">
          {activeTab === 'providers' && (
            <ProvidersTab
              settings={localSettings}
              onChange={setLocalSettings}
            />
          )}

          {activeTab === 'presets' && (
            <PresetsTab
              presets={presetList}
              selectedPresetId={selectedPresetId}
              onSelectPreset={handleSelectPreset}
              presetForm={presetForm}
              onPresetFormChange={setPresetForm}
              onSavePreset={async () => {
                await onSavePreset(presetForm)
              }}
            />
          )}

          {activeTab === 'ui' && (
            <UiTab
              settings={localSettings}
              isAdmin={isAdmin}
              onChange={setLocalSettings}
            />
          )}

          {activeTab === 'plugins' && (
            <PluginsTab
              plugins={localSettings.plugins || {}}
              onTogglePlugin={onTogglePlugin}
            />
          )}

          {activeTab === 'general' && (
            <GeneralTab
              settings={localSettings}
              onChange={setLocalSettings}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}

export function ProvidersTab({ settings, onChange }: { settings: any; onChange: (s: any) => void }) {
  const providers = settings.providers || {}
  const [selectedProviderKey, setSelectedProviderKey] = useState<string>(
    settings.defaultProvider || Object.keys(providers)[0] || 'qwen-local'
  )
  const [isAddingProvider, setIsAddingProvider] = useState<boolean>(false)
  const [newProviderForm, setNewProviderForm] = useState<any>({
    id: '',
    name: '',
    baseURL: 'http://localhost:8000/v1',
    apiKey: '',
    models: []
  })

  // Model addition state
  const [newModelForm, setNewModelForm] = useState<any>({
    id: '',
    name: '',
    contextWindow: 32768,
    maxTokens: 8192
  })
  const [isAddingModel, setIsAddingModel] = useState<boolean>(false)

  const activeProviderKey = selectedProviderKey in providers ? selectedProviderKey : Object.keys(providers)[0]
  const activeProvider = providers[activeProviderKey] || {}

  const handleProviderChange = (field: string, value: any) => {
    const updated = {
      ...settings,
      providers: {
        ...providers,
        [activeProviderKey]: {
          ...activeProvider,
          [field]: value
        }
      }
    }
    onChange(updated)
  }

  const handleSetDefault = (providerId: string, modelId?: string) => {
    const p = providers[providerId]
    const mId = modelId || p?.models?.[0]?.id || settings.defaultModel
    onChange({
      ...settings,
      defaultProvider: providerId,
      defaultModel: mId
    })
  }

  const handleSaveNewProvider = () => {
    if (!newProviderForm.id.trim() || !newProviderForm.name.trim()) {
      alert('Lütfen Sağlayıcı ID ve Adını doldurun.')
      return
    }
    const id = newProviderForm.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    const updatedProviders = {
      ...providers,
      [id]: {
        id,
        name: newProviderForm.name.trim(),
        api: 'openai-completions',
        baseURL: newProviderForm.baseURL.trim(),
        apiKey: newProviderForm.apiKey.trim(),
        models: newProviderForm.models.length > 0 ? newProviderForm.models : [
          { id: id + '-default', name: newProviderForm.name.trim() + ' Model', contextWindow: 32768, maxTokens: 8192 }
        ]
      }
    }
    onChange({
      ...settings,
      providers: updatedProviders,
      defaultProvider: id,
      defaultModel: updatedProviders[id].models[0]?.id
    })
    setSelectedProviderKey(id)
    setIsAddingProvider(false)
    setNewProviderForm({ id: '', name: '', baseURL: 'http://localhost:8000/v1', apiKey: '', models: [] })
  }

  const handleDeleteProvider = (pId: string) => {
    if (Object.keys(providers).length <= 1) {
      alert('En az 1 adet LLM Sağlayıcısı bulunmalıdır.')
      return
    }
    if (!confirm(`"${providers[pId]?.name || pId}" sağlayıcısını silmek istediğinize emin misiniz?`)) {
      return
    }
    const nextProviders = { ...providers }
    delete nextProviders[pId]
    const nextKey = Object.keys(nextProviders)[0]
    onChange({
      ...settings,
      providers: nextProviders,
      defaultProvider: settings.defaultProvider === pId ? nextKey : settings.defaultProvider,
      defaultModel: settings.defaultProvider === pId ? nextProviders[nextKey]?.models?.[0]?.id : settings.defaultModel
    })
    setSelectedProviderKey(nextKey)
  }

  const handleAddModelToProvider = () => {
    if (!newModelForm.id.trim()) {
      alert('Lütfen Model ID (örn: llama3:70b veya Qwen3.8-27B) girin.')
      return
    }
    const currentModels = Array.isArray(activeProvider.models) ? [...activeProvider.models] : []
    const mId = newModelForm.id.trim()
    const mName = newModelForm.name.trim() || mId
    const newEntry = {
      id: mId,
      name: mName,
      contextWindow: parseInt(newModelForm.contextWindow) || 32768,
      maxTokens: parseInt(newModelForm.maxTokens) || 8192,
      reasoningFormat: 'deepseek'
    }
    const updatedModels = currentModels.some((m: any) => m.id === mId)
      ? currentModels.map((m: any) => m.id === mId ? newEntry : m)
      : [...currentModels, newEntry]

    handleProviderChange('models', updatedModels)
    setIsAddingModel(false)
    setNewModelForm({ id: '', name: '', contextWindow: 32768, maxTokens: 8192 })
  }

  const handleDeleteModel = (modelId: string) => {
    const currentModels = Array.isArray(activeProvider.models) ? activeProvider.models : []
    if (currentModels.length <= 1) {
      alert('Bir sağlayıcının altında en az 1 model bulunmalıdır.')
      return
    }
    const filtered = currentModels.filter((m: any) => m.id !== modelId)
    handleProviderChange('models', filtered)
    if (settings.defaultModel === modelId) {
      onChange({ ...settings, defaultModel: filtered[0]?.id })
    }
  }

  return (
    <div className="tab-pane">
      {/* Top Bar: Selector & Add New Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, marginRight: '12px' }}>
          <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Sağlayıcı:</label>
          <select
            className="form-select"
            style={{ flex: 1 }}
            value={activeProviderKey}
            onChange={(e) => setSelectedProviderKey(e.target.value)}
          >
            {Object.keys(providers).map((key) => (
              <option key={key} value={key}>
                {providers[key].name || key} {settings.defaultProvider === key ? '⭐ (Varsayılan)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingProvider(!isAddingProvider)}
          >
            {isAddingProvider ? 'İptal' : '+ Yeni Sağlayıcı Ekle'}
          </Button>
          {settings.defaultProvider !== activeProviderKey && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSetDefault(activeProviderKey)}
              title="Bu sağlayıcıyı sistemin varsayılanı yap"
            >
              ⭐ Varsayılan Yap
            </Button>
          )}
        </div>
      </div>

      {/* New Provider Creator Drawer */}
      {isAddingProvider && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8' }}>
            ✨ Yeni LLM Sağlayıcısı (vLLM / Ollama / OpenAI / OpenRouter) Ekle
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Sağlayıcı ID (örn: local-ollama)</label>
              <input
                type="text"
                className="form-input"
                value={newProviderForm.id}
                onChange={(e) => setNewProviderForm({ ...newProviderForm, id: e.target.value })}
                placeholder="ollama-local"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Görünen İsim (örn: Local Ollama Llama-3)</label>
              <input
                type="text"
                className="form-input"
                value={newProviderForm.name}
                onChange={(e) => setNewProviderForm({ ...newProviderForm, name: e.target.value })}
                placeholder="Local Ollama Server"
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Base URL (API Uç Noktası)</label>
            <input
              type="text"
              className="form-input"
              value={newProviderForm.baseURL}
              onChange={(e) => setNewProviderForm({ ...newProviderForm, baseURL: e.target.value })}
              placeholder="http://localhost:11434/v1 veya http://localhost:8000/v1"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">API Anahtarı (İsteğe Bağlı)</label>
            <input
              type="password"
              className="form-input"
              value={newProviderForm.apiKey}
              onChange={(e) => setNewProviderForm({ ...newProviderForm, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <Button size="sm" variant="secondary" onClick={() => setIsAddingProvider(false)}>İptal</Button>
            <Button size="sm" variant="primary" onClick={handleSaveNewProvider}>✓ Sağlayıcıyı Kaydet</Button>
          </div>
        </div>
      )}

      {/* Active Provider Details */}
      <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc' }}>
            ⚙️ {activeProvider.name || activeProviderKey} Yapılandırması
          </span>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDeleteProvider(activeProviderKey)}
            title="Bu sağlayıcıyı sil"
          >
            🗑️ Sağlayıcıyı Sil
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Görünen Ad</label>
            <input
              type="text"
              className="form-input"
              value={activeProvider.name || ''}
              onChange={(e) => handleProviderChange('name', e.target.value)}
              placeholder="Sağlayıcı Adı"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Base URL (API Uç Noktası)</label>
            <input
              type="text"
              className="form-input"
              value={activeProvider.baseURL || ''}
              onChange={(e) => handleProviderChange('baseURL', e.target.value)}
              placeholder="http://localhost:7272/v1"
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '10px', marginBottom: 0 }}>
          <label className="form-label">API Anahtarı (İsteğe Bağlı / Yerel için boş bırakın)</label>
          <input
            type="password"
            className="form-input"
            value={activeProvider.apiKey || ''}
            onChange={(e) => handleProviderChange('apiKey', e.target.value)}
            placeholder="sk-..."
          />
        </div>
      </div>

      {/* Models List for Selected Provider */}
      <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
              🧠 Tanımlı Modeller ({activeProvider.models?.length || 0})
            </span>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
              Bu sağlayıcı altında çalıştırılabilecek model ID ve parametreleri
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingModel(!isAddingModel)}
          >
            {isAddingModel ? 'İptal' : '+ Model Ekle'}
          </Button>
        </div>

        {/* Add Model Form */}
        {isAddingModel && (
          <div style={{
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px dashed rgba(99, 102, 241, 0.5)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Model ID (API Çağrı Adı / Path)</label>
                <input
                  type="text"
                  className="form-input"
                  value={newModelForm.id}
                  onChange={(e) => setNewModelForm({ ...newModelForm, id: e.target.value })}
                  placeholder="/gpfs/.../model veya qwen:27b"
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Model Görünen Adı</label>
                <input
                  type="text"
                  className="form-input"
                  value={newModelForm.name}
                  onChange={(e) => setNewModelForm({ ...newModelForm, name: e.target.value })}
                  placeholder="Qwen 3.8 (27B)"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Context Window (Tokens)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newModelForm.contextWindow}
                  onChange={(e) => setNewModelForm({ ...newModelForm, contextWindow: e.target.value })}
                  placeholder="32768"
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '2px' }}>Max Output Tokens</label>
                <input
                  type="number"
                  className="form-input"
                  value={newModelForm.maxTokens}
                  onChange={(e) => setNewModelForm({ ...newModelForm, maxTokens: e.target.value })}
                  placeholder="8192"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
              <Button size="sm" variant="secondary" onClick={() => setIsAddingModel(false)}>İptal</Button>
              <Button size="sm" variant="primary" onClick={handleAddModelToProvider}>✓ Modeli Ekle</Button>
            </div>
          </div>
        )}

        {/* Existing Models Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(activeProvider.models || []).map((m: any) => {
            const isCurrentDefault = settings.defaultModel === m.id
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: isCurrentDefault ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0, 0, 0, 0.25)',
                  border: isCurrentDefault ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0, marginRight: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                      {m.name || m.id}
                    </span>
                    {isCurrentDefault && (
                      <span style={{ fontSize: '10px', background: '#6366f1', color: '#fff', padding: '1px 5px', borderRadius: '3px' }}>
                        Varsayılan
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <code>{m.id}</code> · {m.contextWindow || 32768} ctx · {m.maxTokens || 8192} max
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  {!isCurrentDefault && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSetDefault(activeProviderKey, m.id)}
                      title="Bu modeli varsayılan yap"
                    >
                      ⭐ Seç
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteModel(m.id)}
                    title="Modeli kaldır"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function PresetsTab({
  presets,
  selectedPresetId,
  onSelectPreset,
  presetForm,
  onPresetFormChange,
  onSavePreset
}: {
  presets: any[]
  selectedPresetId: string
  onSelectPreset: (id: string) => void
  presetForm: any
  onPresetFormChange: (form: any) => void
  onSavePreset: () => Promise<void>
}) {
  const [liveTools, setLiveTools] = useState<Array<{ name: string; description: string }>>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetch('/api/tools')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLiveTools(data)
        }
      })
      .catch(() => {})
  }, [])

  const currentEnabled: string[] | undefined = presetForm.enabledTools
  const allToolNames = liveTools.map(t => t.name)

  const handleToggleTool = (toolName: string) => {
    let nextList = currentEnabled ? [...currentEnabled] : [...allToolNames]
    if (nextList.includes(toolName)) {
      nextList = nextList.filter(t => t !== toolName)
    } else {
      nextList.push(toolName)
    }
    onPresetFormChange({ ...presetForm, enabledTools: nextList })
  }

  const handleSelectAll = () => {
    onPresetFormChange({ ...presetForm, enabledTools: [...allToolNames] })
  }

  const handleDeselectAll = () => {
    onPresetFormChange({ ...presetForm, enabledTools: [] })
  }

  const filteredTools = liveTools.filter(t =>
    !searchTerm ||
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="tab-pane">
      <div className="form-group">
        <label className="form-label">Seçili Ajan Profili</label>
        <select
          className="form-select"
          value={selectedPresetId}
          onChange={(e) => onSelectPreset(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Profil Adı</label>
        <input
          type="text"
          className="form-input"
          value={presetForm.name || ''}
          onChange={(e) => onPresetFormChange({ ...presetForm, name: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Açıklama</label>
        <input
          type="text"
          className="form-input"
          value={presetForm.description || ''}
          onChange={(e) => onPresetFormChange({ ...presetForm, description: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Sistem İstemi / Persona Talimatları</label>
        <textarea
          className="form-textarea"
          rows={4}
          value={presetForm.systemPrompt || ''}
          onChange={(e) => onPresetFormChange({ ...presetForm, systemPrompt: e.target.value })}
        />
      </div>

      {/* Dynamic Tools Selector (Directly from Tools Service) */}
      <div className="form-group" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#e2e8f0' }}>
              🛠️ Yetkili Servis Araçları ({liveTools.length} Araç Aktif)
            </label>
            <Badge variant="cyan">
              {currentEnabled ? `${currentEnabled.length} Seçili` : 'Tümü Açık'}
            </Badge>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn-action-small"
              onClick={handleSelectAll}
              style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '4px', color: '#c7d2fe', cursor: 'pointer' }}
            >
              ✓ Tümünü Seç
            </button>
            <button
              type="button"
              className="btn-action-small"
              onClick={handleDeselectAll}
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
            placeholder="🔍 Araç veya açıklama ara (örn: bash, edit, rag, sql)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '12px',
          maxHeight: '340px',
          overflowY: 'auto'
        }}>
          {filteredTools.map((tool) => {
            const isChecked = !currentEnabled || currentEnabled.includes(tool.name)

            return (
              <label
                key={tool.name}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 10px',
                  background: isChecked ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  border: isChecked ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleTool(tool.name)}
                  style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#6366f1' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <code style={{ fontSize: '12px', fontWeight: 700, color: isChecked ? '#f1f5f9' : '#94a3b8' }}>
                    {tool.name}
                  </code>
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                    {tool.description || 'Araç tanımı mevcut değil'}
                  </span>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={onSavePreset}>
          💾 Profili Diske Kaydet (.json)
        </Button>
      </div>
    </div>
  )
}

export function PluginsTab({
  plugins,
  onTogglePlugin
}: {
  plugins: Record<string, any>
  onTogglePlugin: (id: string, enabled: boolean) => Promise<void>
}) {
  const [livePlugins, setLivePlugins] = useState<Record<string, any>>(plugins || {})

  useEffect(() => {
    fetch('/api/plugins')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setLivePlugins(data)
        }
      })
      .catch(() => {})
  }, [])

  const merged = Object.keys(plugins || {}).length > 0 ? plugins : livePlugins
  const pluginKeys = Object.keys(merged || {})

  return (
    <div className="tab-pane">
      <div className="tab-intro">
        <span>🧩 Toplam {pluginKeys.length} Cordis Eklenti Paketi Aktif</span>
      </div>

      <div className="plugins-grid">
        {pluginKeys.map((id) => {
          const p = merged[id]
          const isEnabled = p.enabled !== false
          return (
            <div key={id} className={`plugin-item-card ${isEnabled ? 'enabled' : 'disabled'}`}>
              <div className="plugin-info">
                <div className="plugin-name">
                  <span>{p.name || id}</span>
                  <Badge variant={p.category === 'tool' ? 'cyan' : 'purple'} className="plugin-cat-badge">
                    {p.category || 'plugin'}
                  </Badge>
                </div>
                <div className="plugin-desc">{p.description || p.module}</div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => onTogglePlugin(id, e.target.checked)}
                />
                <span className="slider round" />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GeneralTab({ settings, onChange }: { settings: any; onChange: (s: any) => void }) {
  return (
    <div className="tab-pane">
      <div className="form-group">
        <label className="form-label">Çalışma Alanı Dizini (Workspace)</label>
        <input
          type="text"
          className="form-input"
          value={settings.workspace || ''}
          onChange={(e) => onChange({ ...settings, workspace: e.target.value })}
          placeholder="/home/user/my_project"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Sunucu Portu</label>
        <input
          type="number"
          className="form-input"
          value={settings.server?.port || 3080}
          onChange={(e) =>
            onChange({
              ...settings,
              server: { ...(settings.server || {}), port: parseInt(e.target.value) || 3080 }
            })
          }
        />
      </div>
    </div>
  )
}

const DEFAULT_TITLE_PROMPT = 'Sen profesyonel bir başlık üreticisisin. Verilen ilk kullanıcı iletisini analiz et ve bu sohbet konusu için net, sade, anlaşılır ve en fazla 3-5 kelimelik Türkçe bir başlık üret. Tırnak işareti, "Başlık:" ön eki veya noktalama işareti ekleme, yalnızca başlık metnini döndür.'

export function UiTab({
  settings,
  isAdmin = true,
  onChange
}: {
  settings: any
  isAdmin?: boolean
  onChange: (s: any) => void
}) {
  const ui = settings.ui || {}
  const currentTitlePrompt = ui.defaultTitlePrompt ?? DEFAULT_TITLE_PROMPT
  const currentFontWeight = ui.fontWeight || 'semibold'
  const currentFontSize = ui.fontSize || 'md'
  const currentBubbleStyle = ui.bubbleStyle || 'modern'

  const handleUiChange = (field: string, value: any) => {
    const updated = {
      ...settings,
      ui: {
        ...ui,
        [field]: value
      }
    }
    onChange(updated)
  }

  return (
    <div className="tab-pane ui-settings-tab">
      <div className="admin-status-banner" style={{ marginBottom: 16 }}>
        {isAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(16, 163, 126, 0.1)', border: '1px solid rgba(16, 163, 126, 0.25)', borderRadius: 8 }}>
            <Badge variant="success">🛡️ Sistem Yöneticisi</Badge>
            <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Arayüz tipografisini ve global otomatik başlık üretim istemini değiştirebilirsiniz.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 8 }}>
            <Badge variant="cyan">👤 Kişisel Tercihler</Badge>
            <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Yazı boyutu, font kalınlığı ve baloncuk stilinizi kendinize özel olarak özelleştirebilirsiniz.</span>
          </div>
        )}
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏷️ Otomatik Başlık Üretim İstemi (Title Generation Prompt)</span>
            {!isAdmin && (
              <span style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                🔒 Yalnızca Yönetici
              </span>
            )}
          </label>
          {isAdmin && (
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11.5px', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => handleUiChange('defaultTitlePrompt', DEFAULT_TITLE_PROMPT)}
            >
              Varsayılana Sıfırla
            </button>
          )}
        </div>
        <p style={{ fontSize: '12px', color: '#71717a', margin: '2px 0 8px' }}>
          Her yeni sohbet oturumunun ilk mesajında, arka planda LLM'e gönderilerek sohbet başlığını (Title) net ve sade şekilde oluşturan sistem talimatıdır.
        </p>
        <textarea
          className="form-textarea"
          style={{ opacity: !isAdmin ? 0.65 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }}
          rows={4}
          value={currentTitlePrompt}
          disabled={!isAdmin}
          onChange={(e) => handleUiChange('defaultTitlePrompt', e.target.value)}
          placeholder="Başlık üretme talimatını girin..."
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">🔤 Yazı Tipi Kalınlığı (Font Weight)</label>
          <select
            className="form-select"
            value={currentFontWeight}
            onChange={(e) => handleUiChange('fontWeight', e.target.value)}
          >
            <option value="semibold">Belirgin & Tok (Semi-Bold 600 - Önerilen)</option>
            <option value="medium">Dengeli & Modern (Medium 500)</option>
            <option value="normal">Standart (Regular 400)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">📏 Yazı Boyutu (Font Size)</label>
          <select
            className="form-select"
            value={currentFontSize}
            onChange={(e) => handleUiChange('fontSize', e.target.value)}
          >
            <option value="sm">Kompakt (13.5px)</option>
            <option value="md">Standart (14.5px)</option>
            <option value="lg">Geniş (16px)</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">💬 Mesaj Baloncuk Stili (Bubble Theme)</label>
        <select
          className="form-select"
          value={currentBubbleStyle}
          onChange={(e) => handleUiChange('bubbleStyle', e.target.value)}
        >
          <option value="modern">ArtificaX Glow & Slate (Koyu Gradyan + İnce Çerçeve)</option>
          <option value="glass">Glassmorphism (Yarı Saydam Buzlu Cam)</option>
          <option value="minimal">Minimalist Dark (Sade Koyu Düz Tema)</option>
        </select>
      </div>
    </div>
  )
}
