import React, { useMemo } from 'react'
import type { Position } from '../types.js'
import { PositionCard } from './PositionCard.js'

interface OrgChartProps {
  positions: Position[]
  onSelectPosition: (pos: Position) => void
  onDirectDirective: (pos: Position) => void
  onViewReport: (reportPath: string) => void
  isDirectiveRunning: boolean
}

export const OrgChart: React.FC<OrgChartProps> = ({
  positions,
  onSelectPosition,
  onDirectDirective,
  onViewReport,
  isDirectiveRunning
}) => {
  const level1 = useMemo(() => positions.filter(p => p.level === 1), [positions])
  const level2 = useMemo(() => positions.filter(p => p.level === 2), [positions])
  const level3 = useMemo(() => positions.filter(p => p.level === 3), [positions])

  return (
    <div className="org-chart-canvas">
      {/* Background Grid Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* SVG Connection Lines */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="activeLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>

        {/* Dynamic visual lines indicator */}
        {isDirectiveRunning && (
          <circle r="4" fill="#38bdf8">
            <animateMotion
              path="M 600, 160 L 600, 240 L 300, 240 L 300, 300"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>

      {/* Level 1: CEO & Board */}
      <div className="tree-level">
        <div className="tree-level-label">Level 1 — Genel Yönetim</div>
        {level1.map(pos => (
          <PositionCard
            key={pos.id}
            position={pos}
            onClick={() => onSelectPosition(pos)}
            onDirectDirective={onDirectDirective}
            onViewReport={onViewReport}
          />
        ))}
      </div>

      {/* Level 2: C-Suite & Department Directors */}
      <div className="tree-level">
        <div className="tree-level-label">Level 2 — İcra Direktörleri & Bölüm Müdürleri</div>
        {level2.map(pos => (
          <PositionCard
            key={pos.id}
            position={pos}
            onClick={() => onSelectPosition(pos)}
            onDirectDirective={onDirectDirective}
            onViewReport={onViewReport}
          />
        ))}
      </div>

      {/* Level 3: Specialized Analysts & Subagents */}
      {level3.length > 0 && (
        <div className="tree-level">
          <div className="tree-level-label">Level 3 — Uzman Analistler & Subagent Koltukları</div>
          {level3.map(pos => (
            <PositionCard
              key={pos.id}
              position={pos}
              onClick={() => onSelectPosition(pos)}
              onDirectDirective={onDirectDirective}
              onViewReport={onViewReport}
            />
          ))}
        </div>
      )}
    </div>
  )
}
