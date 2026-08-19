import React, { useState, useEffect } from 'react'
import { Modal, Button, Badge } from '@custom-harness/client-ui-primitives'

export interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: any
  presets: any[]
  activePresetId: string
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
  onSaveSettings,
  onSavePreset,
  onSetDefaultPreset,
  onTogglePlugin
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'presets' | 'plugins' | 'general'>('providers')
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

  if (!isOpen) return null

  const handleSaveAll = async () => {
    await onSaveSettings(localSettings)
    await onSetDefaultPreset(selectedPresetId)
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
              presets={presets}
              selectedPresetId={selectedPresetId}
              onSelectPreset={(id) => {
                setSelectedPresetId(id)
                const found = presets.find((p) => p.id === id)
                if (found) setPresetForm({ ...found })
              }}
              presetForm={presetForm}
              onPresetFormChange={setPresetForm}
              onSavePreset={async () => {
                await onSavePreset(presetForm)
              }}
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
  const activeProviderKey = settings.defaultProvider || Object.keys(providers)[0] || 'vllm'
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

  return (
    <div className="tab-pane">
      <div className="form-group">
        <label className="form-label">Varsayılan Sağlayıcı (Provider)</label>
        <select
          className="form-select"
          value={activeProviderKey}
          onChange={(e) => onChange({ ...settings, defaultProvider: e.target.value })}
        >
          {Object.keys(providers).map((key) => (
            <option key={key} value={key}>
              {providers[key].name || key}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Base URL (API Uç Noktası)</label>
        <input
          type="text"
          className="form-input"
          value={activeProvider.baseURL || ''}
          onChange={(e) => handleProviderChange('baseURL', e.target.value)}
          placeholder="http://127.0.0.1:8000/v1"
        />
      </div>

      <div className="form-group">
        <label className="form-label">API Anahtarı (İsteğe Bağlı / Yerel için boş bırakın)</label>
        <input
          type="password"
          className="form-input"
          value={activeProvider.apiKey || ''}
          onChange={(e) => handleProviderChange('apiKey', e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Varsayılan Model ID</label>
        <input
          type="text"
          className="form-input"
          value={settings.defaultModel || activeProvider.models?.[0]?.id || ''}
          onChange={(e) => onChange({ ...settings, defaultModel: e.target.value })}
          placeholder="model-id"
        />
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
          rows={5}
          value={presetForm.systemPrompt || ''}
          onChange={(e) => onPresetFormChange({ ...presetForm, systemPrompt: e.target.value })}
        />
      </div>

      <Button variant="secondary" size="sm" onClick={onSavePreset}>
        Profili Diske Kaydet (.json)
      </Button>
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
