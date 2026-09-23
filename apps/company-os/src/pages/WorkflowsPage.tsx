import React from 'react'
import type { Position } from '../types.js'

interface WorkflowsPageProps {
  positions: Position[]
  onRunWorkflow: (workflowName: string, targetIds: string[]) => void
  isExecuting: boolean
}

export const WorkflowsPage: React.FC<WorkflowsPageProps> = ({
  positions,
  onRunWorkflow,
  isExecuting
}) => {
  const level2Positions = positions.filter(p => p.level === 2)
  const cfo = positions.find(p => p.id === 'novatrend-cfo')
  const kalite = positions.find(p => p.id === 'novatrend-kalite')
  const tedarik = positions.find(p => p.id === 'novatrend-tedarik')

  const workflows = [
    {
      id: 'daily_sync',
      title: 'Şirket İcra ve Günlük Durum Konsolidasyonu',
      desc: 'CEO genel direktifi yayınlar -> CFO, Kalite ve Tedarik eşzamanlı denetler -> Çıktılar CEO masasına konsolide edilir.',
      stages: ['Genel Direktif', 'Departman Denetimi', 'Çapraz Doğrulama', 'İcra Kurulu Özeti'],
      lead: '👑 CEO & İcra Kurulu',
      targetIds: level2Positions.map(p => p.id)
    },
    {
      id: 'budget_escalation',
      title: 'Bütçe Aşımı ve Fiyat Sapması Alarm Hattı',
      desc: 'CFO bütçe aşımını tespit eder -> Tedarikçi zam talepleriyle eşleştirir -> Sapma uyarısı oluşturur.',
      stages: ['Q3 CSV Okuma', 'Tedarikçi Karşılaştırma', 'Sapma Hesabı', 'CFO Uyarı Raporu'],
      lead: '📊 Kıdemli CFO',
      targetIds: cfo ? [cfo.id] : level2Positions.map(p => p.id)
    },
    {
      id: 'quality_sla_pipeline',
      title: 'Müşteri İade ve Tedarikçi SLA Ceza Süreci',
      desc: 'Müşteri iade oranları eşiği aştığında tedarikçi sözleşmesindeki cezai şartlar işletilir.',
      stages: ['İade Analizi', 'Sözleşme SLA Kontrolü', 'Hukuki Ceza Raporu'],
      lead: '🛡️ Kalite Güvence',
      targetIds: kalite ? [kalite.id] : level2Positions.map(p => p.id)
    },
    {
      id: 'supply_procurement',
      title: 'Kritik Stok ve Acil Satın Alma Siparişi',
      desc: 'Tükenme riski olan ürünleri tespit eder -> Tedarikçi sipariş taslağı hazırlar.',
      stages: ['Stok Seviyesi', 'Tükenme Gün Hesabı', 'Satın Alma Sipariş Emri'],
      lead: '📦 Tedarik Zinciri',
      targetIds: tedarik ? [tedarik.id] : level2Positions.map(p => p.id)
    }
  ]

  return (
    <div className="workflows-view-container">
      <div className="workflows-header">
        <h2 className="workflows-title">Çoklu Ajan İş Akışları (Workflows & Pipelines)</h2>
        <p className="workflows-sub">
          Departmanların koordineli çalışması. Bir tıkla ilgili ajanlara direktif dağıtır ve raporları toplar.
        </p>
      </div>

      <div className="workflows-list">
        {workflows.map(wf => (
          <div key={wf.id} className="workflow-card">
            <div className="wf-card-top">
              <div className="wf-title-wrap">
                <span className="wf-lead-pill">{wf.lead}</span>
                <h3 className="wf-title">{wf.title}</h3>
              </div>
              <button
                type="button"
                className="btn-run-wf"
                disabled={isExecuting}
                onClick={() => onRunWorkflow(wf.title, wf.targetIds)}
              >
                {isExecuting ? 'Yürütülüyor...' : '⚡ Akışı Başlat'}
              </button>
            </div>

            <p className="wf-desc">{wf.desc}</p>

            <div className="wf-stages-chain">
              {wf.stages.map((stage, idx) => (
                <React.Fragment key={idx}>
                  <div className="wf-stage-node">
                    <span className="stage-num">{idx + 1}</span>
                    <span className="stage-name">{stage}</span>
                  </div>
                  {idx < wf.stages.length - 1 && (
                    <div className="wf-stage-connector">➔</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
