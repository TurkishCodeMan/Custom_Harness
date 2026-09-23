import React, { useState } from 'react'
import type { Position } from '../types.js'

interface DirectiveModalProps {
  isOpen: boolean
  onClose: () => void
  positions: Position[]
  onExecuteDirective: (params: {
    prompt: string
    targetPositionIds: string[]
    scheduleType: 'instant' | 'after' | 'cron'
    afterSeconds?: number
    cron?: string
  }) => void
}

export const DirectiveModal: React.FC<DirectiveModalProps> = ({
  isOpen,
  onClose,
  positions,
  onExecuteDirective
}) => {
  const [prompt, setPrompt] = useState('Tüm departmanlar günlük durum raporunu hazırlasın ve masama koysun.')
  const [selectedIds, setSelectedIds] = useState<string[]>(
    positions.filter(p => p.level === 2).map(p => p.id)
  )
  const [scheduleType, setScheduleType] = useState<'instant' | 'after' | 'cron'>('instant')
  const [afterSeconds, setAfterSeconds] = useState(3600)
  const [cronExpression, setCronExpression] = useState('0 8 * * *')

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const selectAllLevel2 = () => {
    setSelectedIds(positions.filter(p => p.level === 2).map(p => p.id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || selectedIds.length === 0) return

    onExecuteDirective({
      prompt: prompt.trim(),
      targetPositionIds: selectedIds,
      scheduleType,
      afterSeconds: scheduleType === 'after' ? afterSeconds : undefined,
      cron: scheduleType === 'cron' ? cronExpression : undefined
    })

    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
            <h2 style={{ fontSize: '20px', color: '#ffffff' }}>Kurumsal Direktif Ver (Company Directive)</h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Quick Directives */}
          <div className="form-group">
            <label className="form-label">Hazır Şirket Direktifleri (Örnekler):</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setPrompt('Tüm departmanlar günlük durum raporunu hazırlasın ve masama koysun.')}
              >
                📊 Genel Günlük Rapor İsteği
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setPrompt('COMPANY_ABC bütçe aşımlarını (%15+ limit), kritik stokları ve müşteri iade oranlarını çapraz denetleyin.')}
              >
                🔍 Çapraz Denetim Rutini
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setPrompt('Tedarikçi sözleşmelerindeki zam taleplerini ve alternatif teklifleri masaya yatırın.')}
              >
                📦 Tedarikçi & Fiyat Analizi
              </button>
            </div>
          </div>

          {/* Prompt input */}
          <div className="form-group">
            <label className="form-label">Direktif Talimatı (Prompt):</label>
            <textarea
              className="form-textarea"
              style={{ width: '100%', minHeight: '100px' }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Departmanlara iletilecek direktif metni..."
              required
            />
          </div>

          {/* Target Positions */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label">Hedef Pozisyonlar & Koltuklar:</label>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: '12px', cursor: 'pointer' }}
                onClick={selectAllLevel2}
              >
                Tüm İcra Direktörlerini Seç (Level 2)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {positions.filter(p => p.id !== 'ceo').map(pos => {
                const isSelected = selectedIds.includes(pos.id)
                return (
                  <div
                    key={pos.id}
                    onClick={() => toggleSelect(pos.id)}
                    style={{
                      background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isSelected ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'}`,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>{pos.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pos.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Level {pos.level} • {pos.presetId}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scheduling options */}
          <div className="form-group">
            <label className="form-label">Çalışma Zamanı:</label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === 'instant'}
                  onChange={() => setScheduleType('instant')}
                />
                ⚡ Hemen Şimdi (Instant)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === 'after'}
                  onChange={() => setScheduleType('after')}
                />
                ⏱️ Belirli Süre Sonra
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === 'cron'}
                  onChange={() => setScheduleType('cron')}
                />
                🔁 Periyodik / Cron
              </label>
            </div>

            {scheduleType === 'after' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  className="form-input"
                  value={afterSeconds}
                  onChange={(e) => setAfterSeconds(Number(e.target.value))}
                  style={{ width: '120px' }}
                />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>saniye sonra (~{Math.round(afterSeconds / 60)} dakika)</span>
              </div>
            )}

            {scheduleType === 'cron' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input mono"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 8 * * *"
                  style={{ width: '180px' }}
                />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Örn: '0 8 * * *' (Her sabah 08:00)</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              İptal
            </button>
            <button type="submit" className="btn-primary" disabled={selectedIds.length === 0 || !prompt.trim()}>
              ⚡ Direktifi Yayınla ({selectedIds.length} Koltuk)
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
