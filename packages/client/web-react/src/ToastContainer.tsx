import React from 'react'

export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss?: (id: string) => void
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="toast-icon">
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
