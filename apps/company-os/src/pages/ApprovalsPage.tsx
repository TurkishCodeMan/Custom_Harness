import React, { useState, useEffect, useMemo } from 'react'
import type { ApprovalItem } from '../types.js'
import { LayaService, type LayaAuditResult, type LayaHealth } from '../services/layaService.js'
import {
  GovernanceIcon,
  SparklesIcon,
  CpuIcon,
  SearchIcon,
  CheckCircleIcon,
  TrashIcon,
  FlowIcon
} from '../components/Icons.js'

interface ApprovalsPageProps {
  approvals: ApprovalItem[]
  policy?: 'auto' | 'ask_dangerous' | 'ask_all'
  onSelectPolicy?: (policy: 'auto' | 'ask_dangerous' | 'ask_all') => void
  onApprove: (id: string, outcome: 'allow_once' | 'allow_always') => void
  onDeny: (id: string) => void
  onRefresh?: () => void
  onOpenChat?: (sessionId?: string) => void
}

export const ApprovalsPage: React.FC<ApprovalsPageProps> = ({
  approvals,
  policy = 'ask_dangerous',
  onSelectPolicy,
  onApprove,
  onDeny,
  onRefresh,
  onOpenChat
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'denied'>('all')
  const [auditMap, setAuditMap] = useState<Record<string, LayaAuditResult>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedToolFilter, setSelectedToolFilter] = useState<string>('all')
  const [layaHealth, setLayaHealth] = useState<LayaHealth | null>(null)
  const [selectedItemForInspect, setSelectedItemForInspect] = useState<ApprovalItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null)

  // Fetch Laya Health Status
  useEffect(() => {
    LayaService.checkHealth().then(setLayaHealth).catch(() => {})
  }, [])

  // Show temporary toast notification
  const triggerToast = (msg: string) => {
    setFeedbackToast(msg)
    setTimeout(() => setFeedbackToast(null), 3000)
  }

  // Calculate stats
  const pendingItems = useMemo(() => approvals.filter(a => a.status === 'pending'), [approvals])
  const approvedItems = useMemo(() => approvals.filter(a => a.status === 'approved'), [approvals])
  const deniedItems = useMemo(() => approvals.filter(a => a.status === 'denied' || a.status === 'timed_out'), [approvals])

  // Real-time Laya System 1 Risk Audit for pending items
  useEffect(() => {
    pendingItems.forEach(async item => {
      if (auditMap[item.id]) return
      const textToAudit = item.title || item.toolName || 'Eylem denetimi'
      try {
        const res = await LayaService.auditAction(textToAudit, {
          action: item.toolName,
          details: item.details || (item.body ? { content: item.body } : undefined)
        })
        if (res) {
          setAuditMap(prev => ({ ...prev, [item.id]: res }))
        }
      } catch (err) {
        console.warn('Laya audit failed:', err)
      }
    })
  }, [pendingItems])

  // Extract unique tool names for filter
  const uniqueTools = useMemo(() => {
    const set = new Set<string>()
    approvals.forEach(a => {
      if (a.toolName) set.add(a.toolName)
    })
    return Array.from(set)
  }, [approvals])

  // Filtered Items
  const filteredItems = useMemo(() => {
    return approvals.filter(item => {
      // Tab filter
      if (activeTab === 'pending' && item.status !== 'pending') return false
      if (activeTab === 'approved' && item.status !== 'approved') return false
      if (activeTab === 'denied' && (item.status !== 'denied' && item.status !== 'timed_out')) return false

      // Tool filter
      if (selectedToolFilter !== 'all' && item.toolName !== selectedToolFilter) return false

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = (item.title || '').toLowerCase().includes(q)
        const matchTool = (item.toolName || '').toLowerCase().includes(q)
        const matchBody = (item.body || '').toLowerCase().includes(q)
        const matchSubject = (item.subject || '').toLowerCase().includes(q)
        const matchTo = (item.to || '').toLowerCase().includes(q)
        const matchDetails = typeof item.details === 'string'
          ? item.details.toLowerCase().includes(q)
          : JSON.stringify(item.details || {}).toLowerCase().includes(q)

        if (!matchTitle && !matchTool && !matchBody && !matchSubject && !matchTo && !matchDetails) {
          return false
        }
      }

      return true
    })
  }, [approvals, activeTab, selectedToolFilter, searchQuery])

  // Copy parameters / payload to clipboard
  const handleCopyPayload = (item: ApprovalItem) => {
    const payload = item.details || item.body || item.subject || ''
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
    navigator.clipboard.writeText(text)
    setCopiedId(item.id)
    triggerToast('📋 Parametreler panoya kopyalandı')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Bulk Approve Safe / Low-Risk items
  const handleBulkApproveLowRisk = () => {
    let approvedCount = 0
    pendingItems.forEach(item => {
      const audit = auditMap[item.id]
      if (audit && !audit.should_escalate && audit.risk_score < 1.0) {
        onApprove(item.id, 'allow_once')
        approvedCount++
      }
    })
    if (approvedCount > 0) {
      triggerToast(`✓ ${approvedCount} adet düşük riskli eylem onaylandı`)
    } else {
      triggerToast('ℹ️ Onaylanacak güvenli düşük riskli eylem bulunamadı')
    }
  }

  // Tool danger categorization helper
  const getToolCategory = (toolName: string) => {
    const name = toolName.toLowerCase()
    if (name.includes('bash') || name.includes('shell') || name.includes('terminal') || name.includes('exec') || name.includes('command')) {
      return { label: 'Terminal & Sistem Komutu', icon: '⚡', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)' }
    }
    if (name.includes('write') || name.includes('edit') || name.includes('replace') || name.includes('file') || name.includes('save') || name.includes('delete')) {
      return { label: 'Dosya Sistemi Değişikliği', icon: '📝', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' }
    }
    if (name.includes('http') || name.includes('fetch') || name.includes('api') || name.includes('curl') || name.includes('request')) {
      return { label: 'Dış Ağ / HTTP Çağrısı', icon: '🌐', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' }
    }
    if (name.includes('sql') || name.includes('db') || name.includes('postgres') || name.includes('redis')) {
      return { label: 'Veritabanı / Kayıt İşlemi', icon: '🗄️', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)' }
    }
    return { label: 'Ajan Eylem Çağrısı', icon: '🤖', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' }
  }

  return (
    <div className="approvals-view-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 32px' }}>
      {/* Feedback Toast */}
      {feedbackToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'rgba(15, 23, 42, 0.95)',
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '10px',
          padding: '12px 20px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backdropFilter: 'blur(8px)'
        }}>
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Top Header Row */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(244, 63, 94, 0.2))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <GovernanceIcon size={20} color="#f59e0b" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
              Onay & Yönetişim Merkezi (Approvals & Governance)
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '680px' }}>
            Ajanların kritik işlem yetkilerini denetleyin, risk puanlarını analiz edin ve kurumsal güvenlik politikanızı (Air-Gapped / Human-in-the-Loop) yönetin.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="approvals-refresh-btn"
            onClick={onRefresh}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '14px' }}>↻</span>
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Hero Stats Ribbon (Like Knowledge Base Page) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        {/* Stat 1: Pending Actions */}
        <div style={{
          background: pendingItems.length > 0
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(15, 23, 42, 0.6))'
            : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${pendingItems.length > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: '12px',
          padding: '16px 18px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Onay Bekleyenler</span>
            <span style={{ fontSize: '18px' }}>⏳</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: pendingItems.length > 0 ? '#f59e0b' : '#f8fafc' }}>
              {pendingItems.length}
            </span>
            {pendingItems.length > 0 && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.2)',
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                Müdahale Gerekli
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            İnsan onayı bekleyen kritik işlemler
          </div>
        </div>

        {/* Stat 2: Total Decisions Logged */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Kayıtlı Denetim Geçmişi</span>
            <span style={{ fontSize: '18px' }}>📜</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc' }}>
              {approvals.length}
            </span>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
              {approvedItems.length} Onaylı · {deniedItems.length} Red
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Tam şeffaf işlem defteri (Audit Ledger)
          </div>
        </div>

        {/* Stat 3: Laya System 1 Status */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(15, 23, 42, 0.6))',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Laya Neural Guard</span>
            <span style={{ fontSize: '18px' }}>🧠</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: layaHealth?.status === 'online' ? '#10b981' : '#f59e0b',
              boxShadow: layaHealth?.status === 'online' ? '0 0 10px #10b981' : 'none'
            }} />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8' }}>
              {layaHealth?.status === 'online' ? 'Aktif (Sub-15ms)' : 'Hazırda Bekliyor'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
            ⚡ 0-Token Anlık Risk & Eskalasyon Denetimi
          </div>
        </div>

        {/* Stat 4: Security & Air-Gap Compliance */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(15, 23, 42, 0.6))',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Veri Güvenliği & İzolasyon</span>
            <span style={{ fontSize: '18px' }}>🔒</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>
              100% On-Premise
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
            Veri dışarı çıkmaz · Asla eğitilmez
          </div>
        </div>
      </div>

      {/* Interactive Policy Configuration Cards */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              🛡️ Kurumsal Yönetişim & Otonomi Politikası
            </h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Ajanların şirket içi dosya, komut ve API araçlarını hangi serbestlik seviyesinde çalıştıracağını belirleyin.
            </p>
          </div>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '20px',
            background: policy === 'ask_dangerous' ? 'rgba(56, 189, 248, 0.15)' : policy === 'auto' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            color: policy === 'ask_dangerous' ? '#38bdf8' : policy === 'auto' ? '#10b981' : '#f43f5e',
            border: `1px solid ${policy === 'ask_dangerous' ? 'rgba(56, 189, 248, 0.3)' : policy === 'auto' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
          }}>
            Aktif Politika: {policy === 'ask_dangerous' ? 'GÜVENLİ DENETİM' : policy === 'auto' ? 'TAM OTONOM' : 'SIKI DENETİM'}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px'
        }}>
          {/* Policy 1: Auto */}
          <div
            onClick={() => onSelectPolicy?.('auto')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              cursor: onSelectPolicy ? 'pointer' : 'default',
              background: policy === 'auto' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${policy === 'auto' ? '#10b981' : 'rgba(255, 255, 255, 0.06)'}`,
              boxShadow: policy === 'auto' ? '0 0 20px rgba(16, 185, 129, 0.15)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🟢</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: policy === 'auto' ? '#10b981' : '#f8fafc' }}>
                  Tam Otonom Mod
                </span>
              </div>
              {policy === 'auto' && <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✓ Seçili</span>}
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
              Ajanlar dosya okuma/yazma, terminal ve periyodik rutinleri insan onayı beklemeden yürütür. Hızlı ve kesintisiz akış.
            </p>
          </div>

          {/* Policy 2: Safe (Recommended) */}
          <div
            onClick={() => onSelectPolicy?.('ask_dangerous')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              cursor: onSelectPolicy ? 'pointer' : 'default',
              background: policy === 'ask_dangerous' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${policy === 'ask_dangerous' ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)'}`,
              boxShadow: policy === 'ask_dangerous' ? '0 0 20px rgba(56, 189, 248, 0.15)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🛡️</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: policy === 'ask_dangerous' ? '#38bdf8' : '#f8fafc' }}>
                  Güvenli Mod (Önerilen)
                </span>
              </div>
              {policy === 'ask_dangerous' && <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>✓ Seçili</span>}
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
              Dosya okuma, arama ve güvenli sorgular otomatik izinlidir; yıkıcı veya riskli işlemler (bash, dosya silme vb.) onaya düşer.
            </p>
          </div>

          {/* Policy 3: Strict */}
          <div
            onClick={() => onSelectPolicy?.('ask_all')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              cursor: onSelectPolicy ? 'pointer' : 'default',
              background: policy === 'ask_all' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${policy === 'ask_all' ? '#f43f5e' : 'rgba(255, 255, 255, 0.06)'}`,
              boxShadow: policy === 'ask_all' ? '0 0 20px rgba(244, 63, 94, 0.15)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🔒</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: policy === 'ask_all' ? '#f43f5e' : '#f8fafc' }}>
                  Sıkı Sıfır-Güven (Zero-Trust)
                </span>
              </div>
              {policy === 'ask_all' && <span style={{ fontSize: '12px', color: '#f43f5e', fontWeight: 700 }}>✓ Seçili</span>}
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
              İstisnasız her araç çağrısı ve eylem yöneticinin onayına sunulur. Maksimum güvenlik ve tam insan gözetimi.
            </p>
          </div>
        </div>
      </div>

      {/* Control Bar: Filter Tabs + Tool Dropdown + Search Input + Bulk Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Filter Tabs */}
        <div className="approvals-tabs-row" style={{ margin: 0, display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className={`approvals-tab-pill ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <span>Tümü</span>
            {approvals.length > 0 && (
              <span style={{ marginLeft: '4px', opacity: 0.7 }}>({approvals.length})</span>
            )}
          </button>
          <button
            type="button"
            className={`approvals-tab-pill ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <span>⏳ Bekleyen</span>
            {pendingItems.length > 0 && (
              <span className="tab-counter-badge">{pendingItems.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`approvals-tab-pill ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            <span>✓ Onaylanan ({approvedItems.length})</span>
          </button>
          <button
            type="button"
            className={`approvals-tab-pill ${activeTab === 'denied' ? 'active' : ''}`}
            onClick={() => setActiveTab('denied')}
          >
            <span>✕ Reddedilen ({deniedItems.length})</span>
          </button>
        </div>

        {/* Right side: Search + Tool Filter + Bulk Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Tool Filter Dropdown */}
          {uniqueTools.length > 1 && (
            <select
              value={selectedToolFilter}
              onChange={(e) => setSelectedToolFilter(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all" style={{ background: '#0f172a' }}>Tüm Araçlar ({uniqueTools.length})</option>
              {uniqueTools.map(t => (
                <option key={t} value={t} style={{ background: '#0f172a' }}>{t}</option>
              ))}
            </select>
          )}

          {/* Quick Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '4px 12px',
            gap: '8px'
          }}>
            <SearchIcon size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Eylem veya parametre ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '12px',
                outline: 'none',
                width: '180px'
              }}
            />
            {searchQuery && (
              <span
                onClick={() => setSearchQuery('')}
                style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '12px' }}
              >
                ✕
              </span>
            )}
          </div>

          {/* Bulk Action: Quick Approve Safe */}
          {pendingItems.length > 1 && (
            <button
              type="button"
              onClick={handleBulkApproveLowRisk}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <span>⚡</span>
              <span>Düşük Risklileri Onayla</span>
            </button>
          )}
        </div>
      </div>

      {/* Approvals Cards List */}
      <div className="approvals-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredItems.map(item => {
          const category = getToolCategory(item.toolName || item.title || '')
          const audit = auditMap[item.id]
          const isPending = item.status === 'pending'
          const isApproved = item.status === 'approved'
          const isDenied = item.status === 'denied' || item.status === 'timed_out'

          return (
            <div
              key={item.id}
              className="approval-card-item"
              style={{
                background: isPending
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.04), rgba(15, 23, 42, 0.8))'
                  : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isPending ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.07)'}`,
                borderRadius: '14px',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                transition: 'all 0.2s ease',
                boxShadow: isPending ? '0 4px 20px rgba(0,0,0,0.3)' : 'none'
              }}
            >
              {/* Card Header: Icon + Category Badge + Action Name + Status Pill */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Category Icon Badge */}
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: category.bg,
                    border: `1px solid ${category.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    {category.icon}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                        {item.title || item.toolName || 'Kritik Eylem Talebi'}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: category.bg,
                        color: category.color,
                        border: `1px solid ${category.border}`
                      }}>
                        {category.label}
                      </span>
                      {item.toolName && (
                        <span style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          color: '#94a3b8',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          tool: {item.toolName}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      ID: {item.id} · Tetiklenme: {new Date(item.createdAt).toLocaleTimeString('tr-TR')}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isApproved && (
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      ✓ İzin Verildi (Approved)
                    </span>
                  )}
                  {isPending && (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      animation: 'pulse 2s infinite'
                    }}>
                      ⏳ Onay Bekliyor (Pending Review)
                    </span>
                  )}
                  {item.status === 'denied' && (
                    <span style={{
                      background: 'rgba(244, 63, 94, 0.15)',
                      color: '#f43f5e',
                      border: '1px solid rgba(244, 63, 94, 0.35)',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: '14px'
                    }}>
                      ✕ Reddedildi (Denied)
                    </span>
                  )}
                  {item.status === 'timed_out' && (
                    <span style={{
                      background: 'rgba(148, 163, 184, 0.15)',
                      color: '#94a3b8',
                      border: '1px solid rgba(148, 163, 184, 0.35)',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: '14px'
                    }}>
                      ⏱ Zaman Aşımı (Timed Out)
                    </span>
                  )}
                </div>
              </div>

              {/* Payload & Parameters Preview Box */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                padding: '12px 16px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    İşlem Parametreleri & Çağrı Gövdesi
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyPayload(item)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedId === item.id ? '#10b981' : '#94a3b8',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {copiedId === item.id ? '✓ Kopyalandı' : '📋 Kopyala'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedItemForInspect(item)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      🔍 Detaylı İncele
                    </button>
                  </div>
                </div>

                {item.subject && (
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                    <strong style={{ color: '#94a3b8' }}>Konu:</strong> {item.subject}
                  </div>
                )}
                {item.to && (
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                    <strong style={{ color: '#94a3b8' }}>Hedef:</strong> {item.to}
                  </div>
                )}
                {item.body && (
                  <pre style={{
                    margin: 0,
                    fontSize: '12px',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: '120px',
                    overflowY: 'auto'
                  }}>
                    {item.body}
                  </pre>
                )}
                {item.details && !item.body && (
                  <pre style={{
                    margin: 0,
                    fontSize: '12px',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: '120px',
                    overflowY: 'auto'
                  }}>
                    {typeof item.details === 'string' ? item.details : JSON.stringify(item.details, null, 2)}
                  </pre>
                )}
              </div>

              {/* ⚡ Laya System 1 Neural Risk & Escalation Banner */}
              {audit && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: audit.should_escalate
                    ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(15, 23, 42, 0.4))'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.4))',
                  border: `1px solid ${audit.should_escalate ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{audit.should_escalate ? '🚨' : '🛡️'}</span>
                    <div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: audit.should_escalate ? '#f43f5e' : '#10b981'
                      }}>
                        Laya Güvenlik Değerlendirmesi:{' '}
                        {audit.should_escalate ? 'Yüksek Risk · İnsan Onayı Şart' : 'Düşük Risk · Güvenli Eylem'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        Risk Puanı: <strong style={{ color: audit.should_escalate ? '#f43f5e' : '#10b981' }}>{audit.risk_score.toFixed(2)}</strong> / 2.00 ·
                        Onay İhtiyacı Olasılığı: %{Math.round(audit.approval_needed_probability * 100)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>
                        Otonom İcra: %{Math.round(audit.act_probability * 100)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>
                        ⚡ {audit.latency_ms} ms (0-Token Reflex)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons for Pending Items */}
              {isPending && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  flexWrap: 'wrap'
                }}>
                  <button
                    type="button"
                    onClick={() => onDeny(item.id)}
                    style={{
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      color: '#f43f5e',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ✕ Reddet (Deny)
                  </button>

                  <button
                    type="button"
                    onClick={() => onApprove(item.id, 'allow_always')}
                    style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ⚡ Her Zaman İzin Ver
                  </button>

                  <button
                    type="button"
                    onClick={() => onApprove(item.id, 'allow_once')}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '8px 22px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ✓ Tek Seferlik Onayla (Allow Once)
                  </button>
                </div>
              )}

              {/* Card Footer: Timestamp + Open Chat */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#64748b',
                paddingTop: '6px'
              }}>
                <span>
                  Oluşturulma:{' '}
                  {new Date(item.createdAt).toLocaleString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>

                {item.sessionId && (
                  <button
                    type="button"
                    onClick={() => onOpenChat?.(item.sessionId)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    💬 İlgili Sohbet Oturumunu Aç
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '60px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '48px' }}>🛡️</span>
            <h4 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {activeTab === 'pending' ? 'Onay Bekleyen Eylem Yok' : 'Filtreye Uygun İşlem Bulunamadı'}
            </h4>
            <p style={{ maxWidth: '460px', fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              Ajanlar mevcut güvenlik politikanız ({policy === 'auto' ? 'Tam Otonom' : policy === 'ask_dangerous' ? 'Güvenli Mod' : 'Sıkı Mod'}) dahilinde sorunsuz çalışıyor. Kritik veya riskli bir araç çağrıldığında burada anında listelenecektir.
            </p>
          </div>
        )}
      </div>

      {/* Deep Audit Inspection Modal */}
      {selectedItemForInspect && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '24px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🔍</span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Ayrıntılı Güvenlik & Yük Denetimi (Audit Trace)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForInspect(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Eylem Kimliği & Araç:</span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {selectedItemForInspect.title || selectedItemForInspect.toolName} ({selectedItemForInspect.toolName})
                </div>
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Ham JSON Yükü (Raw Payload):</span>
                <pre style={{
                  margin: '6px 0 0 0',
                  padding: '16px',
                  borderRadius: '10px',
                  background: '#020617',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontFamily: 'Consolas, Monaco, monospace',
                  overflowX: 'auto',
                  maxHeight: '300px'
                }}>
                  {JSON.stringify(selectedItemForInspect, null, 2)}
                </pre>
              </div>

              {auditMap[selectedItemForInspect.id] && (
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>Laya System 1 Karar Matrisi:</span>
                  <pre style={{
                    margin: '6px 0 0 0',
                    padding: '16px',
                    borderRadius: '10px',
                    background: '#020617',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#10b981',
                    fontSize: '12px',
                    fontFamily: 'Consolas, Monaco, monospace'
                  }}>
                    {JSON.stringify(auditMap[selectedItemForInspect.id], null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(selectedItemForInspect, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `audit-trace-${selectedItemForInspect.id}.json`
                  a.click()
                  triggerToast('📥 Denetim kaydı JSON olarak indirildi')
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#f8fafc',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📥 JSON İhraç Et
              </button>
              <button
                type="button"
                onClick={() => setSelectedItemForInspect(null)}
                style={{
                  background: '#38bdf8',
                  border: 'none',
                  color: '#0f172a',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
