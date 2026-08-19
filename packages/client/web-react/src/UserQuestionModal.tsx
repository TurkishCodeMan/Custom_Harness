import React, { useState } from 'react'

export interface UserQuestionModalProps {
  questionRequest: {
    id: string
    questions: Array<{
      id: string
      question: string
      header?: string
      detail?: string
      options?: Array<{ label: string; description?: string }>
      multiSelect?: boolean
    }>
  } | null
  onRespond: (id: string, answers: Array<{ id: string; selected: string[]; custom?: string }>) => void
}

export function UserQuestionModal({ questionRequest, onRespond }: UserQuestionModalProps) {
  if (!questionRequest) return null

  const { id: reqId, questions } = questionRequest
  const [answers, setAnswers] = useState<Record<string, { selected: string[]; custom: string }>>(() => {
    const init: Record<string, { selected: string[]; custom: string }> = {}
    for (const q of questions) {
      init[q.id] = {
        selected: q.options && q.options.length > 0 ? [q.options[0].label] : [],
        custom: ''
      }
    }
    return init
  })

  const toggleOption = (qId: string, label: string, multiSelect?: boolean) => {
    setAnswers((prev) => {
      const current = prev[qId]?.selected || []
      let updated: string[]
      if (multiSelect) {
        updated = current.includes(label) ? current.filter((l) => l !== label) : [...current, label]
      } else {
        updated = [label]
      }
      return {
        ...prev,
        [qId]: { ...prev[qId], selected: updated }
      }
    })
  }

  const handleCustomChange = (qId: string, val: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], custom: val }
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formatted = Object.entries(answers).map(([qId, ans]) => ({
      id: qId,
      selected: ans.selected,
      ...(ans.custom.trim() ? { custom: ans.custom.trim() } : {})
    }))
    onRespond(reqId, formatted)
  }

  return (
    <div className="modal-backdrop" style={{ display: 'flex', zIndex: 9999 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '640px',
          width: '90%',
          background: '#161922',
          border: '1px solid #2d3345',
          borderRadius: '12px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
          padding: '24px',
          color: '#e2e8f0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>💬</span>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#60a5fa' }}>
            Ajanınızın Bir Sorusu Var
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          {questions.map((q, idx) => (
            <div
              key={q.id}
              style={{
                marginBottom: '20px',
                padding: '16px',
                background: '#1e2230',
                borderRadius: '8px',
                border: '1px solid #2a3042'
              }}
            >
              {q.header && (
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}>
                  {q.header}
                </div>
              )}
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#f8fafc' }}>
                {idx + 1}. {q.question}
              </h3>

              {q.options && q.options.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {q.options.map((opt) => {
                    const isSelected = answers[q.id]?.selected.includes(opt.label)
                    const isRecommended = opt.label.includes('(Recommended)') || opt.label.includes('(Önerilen)')
                    return (
                      <label
                        key={opt.label}
                        onClick={() => toggleOption(q.id, opt.label, q.multiSelect)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 14px',
                          borderRadius: '6px',
                          background: isSelected ? '#1e3a8a' : '#141721',
                          border: isSelected ? '1px solid #3b82f6' : '1px solid #272d3f',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type={q.multiSelect ? 'checkbox' : 'radio'}
                          name={`q_${q.id}`}
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ marginTop: '3px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? '#ffffff' : '#cbd5e1' }}>
                            {opt.label}
                            {isRecommended && (
                              <span
                                style={{
                                  marginLeft: '8px',
                                  padding: '2px 6px',
                                  fontSize: '0.7rem',
                                  background: '#22c55e',
                                  color: '#000',
                                  borderRadius: '4px',
                                  fontWeight: 600
                                }}
                              >
                                ÖNERİLEN
                              </span>
                            )}
                          </div>
                          {opt.description && (
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                              {opt.description}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              <div>
                <input
                  type="text"
                  placeholder="Farklı bir yanıt veya ek açıklama yazın (opsiyonel)..."
                  value={answers[q.id]?.custom || ''}
                  onChange={(e) => handleCustomChange(q.id, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                background: '#3b82f6',
                color: '#fff',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
              }}
            >
              Cevapla ve Devam Et ↵
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
