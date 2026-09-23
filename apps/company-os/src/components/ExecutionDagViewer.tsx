import React, { useState } from 'react'
import type { Position } from '../types.js'
import {
  FlowIcon,
  CpuIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  TerminalIcon
} from './Icons.js'

export interface DagToolCall {
  toolName: string
  status: 'running' | 'completed' | 'failed'
  args?: any
  result?: string
  timestamp: number
}

export interface DagNode {
  id: string
  traceId: string
  label: string
  description?: string
  preset?: string
  positionTitle?: string
  positionIcon?: string
  status: 'waiting' | 'running' | 'completed' | 'failed'
  startedAt: number
  completedAt?: number
  toolCalls: DagToolCall[]
  result?: string
  sessionId?: string
  parentId?: string
}

export interface ExecutionDagViewerProps {
  nodes: DagNode[]
  activeTraceId?: string
  positions: Position[]
  onOpenSession?: (sessionId: string) => void
  onClearGraph?: () => void
}

export const ExecutionDagViewer: React.FC<ExecutionDagViewerProps> = ({
  nodes,
  activeTraceId,
  positions,
  onOpenSession,
  onClearGraph
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  const getNodeTitle = (node: DagNode) => {
    if (node.positionTitle) return node.positionTitle
    const matched = positions.find(
      (p) => p.id === node.preset || p.title.toLowerCase().includes(node.preset?.toLowerCase() || '')
    )
    if (matched) return matched.title
    return node.preset || node.label
  }

  const runningCount = nodes.filter((n) => n.status === 'running').length
  const completedCount = nodes.filter((n) => n.status === 'completed').length
  const totalToolCalls = nodes.reduce((acc, n) => acc + (n.toolCalls?.length || 0), 0)

  return (
    <div className="dag-viewer-container">
      {/* Top Bar Stats & Controls */}
      <div className="dag-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
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
              <FlowIcon size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc', letterSpacing: '-0.01em' }}>
                A2A Dağıtık Yürütme Motoru (Execution DAG)
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Gerçek zamanlı alt ajan orkestrasyonu & trace grafiği
              </div>
            </div>
          </div>

          {activeTraceId && (
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#a5b4fc',
                padding: '3px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}
            >
              Trace: {activeTraceId}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
            <span style={{ color: '#94a3b8' }}>
              Düğümler:{' '}
              <strong style={{ color: '#f8fafc' }}>
                {completedCount}/{nodes.length}
              </strong>
            </span>
            {runningCount > 0 && (
              <span
                style={{
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#fbbf24',
                    animation: 'pulse 1s infinite'
                  }}
                />
                {runningCount} Aktif
              </span>
            )}
            <span style={{ color: '#94a3b8' }}>
              Araçlar: <strong style={{ color: '#38bdf8' }}>{totalToolCalls}</strong>
            </span>
          </div>

          {nodes.length > 0 && onClearGraph && (
            <button
              onClick={onClearGraph}
              className="btn-secondary"
              style={{ padding: '5px 12px', fontSize: '11.5px', borderRadius: '6px' }}
            >
              Grafiği Sıfırla
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="dag-canvas-surface">
        {nodes.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              padding: '60px 40px',
              textAlign: 'center',
              maxWidth: '520px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '16px',
              border: '1px dashed rgba(255, 255, 255, 0.1)'
            }}
          >
            <div style={{ width: '48px', height: '48px', margin: '0 auto 16px auto', color: '#64748b' }}>
              <FlowIcon size={48} />
            </div>
            <h3 style={{ fontSize: '16px', color: '#f8fafc', marginBottom: '8px' }}>
              Henüz Canlı Görev Ağacı Yok
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
              Yönetici Kokpiti üzerinden bir direktif verildiğinde ajanlar arası görev dağılımı (A2A
              DAG), alt ajanların açtığı dallar ve çalıştırdığı araçlar burada canlı ve interaktif
              olarak çizilir.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: '1100px',
              position: 'relative'
            }}
          >
            {/* Visual Root Coordinator Node */}
            <div className="dag-root-card">
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
                }}
              >
                <CpuIcon size={20} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                    Yönetici Koordinatör (CEO / Direct Orchestrator)
                  </span>
                  <span className="dag-root-badge">KÖK ORKESTRATÖR</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  {nodes.length} Alt Ajan dalı yönetiliyor • {totalToolCalls} Araç çağrısı izleniyor
                </div>
              </div>
            </div>

            {/* SVG Connecting Cables Canvas */}
            <div
              style={{
                width: '100%',
                height: '70px',
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                overflow: 'visible'
              }}
            >
              <svg
                className="dag-svg-canvas"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  overflow: 'visible'
                }}
              >
                {nodes.map((node, index) => {
                  const total = nodes.length
                  const stepX = 100 / (total + 1)
                  const targetPercent = stepX * (index + 1)
                  const isRunning = node.status === 'running'
                  const isCompleted = node.status === 'completed'

                  // Coordinates in percentages for SVG responsive path
                  return (
                    <path
                      key={node.id}
                      d={`M 50% 0 C 50% 35, ${targetPercent}% 35, ${targetPercent}% 70`}
                      className={`dag-wire-path ${isRunning ? 'running' : isCompleted ? 'completed' : ''}`}
                    />
                  )
                })}
              </svg>
            </div>

            {/* Child Nodes Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                gap: '24px',
                width: '100%',
                marginTop: '10px'
              }}
            >
              {nodes.map((node, index) => {
                const title = getNodeTitle(node)
                const isSelected = selectedNodeId === node.id
                const isRunning = node.status === 'running'
                const isCompleted = node.status === 'completed'
                const isFailed = node.status === 'failed'

                const durationSec = node.completedAt
                  ? Math.round((node.completedAt - node.startedAt) / 100) / 10
                  : Math.round((Date.now() - node.startedAt) / 100) / 10

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`dag-subagent-card ${isRunning ? 'running' : ''} ${isCompleted ? 'completed' : ''} ${isFailed ? 'failed' : ''} ${isSelected ? 'selected' : ''}`}
                  >
                    {/* Index Step Pill */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '-10px',
                        left: '16px',
                        background: isRunning ? '#f59e0b' : '#3b82f6',
                        color: '#ffffff',
                        fontSize: '9.5px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        letterSpacing: '0.06em',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      ADIM #{index + 1}
                    </div>

                    {/* Node Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                        marginTop: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#38bdf8'
                          }}
                        >
                          <CpuIcon size={17} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                            {title}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {node.preset || 'Genel Alt Ajan'}
                          </div>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div>
                        {isRunning && (
                          <span
                            style={{
                              fontSize: '11px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#fbbf24',
                                animation: 'pulse 1s infinite'
                              }}
                            />
                            Çalışıyor
                          </span>
                        )}
                        {isCompleted && (
                          <span
                            style={{
                              fontSize: '11px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <CheckCircleIcon size={12} />
                            Tamamlandı
                          </span>
                        )}
                        {isFailed && (
                          <span
                            style={{
                              fontSize: '11px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontWeight: 600
                            }}
                          >
                            ✗ Hata
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Task Title */}
                    <div
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: '#e2e8f0',
                        marginBottom: '8px',
                        lineHeight: 1.4
                      }}
                    >
                      {node.label}
                    </div>

                    {/* Tool Calls Summary */}
                    {node.toolCalls && node.toolCalls.length > 0 && (
                      <div
                        style={{
                          marginTop: '10px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px'
                        }}
                      >
                        {node.toolCalls.map((t, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '10.5px',
                              fontFamily: 'var(--font-mono)',
                              background:
                                t.status === 'running'
                                  ? 'rgba(245, 158, 11, 0.2)'
                                  : 'rgba(56, 189, 248, 0.1)',
                              color: t.status === 'running' ? '#fbbf24' : '#7dd3fc',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              border: '1px solid rgba(56, 189, 248, 0.2)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <TerminalIcon size={10} />
                            {t.toolName}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer Info */}
                    <div
                      style={{
                        marginTop: '14px',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                        color: '#64748b'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ClockIcon size={12} />
                        {durationSec}s
                      </span>
                      {node.sessionId && (
                        <span
                          style={{
                            color: '#818cf8',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          Detay & Replay <ArrowRightIcon size={11} />
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Drawer / Inspector Modal for selected node */}
      {selectedNode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '460px',
            background: 'rgba(11, 17, 30, 0.96)',
            backdropFilter: 'blur(24px)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)'
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8'
                }}
              >
                <CpuIcon size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', color: '#ffffff', margin: 0, fontWeight: 700 }}>
                  {getNodeTitle(selectedNode)}
                </h4>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Görev İnceleme & A2A Trace
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedNodeId(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div
            style={{
              flex: 1,
              padding: '24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            {/* Task Info */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}
              >
                Görev Başlığı
              </div>
              <div style={{ fontSize: '13.5px', color: '#f8fafc', fontWeight: 600 }}>
                {selectedNode.label}
              </div>
            </div>

            {selectedNode.description && (
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    marginBottom: '6px'
                  }}
                >
                  Görev Açıklaması / Talimat
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#cbd5e1',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '12px',
                    borderRadius: '8px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  {selectedNode.description}
                </div>
              </div>
            )}

            {/* Tool Calls Section */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  marginBottom: '8px'
                }}
              >
                Kullanılan Araçlar ({selectedNode.toolCalls?.length || 0})
              </div>
              {selectedNode.toolCalls && selectedNode.toolCalls.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedNode.toolCalls.map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '8px',
                        padding: '10px 12px'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: '#38bdf8',
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <TerminalIcon size={11} /> {t.toolName}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {t.status === 'completed' ? '✓ Başarılı' : '...'}
                        </span>
                      </div>
                      {t.args && (
                        <div
                          style={{
                            fontSize: '10.5px',
                            fontFamily: 'var(--font-mono)',
                            color: '#94a3b8',
                            marginTop: '4px'
                          }}
                        >
                          {JSON.stringify(t.args)}
                        </div>
                      )}
                      {t.result && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#e2e8f0',
                            marginTop: '6px',
                            paddingTop: '6px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            maxHeight: '120px',
                            overflowY: 'auto'
                          }}
                        >
                          {t.result.slice(0, 300)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  Bu alt ajan doğrudan LLM akıl yürütmesi yaptı (harici araç çağırmadı).
                </div>
              )}
            </div>

            {/* Result Section */}
            {selectedNode.result && (
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    marginBottom: '6px'
                  }}
                >
                  Üretilen Rapor / Sonuç
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#e2e8f0',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    padding: '14px',
                    borderRadius: '8px',
                    lineHeight: 1.6,
                    maxHeight: '260px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {selectedNode.result}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer with Replay Button */}
          {selectedNode.sessionId && onOpenSession && (
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(11, 17, 30, 0.95)'
              }}
            >
              <button
                className="btn-primary"
                onClick={() => onOpenSession(selectedNode.sessionId!)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 16px'
                }}
              >
                <span>Bu Alt Ajanın Oturumunu Aç (Replay & Sohbet)</span>
                <ArrowRightIcon size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

