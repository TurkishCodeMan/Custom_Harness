import React, { useEffect, useState } from 'react'
import { fetchFileContent } from '../api.js'

interface ReportViewerModalProps {
  reportPath: string | null
  onClose: () => void
}

export const ReportViewerModal: React.FC<ReportViewerModalProps> = ({
  reportPath,
  onClose
}) => {
  const [content, setContent] = useState<string>('Rapor yükleniyor...')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!reportPath) return
    let active = true
    setContent('Rapor yükleniyor...')
    fetchFileContent(reportPath).then(text => {
      if (active) setContent(text)
    })
    return () => { active = false }
  }, [reportPath])

  if (!reportPath) return null

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fileName = reportPath.split('/').pop() || 'Rapor'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '880px', width: '90%', height: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📄</span>
              <h2 style={{ fontSize: '18px', color: '#ffffff' }}>{fileName}</h2>
            </div>
            <div className="mono" style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {reportPath}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="btn-secondary" onClick={copyToClipboard} style={{ padding: '6px 12px', fontSize: '12px' }}>
              {copied ? '✅ Kopyalandı' : '📋 Kopyala'}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '24px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          color: '#e2e8f0',
          lineHeight: 1.6,
          fontSize: '14px',
          whiteSpace: 'pre-wrap',
          fontFamily: content.startsWith('#') ? 'inherit' : 'monospace'
        }}>
          {content}
        </div>
      </div>
    </div>
  )
}
