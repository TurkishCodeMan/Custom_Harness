import React from 'react'

export interface TokenMeasurement {
  systemPromptTokens?: number
  toolsTokens?: number
  historyTokens?: number
  totalTokens?: number
  contextWindow?: number
  percentage?: number
  [key: string]: any
}

export interface TokenMeterBarProps {
  measurement: TokenMeasurement | null
  modelName?: string
}

export function TokenMeterBar({ measurement, modelName = 'Model' }: TokenMeterBarProps) {
  const m = (measurement || {}) as any
  const systemPromptTokens = m.systemPromptTokens ?? m.contextBreakdown?.systemTokens ?? 120
  const toolsTokens = m.toolsTokens ?? m.contextBreakdown?.toolsTokens ?? 650
  const historyTokens = m.historyTokens ?? m.contextBreakdown?.messageTokens ?? 0
  const totalTokens = m.totalTokens ?? m.contextPressure?.usedTokens ?? (systemPromptTokens + toolsTokens + historyTokens)
  const contextWindow = m.contextWindow ?? m.contextPressure?.contextWindow ?? 24576
  const percentage = m.percentage ?? m.contextPressure?.percent ?? Math.min(100, Math.round((totalTokens / contextWindow) * 100))

  const formatTok = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  const sysPct = Math.min(100, (systemPromptTokens / contextWindow) * 100)
  const toolPct = Math.min(100, (toolsTokens / contextWindow) * 100)
  const histPct = Math.min(100, (historyTokens / contextWindow) * 100)
  const clampedTotalPct = Math.min(100, Math.round(percentage))

  const isWarning = clampedTotalPct >= 80
  const isDanger = clampedTotalPct >= 95

  return (
    <div className="token-meter-card">
      <div className="token-meter-header">
        <div className="meter-label-left">
          <span className="meter-icon">📊</span>
          <span className="meter-title">Bağlam Kullanımı</span>
        </div>
        <div className="meter-label-right">
          <span className={`meter-percent ${isDanger ? 'danger' : isWarning ? 'warning' : ''}`}>
            {clampedTotalPct}%
          </span>
          <span className="meter-fraction">
            ~{formatTok(totalTokens)} / {formatTok(contextWindow)}
          </span>
        </div>
      </div>

      <div className="token-meter-progress-track">
        <div className="meter-segment system" style={{ width: `${sysPct}%` }} title={`Sistem İstemi: ~${systemPromptTokens} tok`} />
        <div className="meter-segment tools" style={{ width: `${toolPct}%` }} title={`Araçlar: ~${toolsTokens} tok`} />
        <div className="meter-segment history" style={{ width: `${histPct}%` }} title={`Geçmiş: ~${historyTokens} tok`} />
      </div>

      <div className="token-meter-legend">
        <div className="legend-item">
          <span className="legend-dot system" />
          <span>Sistem: ~{formatTok(systemPromptTokens)}</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot tools" />
          <span>Araçlar: ~{formatTok(toolsTokens)}</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot history" />
          <span>Geçmiş: ~{formatTok(historyTokens)}</span>
        </div>
        <div className="legend-model-tag">{modelName}</div>
      </div>
    </div>
  )
}
