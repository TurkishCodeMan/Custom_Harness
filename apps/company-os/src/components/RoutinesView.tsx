import React, { useState } from 'react'
import type { Routine, Position } from '../types.js'

interface RoutinesViewProps {
  routines: Routine[]
  positions: Position[]
  onDeleteRoutine: (id: string) => void
  onCreateRoutine: (payload: any) => void
  isLoading: boolean
}

export const RoutinesView: React.FC<RoutinesViewProps> = ({
  routines,
  positions,
  onDeleteRoutine,
  onCreateRoutine,
  isLoading
}) => {
  const [showAddModal, setShowAddModal] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [preset, setPreset] = useState('novatrend-cfo')
  const [type, setType] = useState<'cron' | 'after' | 'every'>('cron')
  const [cron, setCron] = useState('0 8 * * *')
  const [seconds, setSeconds] = useState(3600)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    onCreateRoutine({
      prompt: prompt.trim(),
      preset,
      cron: type === 'cron' ? cron : undefined,
      after_seconds: type === 'after' ? seconds : undefined,
      every_seconds: type === 'every' ? seconds : undefined,
      workspace: positions.find(p => p.presetId === preset)?.workspace || '/home/huseyina/code_mode/COMPANY_ABC'
    })

    setShowAddModal(false)
    setPrompt('')
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#ffffff', marginBottom: '6px' }}>
            ⏰ Proaktif Şirket Rutinleri & Zamanlanmış Görevler
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Ajanların insan müdahalesi olmadan kendi kendine uyanıp yürüttüğü periyodik kurallar.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ Yeni Rutin Ekle
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Rutinler yükleniyor...</div>
      ) : routines.length === 0 ? (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '60px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>⏰</span>
          <h3 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '8px' }}>Henüz Aktif Bir Şirket Rutini Yok</h3>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px', maxWidth: '450px', margin: '0 auto 20px' }}>
            Sabah 08:00 CFO bütçe denetimi veya 6 saatte bir stok kontrolü gibi kuralları buraya ekleyerek şirketi otonomlaştırın.
          </p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            İlk Rutini Tanımla
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {routines.map(routine => {
            const nextDate = new Date(routine.targetTime).toLocaleString('tr-TR')
            const pos = positions.find(p => p.presetId === routine.preset)

            return (
              <div
                key={routine.id}
                style={{
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}>
                    {pos?.icon || '⏰'}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span className="mono" style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>
                        [{routine.id}]
                      </span>
                      <span className={`level-badge level-${pos?.level || 2}`}>
                        {pos?.title || routine.preset || 'Genel Asistan'}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#38bdf8',
                        fontFamily: 'monospace'
                      }}>
                        {routine.type.toUpperCase()} {routine.cronExpression ? `(${routine.cronExpression})` : ''}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 500, marginBottom: '6px' }}>
                      "{routine.prompt}"
                    </div>

                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Hedef Zaman: <strong style={{ color: '#e2e8f0' }}>{nextDate}</strong> • Tetiklenme Sayısı: <strong>{routine.triggerCount}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="btn-secondary"
                    style={{ color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.25)', padding: '8px 14px', fontSize: '13px' }}
                    onClick={() => onDeleteRoutine(routine.id)}
                  >
                    🗑️ İptal Et
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Routine Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', color: '#ffffff', marginBottom: '20px' }}>
              ⏰ Yeni Proaktif Rutin Oluştur
            </h2>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Sorumlu Koltuk / Departman:</label>
                <select
                  className="form-select"
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                >
                  {positions.map(p => (
                    <option key={p.id} value={p.presetId}>
                      {p.icon} {p.title} ({p.presetId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Rutin Görev Talimatı (Prompt):</label>
                <textarea
                  className="form-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Örn: COMPANY_ABC bütçe aşımlarını denetle ve raporlar/NovaTrendCFO_Agent_Rapor_YYYY-MM-DD.md olarak kaydet."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Zamanlama Türü:</label>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="routineType"
                      checked={type === 'cron'}
                      onChange={() => setType('cron')}
                    />
                    🔁 Cron İfadesi (Periyodik Saat/Gün)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="routineType"
                      checked={type === 'after'}
                      onChange={() => setType('after')}
                    />
                    ⏱️ Tek Seferlik (Belirli Süre Sonra)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="routineType"
                      checked={type === 'every'}
                      onChange={() => setType('every')}
                    />
                    🔄 Tekrarlayan Aralık (Her X saniye)
                  </label>
                </div>

                {type === 'cron' && (
                  <input
                    type="text"
                    className="form-input mono"
                    value={cron}
                    onChange={(e) => setCron(e.target.value)}
                    placeholder="0 8 * * *"
                  />
                )}

                {(type === 'after' || type === 'every') && (
                  <input
                    type="number"
                    className="form-input"
                    value={seconds}
                    onChange={(e) => setSeconds(Number(e.target.value))}
                    placeholder="3600"
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="btn-primary">
                  Rutini Kaydet ve Başlat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
