import React, { useState } from 'react'
import type { Position } from '../types'

interface AgentContractSettingsProps {
  isCallableByAgents: boolean
  onChangeCallable: (val: boolean) => void
  allowedDelegates: string[]
  onChangeAllowedDelegates: (delegates: string[]) => void
  allowedCallers: string[]
  onChangeAllowedCallers: (callers: string[]) => void
  inputSchemaStr: string
  onChangeInputSchemaStr: (schemaStr: string) => void
  outputSchemaStr: string
  onChangeOutputSchemaStr: (schemaStr: string) => void
  verificationRules?: any[]
  onChangeVerificationRules?: (rules: any[]) => void
  allPositions: Position[]
  currentPositionId?: string
}

export const AgentContractSettings: React.FC<AgentContractSettingsProps> = ({
  isCallableByAgents,
  onChangeCallable,
  allowedDelegates,
  onChangeAllowedDelegates,
  allowedCallers,
  onChangeAllowedCallers,
  inputSchemaStr,
  onChangeInputSchemaStr,
  outputSchemaStr,
  onChangeOutputSchemaStr,
  verificationRules = [],
  onChangeVerificationRules,
  allPositions,
  currentPositionId
}) => {
  const [activeTab, setActiveTab] = useState<'interface' | 'delegation'>('interface')
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const otherPositions = allPositions.filter(p => p.id !== currentPositionId)

  const toggleDelegate = (posId: string) => {
    if (allowedDelegates.includes(posId)) {
      onChangeAllowedDelegates(allowedDelegates.filter(id => id !== posId))
    } else {
      onChangeAllowedDelegates([...allowedDelegates, posId])
    }
  }

  const toggleCaller = (posId: string) => {
    if (allowedCallers.includes(posId)) {
      onChangeAllowedCallers(allowedCallers.filter(id => id !== posId))
    } else {
      onChangeAllowedCallers([...allowedCallers, posId])
    }
  }

  const handleSchemaChange = (text: string, isInput: boolean) => {
    if (isInput) onChangeInputSchemaStr(text)
    else onChangeOutputSchemaStr(text)

    try {
      if (text.trim()) JSON.parse(text)
      setSchemaError(null)
    } catch (e: any) {
      setSchemaError(`JSON Biçim Hatası: ${e.message}`)
    }
  }

  return (
    <div style={{ marginTop: '16px', background: '#0b1120', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>📜 Agent Contract & Delegation Mesh</span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: isCallableByAgents ? '#065f46' : '#334155',
                color: isCallableByAgents ? '#34d399' : '#94a3b8',
                fontWeight: 600
              }}
            >
              {isCallableByAgents ? '✓ Callable by Agents' : 'Human Chat Only'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
            Bu koltuğun diğer ajanlara servis olarak açılmasını ve organizasyonel grafikteki çift yönlü erişim kurallarını yönetin.
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
          <input
            type="checkbox"
            checked={isCallableByAgents}
            onChange={e => onChangeCallable(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
          />
          <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>Ajan Çağrılarına Aç</span>
        </label>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', gap: '8px', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('interface')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'interface' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'interface' ? '#60a5fa' : '#94a3b8',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          JSON Şema Sözleşmeleri (I/O)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('delegation')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'delegation' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'delegation' ? '#60a5fa' : '#94a3b8',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Çift Yönlü İzin Kapısı ({allowedDelegates.length} Out / {allowedCallers.length} In)
        </button>
      </div>

      {activeTab === 'interface' && (
        <div>
          {!isCallableByAgents ? (
            <div style={{ background: '#1e293b', padding: '12px', borderRadius: '6px', fontSize: '12px', color: '#cbd5e1', marginBottom: '12px' }}>
              💡 <strong>Bilgi:</strong> Bu koltuk şu anda yalnızca insanlar tarafından doğrudan sohbetle kullanılabilir. Başka ajanların bu koltuğu <code>delegate_to_</code> ile çağırabilmesi için yukarıdaki anahtarı açın ve geçerli bir <strong>Input Schema</strong> tanımlayın.
            </div>
          ) : (
            <>
              {schemaError && (
                <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' }}>
                  ⚠️ {schemaError}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd', marginBottom: '4px' }}>
                    Girdi Şeması (Input Schema) <span style={{ color: '#ef4444' }}>*Zorunlu</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                    Üst ajanların bu servisi çağırırken sağlaması gereken zorunlu JSON şeması.
                  </div>
                  <textarea
                    value={inputSchemaStr}
                    onChange={e => handleSchemaChange(e.target.value, true)}
                    placeholder='{"type": "object", "required": ["order_id"], "properties": {"order_id": {"type": "string"}}}'
                    rows={8}
                    style={{
                      width: '100%',
                      background: '#030712',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      padding: '8px'
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#86efac', marginBottom: '4px' }}>
                    Çıktı Şeması (Output Schema) <span style={{ color: '#64748b' }}>(Opsiyonel)</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                    Bu ajanın tamamlandığında çağıran ajana döndürmesi garanti edilen JSON yapısı.
                  </div>
                  <textarea
                    value={outputSchemaStr}
                    onChange={e => handleSchemaChange(e.target.value, false)}
                    placeholder='{"type": "object", "required": ["status"], "properties": {"status": {"enum": ["OK", "FAILED"]}}}'
                    rows={8}
                    style={{
                      width: '100%',
                      background: '#030712',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      padding: '8px'
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'delegation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>
              ↗️ Çağırabileceği Ajanlar (Outbound Delegates)
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
              Bu koltuk görevini yürütürken hangi uzman koltukları delege edebilsin?
            </div>
            <div style={{ maxHeight: '160px', overflowY: 'auto', background: '#030712', border: '1px solid #1e293b', borderRadius: '6px', padding: '8px' }}>
              {otherPositions.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748b' }}>Organizasyonda başka koltuk bulunmuyor.</div>
              ) : (
                otherPositions.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allowedDelegates.includes(p.id) || allowedDelegates.includes(p.presetId)}
                      onChange={() => toggleDelegate(p.presetId || p.id)}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    <span style={{ fontSize: '12px', color: '#e2e8f0' }}>{p.icon} {p.title}</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>({p.presetId || p.id})</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f43f5e', marginBottom: '4px' }}>
              ↙️ Bu Koltuğu Çağırabilecekler (Inbound Callers)
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
              Yalnızca seçilen koltuklar bu ajanı delege olarak çağırabilir (Zero-Trust Inbound Gate).
            </div>
            <div style={{ maxHeight: '160px', overflowY: 'auto', background: '#030712', border: '1px solid #1e293b', borderRadius: '6px', padding: '8px' }}>
              {otherPositions.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748b' }}>Organizasyonda başka koltuk bulunmuyor.</div>
              ) : (
                otherPositions.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allowedCallers.includes(p.id) || allowedCallers.includes(p.presetId)}
                      onChange={() => toggleCaller(p.presetId || p.id)}
                      style={{ accentColor: '#f43f5e' }}
                    />
                    <span style={{ fontSize: '12px', color: '#e2e8f0' }}>{p.icon} {p.title}</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>({p.presetId || p.id})</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
