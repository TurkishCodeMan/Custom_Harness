import React, { useState, useEffect, useMemo } from 'react'
import type { ActivityReceipt, Position } from '../types.js'
import { fetchAuditLogs, getAuditExportUrl } from '../api.js'
import {
  LedgerIcon,
  DownloadIcon,
  RefreshCwIcon,
  SearchIcon,
  TerminalIcon,
  FlowIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuIcon,
  ArrowRightIcon,
  TrashIcon,
  SparklesIcon
} from './Icons.js'

interface ActivityStreamProps {
  receipts: ActivityReceipt[]
  positions: Position[]
  onClearReceipts: () => void
  onOpenSession?: (sessionId: string) => void
}

export const ActivityStream: React.FC<ActivityStreamProps> = ({
  receipts,
  positions,
  onClearReceipts,
  onOpenSession
}) => {
  const [filterPosition, setFilterPosition] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [serverLogs, setServerLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})

  const loadServerAuditLogs = async () => {
    setIsLoading(true)
    try {
      const logs = await fetchAuditLogs({
        positionId: filterPosition !== 'all' ? filterPosition : undefined,
        actionType: filterType !== 'all' ? filterType : undefined,
        limit: 300
      })
      if (logs && logs.length > 0) {
        setServerLogs(logs)
      }
    } catch (err) {
      console.warn('Sunucu denetim izi çekilemedi:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadServerAuditLogs()
  }, [filterPosition, filterType])

  // Merge server audit entries with local memory receipts
  const allEntries: ActivityReceipt[] = useMemo(() => {
    const list: ActivityReceipt[] = [...receipts]
    const seenIds = new Set(list.map((r) => r.id))

    for (const log of serverLogs) {
      if (!seenIds.has(log.id)) {
        seenIds.add(log.id)
        list.push({
          id: log.id,
          positionId: log.positionId || 'system',
          positionTitle: log.positionTitle || 'Sistem',
          actionType: log.actionType,
          summary: log.summary,
          details: log.details,
          timestamp: log.timestamp,
          sessionId: log.sessionId,
          traceId: log.traceId
        })
      }
    }

    return list.sort((a, b) => b.timestamp - a.timestamp)
  }, [receipts, serverLogs])

  const filtered = useMemo(() => {
    return allEntries.filter((r) => {
      if (filterPosition !== 'all' && r.positionId !== filterPosition) return false
      if (filterType !== 'all' && r.actionType !== filterType) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchSummary = r.summary?.toLowerCase().includes(q)
        const matchTitle = r.positionTitle?.toLowerCase().includes(q)
        const matchTrace = r.traceId?.toLowerCase().includes(q)
        const matchDetails = typeof r.details === 'string' && r.details.toLowerCase().includes(q)
        if (!matchSummary && !matchTitle && !matchTrace && !matchDetails) return false
      }
      return true
    })
  }, [allEntries, filterPosition, filterType, searchQuery])

  // Telemetry counts
  const totalCount = allEntries.length
  const toolCallCount = allEntries.filter((r) => r.actionType === 'tool_call').length
  const subagentCount = allEntries.filter(
    (r) => r.actionType === 'subagent_spawn' || r.actionType === 'subagent_completed'
  ).length
  const reportCount = allEntries.filter((r) => r.actionType === 'report_generated').length

  const exportUrl = getAuditExportUrl({
    positionId: filterPosition !== 'all' ? filterPosition : undefined,
    actionType: filterType !== 'all' ? filterType : undefined
  })

  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const formatRelativeTime = (timestamp: number) => {
    const diffSec = Math.round((Date.now() - timestamp) / 1000)
    if (diffSec < 60) return `${diffSec}sn önce`
    const diffMin = Math.round(diffSec / 60)
    if (diffMin < 60) return `${diffMin}dk önce`
    const diffHours = Math.round(diffMin / 60)
    if (diffHours < 24) return `${diffHours}sa önce`
    return new Date(timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: '1240px', margin: '0 auto', width: '100%' }}>
      {/* Top Header & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          gap: '20px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
                boxShadow: '0 0 16px rgba(99, 102, 241, 0.2)'
              }}
            >
              <LedgerIcon size={18} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              Karar Defteri & Denetim İzi (Audit Ledger)
            </h2>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#10b981',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              IMMUTABLE JSONL
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, maxWidth: '720px', lineHeight: 1.5 }}>
            Ajanların aldığı her karar, yürüttüğü her araç çağrısı ve ürettiği tüm raporlar sunucuda kalıcı
            denetim iziyle mühürlenir. Tüm kararlar geriye dönük incelenebilir ve tekrar oynatılabilir (100% Replay).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a
            href={exportUrl}
            download
            className="btn-secondary"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: '8px'
            }}
          >
            <DownloadIcon size={14} />
            <span>CSV / Excel İndir</span>
          </a>

          <button
            className="btn-secondary"
            onClick={loadServerAuditLogs}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: '8px'
            }}
          >
            <RefreshCwIcon size={14} className={isLoading ? 'spin-anim' : ''} />
            <span>{isLoading ? 'Yenileniyor...' : 'Yenile'}</span>
          </button>

          <button
            className="btn-secondary"
            onClick={onClearReceipts}
            title="Önbellek kayıtlarını sıfırla"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              color: '#94a3b8'
            }}
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>

      {/* KPI Telemetry Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px 20px',
            position: 'relative'
          }}
        >
          <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
            Toplam Denetim Kaydı
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Değiştirilemez disk günlüğü
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '12px',
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
              Araç İnvokasyonları
            </span>
            <TerminalIcon size={14} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
            {toolCallCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Dosya, komut ve API araçları
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '12px',
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase' }}>
              A2A Görev Devirleri
            </span>
            <FlowIcon size={14} color="#818cf8" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#818cf8', marginTop: '6px' }}>
            {subagentCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Ajanlar arası hiyerarşik delegasyon
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '12px',
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>
              Üretilen Raporlar
            </span>
            <CheckCircleIcon size={14} color="#34d399" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
            {reportCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Yönetimsel kanıt ve bulgular
          </div>
        </div>
      </div>

      {/* Modern Filter & Search Bar */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '6px 12px',
            flex: '1',
            minWidth: '240px',
            maxWidth: '380px'
          }}
        >
          <SearchIcon size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Kayıt, araç, özet veya trace ID ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '12.5px',
              outline: 'none',
              width: '100%'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Tüm Eylemler' },
            { id: 'tool_call', label: 'Araç Çağrıları' },
            { id: 'subagent_spawn', label: 'Alt Ajanlar' },
            { id: 'report_generated', label: 'Raporlar' },
            { id: 'directive_issued', label: 'Direktifler' }
          ].map((type) => {
            const isActive = filterType === type.id
            return (
              <button
                key={type.id}
                onClick={() => setFilterType(type.id)}
                style={{
                  background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#c7d2fe' : '#94a3b8',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {type.label}
              </button>
            )
          })}
        </div>

        {/* Seat / Position Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Pozisyon:</span>
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">Tüm Pozisyonlar</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Receipts Timeline Feed */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '60px 40px',
            textAlign: 'center'
          }}
        >
          <div style={{ width: '42px', height: '42px', margin: '0 auto 16px auto', color: '#64748b' }}>
            <LedgerIcon size={42} />
          </div>
          <h3 style={{ fontSize: '16px', color: '#f8fafc', marginBottom: '8px' }}>
            Filtreye Uygun Denetim Kaydı Bulunamadı
          </h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
            Seçili kriterlerle eşleşen kayıt yok. Ajanlar direktif yürüttüğünde veya yeni bir araç çağırdığında tüm
            adımlar burada otomatik listelenir.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((receipt) => {
            const pos = positions.find((p) => p.id === receipt.positionId)
            const isExpanded = !!expandedDetails[receipt.id]

            const getTypeBadge = () => {
              switch (receipt.actionType) {
                case 'tool_call':
                  return { text: 'ARAÇ ÇAĞRISI', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' }
                case 'subagent_spawn':
                  return { text: 'ALT AJAN BAŞLATILDI', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)' }
                case 'subagent_completed':
                  return { text: 'ALT AJAN TAMAMLANDI', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)' }
                case 'report_generated':
                  return { text: 'RAPOR OLUŞTURULDU', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)' }
                case 'directive_issued':
                  return { text: 'DİREKTİF VERİLDİ', color: '#a5b4fc', bg: 'rgba(99, 102, 241, 0.15)' }
                case 'routine_triggered':
                  return { text: 'ZAMANLANMIŞ RUTİN', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' }
                default:
                  return { text: 'İŞLEM', color: '#94a3b8', bg: 'rgba(255, 255, 255, 0.05)' }
              }
            }

            const badge = getTypeBadge()

            return (
              <div
                key={receipt.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  transition: 'border-color 0.2s ease, background 0.2s ease'
                }}
              >
                {/* Position Avatar Icon */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0,
                    color: '#38bdf8'
                  }}
                >
                  {pos?.icon || <CpuIcon size={18} />}
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '6px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: badge.bg,
                        color: badge.color,
                        letterSpacing: '0.04em',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {badge.text}
                    </span>

                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                      {pos?.title || receipt.positionTitle}
                    </span>

                    {receipt.traceId && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          color: '#a5b4fc',
                          background: 'rgba(99, 102, 241, 0.12)',
                          padding: '1px 7px',
                          borderRadius: '4px',
                          border: '1px solid rgba(99, 102, 241, 0.25)'
                        }}
                      >
                        Trace: {receipt.traceId}
                      </span>
                    )}

                    <div
                      style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        color: '#64748b'
                      }}
                    >
                      <ClockIcon size={12} />
                      <span title={new Date(receipt.timestamp).toLocaleString('tr-TR')}>
                        {formatRelativeTime(receipt.timestamp)}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {receipt.summary}
                  </div>

                  {/* Actions & Collapsible JSON Details */}
                  <div
                    style={{
                      marginTop: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    {receipt.details && (
                      <button
                        onClick={() => toggleDetails(receipt.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#38bdf8',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{isExpanded ? '▾ Detayları Gizle' : '▸ JSON Detaylarını Göster'}</span>
                      </button>
                    )}

                    {receipt.sessionId && onOpenSession && (
                      <button
                        onClick={() => onOpenSession(receipt.sessionId!)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.35)',
                          color: '#a5b4fc',
                          borderRadius: '6px',
                          padding: '3px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>Oturumu Replay Olarak Aç</span>
                        <ArrowRightIcon size={11} />
                      </button>
                    )}
                  </div>

                  {receipt.details && isExpanded && (
                    <div
                      style={{
                        marginTop: '10px',
                        background: 'rgba(0, 0, 0, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: '#94a3b8',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5
                      }}
                    >
                      {typeof receipt.details === 'string'
                        ? receipt.details
                        : JSON.stringify(receipt.details, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

