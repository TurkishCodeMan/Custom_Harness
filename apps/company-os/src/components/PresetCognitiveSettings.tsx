import React from 'react'

export interface PresetCognitiveSettingsProps {
  modelId: string
  providerId: string
  temperature: number | undefined
  responseFormat: string
  maxTurns: number | undefined
  onChangeModelId: (val: string) => void
  onChangeProviderId: (val: string) => void
  onChangeTemperature: (val: number | undefined) => void
  onChangeResponseFormat: (val: string) => void
  onChangeMaxTurns: (val: number | undefined) => void
  configuredProviders?: string[]
  configuredModels?: string[]
  idPrefix?: string
}

export const PresetCognitiveSettings: React.FC<PresetCognitiveSettingsProps> = ({
  modelId,
  providerId,
  temperature,
  responseFormat,
  maxTurns,
  onChangeModelId,
  onChangeProviderId,
  onChangeTemperature,
  onChangeResponseFormat,
  onChangeMaxTurns,
  configuredProviders = [],
  configuredModels = [],
  idPrefix = 'cog'
}) => {
  const modelDatalistId = `${idPrefix}-available-models-list`
  const providerDatalistId = `${idPrefix}-available-providers-list`

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>⚙️</span>
          <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#f8fafc', fontSize: '13px' }}>
            Model, Sıcaklık & Bilişsel Parametreler
          </label>
        </div>
        <span
          style={{
            fontSize: '11px',
            color: '#38bdf8',
            background: 'rgba(56, 189, 248, 0.12)',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(56, 189, 248, 0.25)'
          }}
        >
          Preset Bilişsel Katmanı
        </span>
      </div>

      {/* Model ID & Provider ID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
            🤖 LLM Modeli (modelId):
          </label>
          <input
            type="text"
            className="form-input mono"
            placeholder="Örn: Qwen3.8-27B, gpt-4o, claude-3-5-sonnet"
            list={modelDatalistId}
            value={modelId}
            onChange={(e) => onChangeModelId(e.target.value)}
            style={{ fontSize: '12px' }}
          />
          <datalist id={modelDatalistId}>
            {configuredModels.map((m) => (
              <option key={m} value={m} />
            ))}
            <option value="Qwen3.8-27B" />
            <option value="qwen2.5-coder:32b" />
            <option value="deepseek-r1" />
            <option value="gpt-4o" />
            <option value="gpt-4o-mini" />
            <option value="claude-3-5-sonnet-20241022" />
          </datalist>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
            🏷️ Sağlayıcı (providerId):
          </label>
          <input
            type="text"
            className="form-input mono"
            placeholder="Örn: openai, openrouter, vllm, ollama"
            list={providerDatalistId}
            value={providerId}
            onChange={(e) => onChangeProviderId(e.target.value)}
            style={{ fontSize: '12px' }}
          />
          <datalist id={providerDatalistId}>
            {configuredProviders.map((p) => (
              <option key={p} value={p} />
            ))}
            <option value="openai" />
            <option value="openrouter" />
            <option value="vllm" />
            <option value="ollama" />
            <option value="anthropic" />
          </datalist>
        </div>
      </div>

      {/* Temperature Slider + Number Box */}
      <div className="form-group" style={{ margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="form-label" style={{ margin: 0, fontSize: '11.5px', color: '#cbd5e1' }}>
            🌡️ Model Sıcaklığı (Temperature):
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                color: typeof temperature === 'number' ? '#38bdf8' : '#94a3b8',
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              {typeof temperature === 'number' ? temperature.toFixed(2) : 'Varsayılan (0.2)'}
            </span>
            {typeof temperature === 'number' && (
              <button
                type="button"
                onClick={() => onChangeTemperature(undefined)}
                style={{
                  fontSize: '10px',
                  background: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '0 2px'
                }}
              >
                Sıfırla
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={typeof temperature === 'number' ? temperature : 0.2}
            onChange={(e) => onChangeTemperature(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#38bdf8', cursor: 'pointer' }}
          />
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            className="form-input mono"
            style={{ width: '70px', padding: '4px 6px', textAlign: 'center', fontSize: '12px' }}
            value={typeof temperature === 'number' ? temperature : ''}
            placeholder="0.2"
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              onChangeTemperature(isNaN(val) ? undefined : Math.max(0, Math.min(1, val)))
            }}
          />
        </div>

        <div
          style={{
            fontSize: '11px',
            marginTop: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color:
              typeof temperature === 'number' && temperature <= 0.2
                ? '#34d399'
                : typeof temperature === 'number' && temperature >= 0.7
                ? '#c084fc'
                : '#93c5fd'
          }}
        >
          {typeof temperature !== 'number' ? (
            <span>ℹ️ Sistem varsayılan sıcaklığı (0.2) kullanılacak.</span>
          ) : temperature <= 0.2 ? (
            <span>
              🎯 <b>Deterministik & Sıfır Halüsinasyon:</b> Finansal denetim, aritmetik, SQL ve kesin kural doğrulaması için ideal.
            </span>
          ) : temperature <= 0.65 ? (
            <span>
              ⚖️ <b>Dengeli & Standart:</b> Genel analizler, planlama ve standart iş akışları için ideal.
            </span>
          ) : (
            <span>
              🎨 <b>Yaratıcı & Esnek:</b> Rapor yazımı, yaratıcı problem çözme ve beyin fırtınası için ideal.
            </span>
          )}
        </div>
      </div>

      {/* Response Format & Max Turns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
            📋 Zorunlu Çıktı Şeması (Response Format):
          </label>
          <select
            className="form-select"
            value={responseFormat}
            onChange={(e) => onChangeResponseFormat(e.target.value)}
            style={{ fontSize: '12px' }}
          >
            <option value="default">Varsayılan (Serbest Metin / Markdown)</option>
            <option value="json_object">Zorunlu JSON Objesi ({'{ type: "json_object" }'})</option>
            <option value="json_schema">Katı JSON Şeması ({'{ type: "json_schema" }'})</option>
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
            🔄 Tur Sınırı (maxTurns):
          </label>
          <input
            type="number"
            min="1"
            max="100"
            className="form-input mono"
            placeholder="30"
            value={typeof maxTurns === 'number' ? maxTurns : ''}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              onChangeMaxTurns(isNaN(v) ? undefined : v)
            }}
            style={{ fontSize: '12px' }}
          />
        </div>
      </div>
    </div>
  )
}
