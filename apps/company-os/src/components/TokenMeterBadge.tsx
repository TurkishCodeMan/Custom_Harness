import React, { useState } from 'react'
import type { TokenMeasurement } from '../types.js'

interface TokenMeterBadgeProps {
  measurement?: TokenMeasurement
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    model?: string
  }
  estimatedTokens?: number
  modelName?: string
  containerStyle?: React.CSSProperties
}

export const TokenMeterBadge: React.FC<TokenMeterBadgeProps> = ({
  measurement,
  usage,
  estimatedTokens,
  modelName,
  containerStyle
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Derive values from real backend measurement or reported usage
  const actual = measurement?.actualUsage
  const pressure = measurement?.contextPressure
  const breakdown = measurement?.contextBreakdown

  const promptTokens = usage?.promptTokens ?? actual?.lastPromptTokens ?? actual?.promptTokens ?? null
  const completionTokens = usage?.completionTokens ?? actual?.lastCompletionTokens ?? actual?.completionTokens ?? null
  const currentTurnTokens = (promptTokens !== null && completionTokens !== null) ? (promptTokens + completionTokens) : null
  const totalTokens = usage?.totalTokens ?? currentTurnTokens ?? (measurement?.contextPressure?.usedTokens) ?? measurement?.totalTokens ?? actual?.totalTokens ?? estimatedTokens

  const contextWindow = pressure?.contextWindow ?? measurement?.contextWindow ?? 16384
  const percent = pressure?.percent ?? (totalTokens ? Math.min(100, Math.round((totalTokens / contextWindow) * 100)) : 0)
  const activeModel = usage?.model || actual?.modelId || measurement?.modelId || modelName || 'Qwen3.8-27B'

  // Bar color based on context pressure
  const barColor = percent > 80 ? '#ef4444' : percent > 50 ? '#f59e0b' : '#38bdf8'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '8px',
      padding: '6px 12px',
      marginTop: '6px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
      ...containerStyle
    }}>
      {/* Primary Status Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '11px',
        color: '#94a3b8'
      }}>
        {/* Left side: Model & Tokens */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: '#38bdf8',
            fontWeight: 600,
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            ⚡ TokenMeter
          </span>

          <span className="mono" style={{ color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
            {activeModel}
          </span>

          {promptTokens !== null && (
            <span>
              Giriş: <strong style={{ color: '#cbd5e1' }}>{promptTokens.toLocaleString()}</strong> tk
            </span>
          )}

          {completionTokens !== null && (
            <span>
              Çıkış: <strong style={{ color: '#34d399' }}>{completionTokens.toLocaleString()}</strong> tk
            </span>
          )}

          {totalTokens ? (
            <span>
              Toplam: <strong style={{ color: '#fbbf24' }}>{totalTokens.toLocaleString()}</strong> tk
            </span>
          ) : (
            <span style={{ color: '#64748b' }}>Hazır / 0 token</span>
          )}
        </div>

        {/* Right side: Pressure Bar & Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {contextWindow > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title={`Bağlam Doluluğu: %${percent} (${(totalTokens || 0).toLocaleString()} / ${contextWindow.toLocaleString()} token)`}>
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>Bağlam:</span>
              <div style={{
                width: '64px',
                height: '5px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min(100, Math.max(2, percent))}%`,
                  height: '100%',
                  background: barColor,
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <span style={{ color: barColor, fontWeight: 600, fontSize: '11px' }}>%{percent}</span>
            </div>
          )}

          {breakdown && (
            <button
              type="button"
              onClick={() => setIsExpanded(prev => !prev)}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: isExpanded ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '10.5px',
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Bağlam bütçesi dökümünü göster/gizle"
            >
              <span>{isExpanded ? '▲' : '▼'}</span>
              <span>Döküm</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Breakdown Drawer */}
      {isExpanded && breakdown && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '6px',
          marginTop: '2px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          fontSize: '10.5px',
          color: '#94a3b8'
        }}>
          <div>
            <span style={{ color: '#64748b' }}>Sistem İstemleri: </span>
            <strong style={{ color: '#a78bfa' }}>{breakdown.systemTokens?.toLocaleString() || 0} tk</strong>
            <span style={{ fontSize: '9.5px', color: '#64748b', marginLeft: '3px' }}>(%{breakdown.systemPercent || 0})</span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Araçlar & Beceriler: </span>
            <strong style={{ color: '#38bdf8' }}>{breakdown.toolsTokens?.toLocaleString() || 0} tk</strong>
            <span style={{ fontSize: '9.5px', color: '#64748b', marginLeft: '3px' }}>(%{breakdown.toolsPercent || 0})</span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Mesaj Geçmişi: </span>
            <strong style={{ color: '#34d399' }}>{breakdown.messageTokens?.toLocaleString() || 0} tk</strong>
            <span style={{ fontSize: '9.5px', color: '#64748b', marginLeft: '3px' }}>(%{breakdown.messagePercent || 0})</span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Pencere Sınırı: </span>
            <strong style={{ color: '#f1f5f9' }}>{contextWindow?.toLocaleString()} tk</strong>
          </div>
        </div>
      )}
    </div>
  )
}
