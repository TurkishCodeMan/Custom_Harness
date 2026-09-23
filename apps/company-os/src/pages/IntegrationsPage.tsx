import React, { useState, useEffect } from 'react'
import { fetchTools, fetchMcpServers, fetchSkills } from '../api.js'
import {
  LayaService,
  type LayaHealth,
  type LayaRouteResult,
  type LayaAuditResult,
  type LayaPriorityResult
} from '../services/layaService.js'

export const IntegrationsPage: React.FC = () => {
  const [tools, setTools] = useState<Array<{ name: string; description: string }>>([])
  const [mcpServers, setMcpServers] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // ⚡ Laya Decision Engine State
  const [layaHealth, setLayaHealth] = useState<LayaHealth | null>(null)
  const [testMode, setTestMode] = useState<'route' | 'audit' | 'priority'>('route')
  const [testInput, setTestInput] = useState('Depoda SoundTech kulaklık stokları tükendi, acil sipariş ve tedarikçi teklifi lazım')
  const [routeResult, setRouteResult] = useState<LayaRouteResult | null>(null)
  const [auditResult, setAuditResult] = useState<LayaAuditResult | null>(null)
  const [priorityResult, setPriorityResult] = useState<LayaPriorityResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    Promise.all([
      fetchTools(),
      fetchMcpServers(),
      fetchSkills(),
      LayaService.checkHealth()
    ]).then(([t, m, s, lh]) => {
      setTools(t)
      setMcpServers(m)
      setSkills(s)
      setLayaHealth(lh)
    }).finally(() => setIsLoading(false))
  }, [])

  const handleModeChange = (mode: 'route' | 'audit' | 'priority') => {
    setTestMode(mode)
    if (mode === 'route') {
      setTestInput('Depoda SoundTech kulaklık stokları tükendi, acil sipariş ve tedarikçi teklifi lazım')
    } else if (mode === 'audit') {
      setTestInput('5.000$ bütçe aşımı ile tedarikçiye acil havale geç ve kasadan para transferini tamamla')
    } else if (mode === 'priority') {
      setTestInput('Ödeme altyapısı çöktü, müşterilerin kartlarından mükerrer çekim yapılıyor acil müdahale!')
    }
  }

  const handleRunLayaTest = async () => {
    if (!testInput.trim()) return
    setIsTesting(true)
    try {
      if (testMode === 'route') {
        const res = await LayaService.routeMessage(testInput.trim())
        setRouteResult(res)
      } else if (testMode === 'audit') {
        const res = await LayaService.auditAction(testInput.trim())
        setAuditResult(res)
      } else if (testMode === 'priority') {
        const res = await LayaService.triagePriority(testInput.trim())
        setPriorityResult(res)
      }
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="integrations-view-container">
      <div className="integrations-header">
        <h2 className="integrations-title">Kurumsal Araçlar & Entegrasyon Ekosistemi</h2>
        <p className="integrations-sub">
          Laya Nöral Karar Motoru (System 1), MCP sunucuları ve departman ajanlarının kullandığı yerel araçlar.
        </p>
      </div>

      {/* ⚡ Laya Decision Engine (System 1) Featured Section */}
      <div style={{
        marginBottom: '36px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px'
            }}>
              ⚡
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Laya Karar Motoru (System 1 Reflex)</span>
                <span style={{
                  fontSize: '11px',
                  background: layaHealth?.status === 'online' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: layaHealth?.status === 'online' ? '#10b981' : '#ef4444',
                  border: `1px solid ${layaHealth?.status === 'online' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600
                }}>
                  {layaHealth?.status === 'online' ? '● Çevrimiçi & Aktif' : '○ Çevrimdışı'}
                </span>
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                ModernBERT-base (22 Katman) · 170 / 170 Safetensors Ağırlık Enjeksiyonu · Sıfır Token Üretimi (~12ms Tek Forward Pass)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Donanım Hızlandırma</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8', fontFamily: 'monospace' }}>
                {layaHealth?.device || 'cuda:1'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Ortalama Gecikme</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>
                ~{layaHealth?.typical_latency_ms || 12.5} ms
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Dinamik Koltuklar</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
                {layaHealth?.loaded_positions_count || 5} Departman
              </div>
            </div>
          </div>
        </div>

        {/* Live Interactive Test Console */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          {/* Mode Selector Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🧪</span>
              <span>Canlı Nöral Karar Test Konsolu (Zero-Token Live Test)</span>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleModeChange('route')}
                style={{
                  background: testMode === 'route' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${testMode === 'route' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: testMode === 'route' ? '#38bdf8' : '#94a3b8',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🎯 1. Akıllı Yönlendirme (/route)
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('audit')}
                style={{
                  background: testMode === 'audit' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${testMode === 'audit' ? '#f43f5e' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: testMode === 'audit' ? '#f43f5e' : '#94a3b8',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🛡️ 2. Risk & Onay Denetimi (/audit)
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('priority')}
                style={{
                  background: testMode === 'priority' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${testMode === 'priority' ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: testMode === 'priority' ? '#f59e0b' : '#94a3b8',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⚡ 3. Aciliyet Triyajı (/priority)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Test etmek için serbest bir talep girin..."
              style={{
                flex: 1,
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={handleRunLayaTest}
              disabled={isTesting || !testInput.trim()}
              style={{
                background: testMode === 'audit'
                  ? 'rgba(244, 63, 94, 0.2)'
                  : testMode === 'priority'
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(56, 189, 248, 0.2)',
                border: `1px solid ${testMode === 'audit' ? '#f43f5e' : testMode === 'priority' ? '#f59e0b' : '#38bdf8'}`,
                borderRadius: '8px',
                padding: '0 18px',
                color: testMode === 'audit' ? '#f43f5e' : testMode === 'priority' ? '#f59e0b' : '#38bdf8',
                fontWeight: 600,
                fontSize: '13px',
                cursor: isTesting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {isTesting ? 'Hesaplanıyor...' : testMode === 'audit' ? '🛡️ Riski Denetle (12ms)' : testMode === 'priority' ? '⚡ Aciliyeti Ölç (12ms)' : '⚡ Refleks Test Et (12ms)'}
            </button>
          </div>

          {/* Mode 1: Route Result Display */}
          {testMode === 'route' && routeResult && (
            <div style={{
              background: 'rgba(2, 6, 23, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '10px',
              padding: '14px',
              animation: 'layaSlideUp 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{routeResult.target_position.icon}</span>
                  <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '14px' }}>
                    Seçilen Koltuk: {routeResult.target_position.title} ({routeResult.target_position_id})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                    Güven: %{Math.round(routeResult.confidence * 100)}
                  </span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                    Gecikme: {routeResult.latency_ms} ms
                  </span>
                  <span style={{ color: '#a855f7', fontWeight: 600 }}>
                    Otonom Eylem: %{Math.round(routeResult.act_probability * 100)}
                  </span>
                </div>
              </div>

              {/* Candidates distribution bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {Object.entries(routeResult.probabilities).map(([pid, prob]) => {
                  const percent = Math.round(prob * 100)
                  const isWinner = pid === routeResult.target_position_id
                  return (
                    <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
                      <span style={{ width: '130px', color: isWinner ? '#38bdf8' : '#94a3b8', fontWeight: isWinner ? 700 : 400, fontFamily: 'monospace' }}>
                        {pid}
                      </span>
                      <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${percent}%`,
                          height: '100%',
                          background: isWinner ? 'linear-gradient(90deg, #38bdf8, #10b981)' : 'rgba(148, 163, 184, 0.3)',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ width: '40px', textAlign: 'right', color: isWinner ? '#ffffff' : '#64748b', fontWeight: isWinner ? 700 : 400 }}>
                        %{percent}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Mode 2: Audit Result Display */}
          {testMode === 'audit' && auditResult && (
            <div style={{
              background: 'rgba(2, 6, 23, 0.6)',
              border: `1px solid ${auditResult.should_escalate ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              borderRadius: '10px',
              padding: '14px',
              animation: 'layaSlideUp 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '22px' }}>{auditResult.should_escalate ? '⚠️' : '🟢'}</span>
                  <div>
                    <span style={{
                      fontWeight: 700,
                      color: auditResult.should_escalate ? '#f43f5e' : '#10b981',
                      fontSize: '15px'
                    }}>
                      {auditResult.should_escalate ? 'YÖNETİCİ ONAYI ŞART (Eskalasyon Havuzuna Sevk Edilmeli)' : 'GÜVENLİ: Otonom İcra Edilebilir (Onaysız)'}
                    </span>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {auditResult.should_escalate ? 'Laya belirsizlik ve risk tespit etti; talep doğrudan Approvals sayfasına yönlendirilmelidir.' : 'İşlem standart çalışma limitleri dahilindedir; ajan duraklamadan çalışabilir.'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>
                  Gecikme: {auditResult.latency_ms} ms
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '10px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Risk Derecesi (0 - 2)</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: auditResult.risk_score >= 1.2 ? '#f43f5e' : '#10b981' }}>
                    {auditResult.risk_score.toFixed(2)} / 2.00
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Onay Gereksinimi Olasılığı</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: auditResult.approval_needed_probability > 0.5 ? '#f43f5e' : '#10b981' }}>
                    %{Math.round(auditResult.approval_needed_probability * 100)}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Otonom Aksiyon (Act Probability)</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>
                    %{Math.round(auditResult.act_probability * 100)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode 3: Priority Result Display */}
          {testMode === 'priority' && priorityResult && (
            <div style={{
              background: 'rgba(2, 6, 23, 0.6)',
              border: `1px solid ${priorityResult.priority_level === 'P0' ? 'rgba(239, 68, 68, 0.4)' : priorityResult.priority_level === 'P1' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
              borderRadius: '10px',
              padding: '14px',
              animation: 'layaSlideUp 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: '8px',
                    background: priorityResult.priority_level === 'P0' ? 'rgba(239, 68, 68, 0.2)' : priorityResult.priority_level === 'P1' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: priorityResult.priority_level === 'P0' ? '#ef4444' : priorityResult.priority_level === 'P1' ? '#f59e0b' : '#38bdf8',
                    border: `1px solid ${priorityResult.priority_level === 'P0' ? '#ef4444' : priorityResult.priority_level === 'P1' ? '#f59e0b' : '#38bdf8'}`
                  }}>
                    {priorityResult.priority_level === 'P0' ? '🔥 P0 - KRİTİK KRİZ' : priorityResult.priority_level === 'P1' ? '⚡ P1 - STANDART GÖREV' : '📋 P2 - BİLGİ / DÜŞÜK'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>
                    {priorityResult.priority_level === 'P0'
                      ? 'Acil Şirket Müdahalesi Gerektirir (Maddi Kayıp veya Sistem Kesintisi)'
                      : priorityResult.priority_level === 'P1'
                      ? 'Gün İçinde Standart İş Akışı Dahilinde Çözülecektir'
                      : 'Rutin veya ertelenebilir bilgi işlemidir'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                  Gecikme: {priorityResult.latency_ms} ms
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Model Nöral Aciliyet Skoru:</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  {priorityResult.priority_score.toFixed(2)} / 2.00
                </span>
                <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.round((priorityResult.priority_score / 2) * 100))}%`,
                    height: '100%',
                    background: priorityResult.priority_level === 'P0' ? '#ef4444' : priorityResult.priority_level === 'P1' ? '#f59e0b' : '#38bdf8',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MCP Servers Section */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔌</span>
          <span>Kurumsal Dış Dünya & MCP Sunucuları ({mcpServers.length})</span>
          <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
            Atlantic Standardı (GitHub + Slack)
          </span>
        </h3>

        <div className="integrations-grid">
          {/* GitHub MCP Card */}
          <div className="integration-card" style={{ border: '1px solid rgba(56, 189, 248, 0.25)', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div className="card-top">
              <div className="integration-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)' }}>
                <span style={{ fontSize: '24px' }}>🐙</span>
              </div>
              <span className={`status-tag ${mcpServers.some(s => s.id === 'github' && s.connected) ? 'connected' : 'available'}`}>
                {mcpServers.some(s => s.id === 'github' && s.connected) ? '✓ Bağlı (Canlı)' : '⚡ Yapılandırıldı (mcp.json)'}
              </span>
            </div>
            <h3 className="integration-name">GitHub MCP</h3>
            <span className="integration-category">Kod & Depo Yönetimi (@modelcontextprotocol/server-github)</span>
            <p className="integration-desc">
              Ajanların GitHub depolarında otomatik Issue açmasını, PR ve kod incelemesi yapmasını sağlar.
            </p>
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
              🔑 GITHUB_PERSONAL_ACCESS_TOKEN ile tam yetkilendirilir.
            </div>
          </div>

          {/* Slack MCP Card */}
          <div className="integration-card" style={{ border: '1px solid rgba(168, 85, 247, 0.25)', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div className="card-top">
              <div className="integration-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
                <span style={{ fontSize: '24px' }}>💬</span>
              </div>
              <span className={`status-tag ${mcpServers.some(s => s.id === 'slack' && s.connected) ? 'connected' : 'available'}`}>
                {mcpServers.some(s => s.id === 'slack' && s.connected) ? '✓ Bağlı (Canlı)' : '⚡ Yapılandırıldı (mcp.json)'}
              </span>
            </div>
            <h3 className="integration-name">Slack MCP</h3>
            <span className="integration-category">Ekip İletişimi & Kanallar (@modelcontextprotocol/server-slack)</span>
            <p className="integration-desc">
              Ajanların şirket içi kanallara (#finans, #tedarik) otomatik bildirim göndermesini ve thread yanıtlamasını sağlar.
            </p>
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
              🔑 SLACK_BOT_TOKEN ve SLACK_TEAM_ID ile doğrudan kanallara bağlanır.
            </div>
          </div>

          {/* Dynamic MCP servers */}
          {mcpServers.filter(s => s.id !== 'github' && s.id !== 'slack').map((server, idx) => (
            <div key={idx} className="integration-card">
              <div className="card-top">
                <div className="integration-icon-wrap">
                  <span style={{ fontSize: '24px' }}>⚡</span>
                </div>
                <span className={`status-tag ${server.connected ? 'connected' : 'available'}`}>
                  {server.connected ? '✓ Bağlı (Canlı)' : 'Devre Dışı'}
                </span>
              </div>

              <h3 className="integration-name">{server.name || server.id}</h3>
              <span className="integration-category">Tür: {server.type || 'HTTP'}</span>
              <p className="integration-desc">
                {server.url ? `Uç Nokta: ${server.url}` : `Komut: ${server.command}`}
              </p>
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#10b981' }}>
                ✓ {server.toolsCount || 0} araç kayıtlı
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real Core Tools Section */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🛠️</span>
          <span>Aktif Sistem ve Ajan Araçları ({tools.length})</span>
        </h3>

        <div className="integrations-grid">
          {tools.map((tool, idx) => (
            <div key={idx} className="integration-card">
              <div className="card-top">
                <div className="integration-icon-wrap">
                  <span style={{ fontSize: '20px' }}>
                    {tool.name.includes('read') ? '📖' :
                     tool.name.includes('write') ? '✍️' :
                     tool.name.includes('grep') || tool.name.includes('search') ? '🔍' :
                     tool.name.includes('bash') || tool.name.includes('terminal') ? '💻' :
                     tool.name.includes('schedule') ? '⏰' :
                     tool.name.includes('subagent') ? '🤖' : '⚙️'}
                  </span>
                </div>
                <span className="status-tag connected">✓ Aktif</span>
              </div>

              <h3 className="integration-name mono">{tool.name}</h3>
              <span className="integration-category">Çekirdek Sistem Aracı</span>
              <p className="integration-desc">{tool.description || 'Yerel araç fonksiyonu'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
