import React, { useState } from 'react'
import type { Position } from '../types.js'

interface CompanyWorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  companyName: string
  companyWorkspace: string
  positions: Position[]
  onSave: (name: string, workspace: string, updateAllPositions: boolean) => void
}

export const CompanyWorkspaceModal: React.FC<CompanyWorkspaceModalProps> = ({
  isOpen,
  onClose,
  companyName,
  companyWorkspace,
  positions,
  onSave
}) => {
  const [name, setName] = useState(companyName)
  const [workspace, setWorkspace] = useState(companyWorkspace)
  const [updateAllPositions, setUpdateAllPositions] = useState(true)

  const quickPaths = [
    { label: 'COMPANY_ABC (E-Ticaret Verileri)', path: '/home/huseyina/code_mode/COMPANY_ABC' },
    { label: 'custom-harness (Sistem & Kod Monorepo)', path: '/home/huseyina/code_mode/custom-harness' }
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !workspace.trim()) return
    onSave(name.trim(), workspace.trim(), updateAllPositions)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🏢</span>
            <div>
              <h2 style={{ fontSize: '18px', color: '#ffffff', margin: 0 }}>Şirket & Çalışma Alanı (Workspace) Yönetimi</h2>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Şirket bağlantısını ve departman ajanlarının baktığı kök dizinleri yapılandırın.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Company Name */}
          <div className="form-group">
            <label className="form-label">Şirket / Organizasyon Adı:</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: COMPANY_ABC, NOVA_HOLDING..."
              required
            />
          </div>

          {/* Root Workspace Path */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Ana Şirket Çalışma Alanı (Root Workspace):</span>
              <span style={{ fontSize: '11px', color: '#38bdf8' }}>Dosya & Rapor Kök Dizini</span>
            </label>
            <input
              type="text"
              className="form-input mono"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="/home/huseyina/code_mode/COMPANY_ABC"
              required
            />

            {/* Quick Paths */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {quickPaths.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => setWorkspace(item.path)}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: workspace === item.path ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${workspace === item.path ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: workspace === item.path ? '#38bdf8' : '#cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  📁 {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Apply to all positions toggle */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <input
              type="checkbox"
              id="updateAllPositions"
              checked={updateAllPositions}
              onChange={(e) => setUpdateAllPositions(e.target.checked)}
              style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#6366f1' }}
            />
            <label htmlFor="updateAllPositions" style={{ cursor: 'pointer', fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.4 }}>
              <strong>Tüm bağlı departman koltuklarının workspace'ini güncelle</strong>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                İşaretlendiğinde; CEO, CFO, Kalite ve Tedarik gibi şirkete bağlı koltukların workspace yolu bu yeni dizin ile senkronize edilir. (Özel atanmış CTO monorepo hariç tutulur).
              </div>
            </label>
          </div>

          {/* Current Positions Workspace Summary */}
          <div>
            <label className="form-label" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>👥 Mevcut Koltukların Çalışma Alanları:</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{positions.length} Koltuk Aktif</span>
            </label>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '8px 12px',
              maxHeight: '160px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                    fontSize: '11.5px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{pos.icon}</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{pos.title}</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>Level {pos.level}</span>
                  </div>
                  <div className="mono" style={{ color: pos.workspace.includes('custom-harness') ? '#a78bfa' : '#38bdf8', fontSize: '11px' }}>
                    {pos.workspace.split('/').slice(-2).join('/')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Vazgeç
            </button>
            <button type="submit" className="btn-primary">
              💾 Şirket ve Çalışma Alanını Güncelle
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
