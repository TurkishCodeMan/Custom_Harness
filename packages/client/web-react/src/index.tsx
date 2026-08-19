import React from 'react'
import { createRoot } from 'react-dom/client'
import { AgentProvider } from './AgentContext.js'
import { AppRoot } from './AppRoot.js'

export function mountClient(containerElement: HTMLElement) {
  const root = createRoot(containerElement)
  root.render(
    <React.StrictMode>
      <AgentProvider>
        <AppRoot />
      </AgentProvider>
    </React.StrictMode>
  )
  return root
}

// Auto mount if in browser environment with #root
if (typeof document !== 'undefined') {
  const rootEl = document.getElementById('root')
  if (rootEl) {
    mountClient(rootEl)
  }
}
