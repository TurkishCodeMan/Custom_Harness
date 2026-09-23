import React from 'react'
import type { Position } from '../types.js'
import {
  SparklesIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuIcon
} from './Icons.js'

interface PositionCardProps {
  position: Position
  onClick: () => void
  onDirectDirective: (pos: Position) => void
  onViewReport: (reportPath: string) => void
}

export const PositionCard: React.FC<PositionCardProps> = ({
  position,
  onClick,
  onDirectDirective,
  onViewReport
}) => {
  const getStatusClass = () => {
    switch (position.status) {
      case 'executing':
      case 'thinking':
      case 'routing':
        return 'active-running'
      case 'completed':
        return 'active-completed'
      default:
        return ''
    }
  }

  const getStatusLabel = () => {
    switch (position.status) {
      case 'routing': return 'Yönlendiriliyor'
      case 'thinking': return 'Düşünüyor...'
      case 'executing': return 'İşlemde...'
      case 'completed': return 'Tamamlandı'
      case 'error': return 'Hata'
      default: return 'Hazır / Boşta'
    }
  }

  const isLevel1 = position.level === 1
  const isLevel2 = position.level === 2

  return (
    <div className={`position-card ${getStatusClass()}`} onClick={onClick}>
      <div className="card-header">
        <div
          className="card-avatar"
          style={{
            background: isLevel1
              ? 'rgba(245, 158, 11, 0.15)'
              : isLevel2
              ? 'rgba(99, 102, 241, 0.15)'
              : 'rgba(6, 182, 212, 0.15)',
            border: isLevel1
              ? '1px solid rgba(245, 158, 11, 0.35)'
              : isLevel2
              ? '1px solid rgba(99, 102, 241, 0.35)'
              : '1px solid rgba(6, 182, 212, 0.35)',
            color: isLevel1 ? '#fbbf24' : isLevel2 ? '#a5b4fc' : '#67e8f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px'
          }}
        >
          {position.icon || <CpuIcon size={20} />}
        </div>
        <div className={`level-badge level-${position.level}`}>
          L{position.level} • {isLevel1 ? 'STRATEJİK' : isLevel2 ? 'TAKTIKSEL' : 'OPERASYONEL'}
        </div>
      </div>

      <div className="card-body">
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
          {position.title}
        </h3>
        <p className="card-role" style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
          {position.role}
        </p>

        {position.specialization && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#38bdf8',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(56, 189, 248, 0.08)',
              padding: '2px 8px',
              borderRadius: '4px',
              display: 'inline-block'
            }}
          >
            {position.specialization}
          </div>
        )}

        <div className="card-tools">
          {position.tools.map((tool) => (
            <span key={tool} className="tool-tag">{tool}</span>
          ))}
        </div>

        {position.skills && position.skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {position.skills.map((skill) => (
              <span
                key={skill}
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#fde68a',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <SparklesIcon size={9} /> {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card-status-bar">
        <div className={`card-status-pill status-${position.status}`}>
          <div className="status-dot" />
          <span>{getStatusLabel()}</span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
          {position.lastReport && (
            <button
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={() => onViewReport(position.lastReport!.path)}
              title="Son Denetim Raporunu Görüntüle"
            >
              <ClockIcon size={11} /> Rapor
            </button>
          )}

          <button
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              color: '#a5b4fc',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onClick={() => onDirectDirective(position)}
            title="Bu Koltuğa Özel Direktif Ver"
          >
            <SparklesIcon size={11} /> Direktif
          </button>
        </div>
      </div>

      {position.currentAction && position.status !== 'idle' && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#e2e8f0',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{ color: '#fbbf24' }}>▶</span>
          <span>{position.currentAction}</span>
        </div>
      )}
    </div>
  )
}

