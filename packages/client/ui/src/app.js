// ==========================================================================
// Custom Harness Web UI Client Application Logic
// ==========================================================================

// Global Application State
let ws = null
let currentSessionId = null
let currentWorkspace = ''
let isStreaming = false
let activeSettings = null

// DOM Element References
const chatMessages = document.getElementById('chat-messages')
const welcomeView = document.getElementById('welcome-view')
const promptInput = document.getElementById('prompt-input')
const chatForm = document.getElementById('chat-form')
const btnSend = document.getElementById('btn-send')
const btnStop = document.getElementById('btn-stop')
const sessionList = document.getElementById('session-list')
const sessionCount = document.getElementById('session-count')
const skillsList = document.getElementById('skills-list')
const skillsCount = document.getElementById('skills-count')
const btnNewChat = document.getElementById('btn-new-chat')
const currentWsName = document.getElementById('current-workspace-name')
const topbarWsChip = document.getElementById('topbar-workspace-chip')
const topbarWsName = document.getElementById('topbar-ws-name')
const selectModel = document.getElementById('select-model')
const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')
const toastContainer = document.getElementById('toast-container')

// Context Meter DOM Elements
const btnContextMeter = document.getElementById('btn-context-meter')
const contextPopup = document.getElementById('context-popup')
const contextRingFill = document.getElementById('context-ring-fill')
const contextPercentLabel = document.getElementById('context-percent-label')
const cpPercent = document.getElementById('cp-percent')
const cpFigures = document.getElementById('cp-figures')
const cpBarSystem = document.getElementById('cp-bar-system')
const cpBarTools = document.getElementById('cp-bar-tools')
const cpBarMessages = document.getElementById('cp-bar-messages')
const cpLegSystem = document.getElementById('cp-leg-system')
const cpLegTools = document.getElementById('cp-leg-tools')
const cpLegMessages = document.getElementById('cp-leg-messages')
const cpModelName = document.getElementById('cp-model-name')
const cpCapTokens = document.getElementById('cp-cap-tokens')

// Workspace Modal References
const wsPickerModal = document.getElementById('workspace-picker-modal')
const btnCloseWsModal = document.getElementById('btn-close-ws-modal')
const wsInputPath = document.getElementById('ws-input-path')
const btnWsNavigate = document.getElementById('btn-ws-navigate')
const btnWsParent = document.getElementById('btn-ws-parent')
const wsDirList = document.getElementById('ws-dir-list')
const btnApplyWorkspace = document.getElementById('btn-apply-workspace')
let browsingPath = ''
let browsingParent = ''

// Topbar Preset Chip
const topbarPresetChip = document.getElementById('topbar-preset-chip')
const topbarPresetIcon = document.getElementById('topbar-preset-icon')
const topbarPresetName = document.getElementById('topbar-preset-name')

// Settings Modal References
const settingsModal = document.getElementById('settings-modal')
const btnOpenSettings = document.getElementById('btn-open-settings')
const btnCloseSettings = document.getElementById('btn-close-settings')
const btnSaveSettings = document.getElementById('btn-save-settings')
const btnDiscoverModels = document.getElementById('btn-discover-models')
const settingsProvider = document.getElementById('settings-provider')
const settingsBaseUrl = document.getElementById('settings-base-url')
const settingsApiKey = document.getElementById('settings-api-key')
const settingsModelId = document.getElementById('settings-model-id')
const settingsWorkspace = document.getElementById('settings-workspace')
const settingsDefaultPreset = document.getElementById('settings-default-preset')
const settingsContextWindow = document.getElementById('settings-context-window')
const btnChangeWs = document.getElementById('btn-change-workspace')

// Plugins Tab References
const pluginSearchInput = document.getElementById('plugin-search-input')
const pluginsInventoryList = document.getElementById('plugins-inventory-list')
const pluginsCountBadge = document.getElementById('plugins-count-badge')

// Presets Tab References
const presetsGrid = document.getElementById('presets-grid')
const presetsBuilderCard = document.getElementById('presets-builder-card')
const presetEditingId = document.getElementById('preset-editing-id')
const builderTitle = document.getElementById('builder-title')
const presetNewName = document.getElementById('preset-new-name')
const presetNewIcon = document.getElementById('preset-new-icon')
const presetNewDesc = document.getElementById('preset-new-desc')
const presetNewPrompt = document.getElementById('preset-new-prompt')
const btnSaveCustomPreset = document.getElementById('btn-save-custom-preset')
const btnSaveCustomPresetText = document.getElementById('btn-save-custom-preset-text')
const btnCancelPresetEdit = document.getElementById('btn-cancel-preset-edit')

let cachedPlugins = []
let cachedPresets = []
let currentActivePreset = null

// Initialize Application
async function init() {
  await loadSettings()
  await loadWorkspace()
  await loadSessions()
  await loadSkills()
  await loadPresets()
  await loadPlugins()
  await fetchContextMeasurement()
  connectWebSocket()
  setupEventListeners()
}

// ==========================================================================
// WebSocket Communication
// ==========================================================================
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

  ws.onopen = () => {
    statusDot.className = 'status-pulse online'
    statusText.textContent = 'Bağlandı'
  }

  ws.onclose = () => {
    statusDot.className = 'status-pulse offline'
    statusText.textContent = 'Bağlantı Kesildi'
    setTimeout(connectWebSocket, 2000)
  }

  ws.onerror = (e) => {
    console.error('[WS Error]:', e)
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      handleServerMessage(data)
    } catch (e) {
      console.error('[WS Parse Error]:', e)
    }
  }
}

// ==========================================================================
// REST API Data Loaders
// ==========================================================================
async function loadSettings() {
  try {
    const res = await fetch('/api/settings')
    activeSettings = await res.json()
    populateModelDropdown()
  } catch (e) {
    showToast('Ayarlar yüklenemedi: ' + e.message, 'error')
  }
}

async function loadWorkspace() {
  try {
    const res = await fetch('/api/workspace')
    const data = await res.json()
    currentWorkspace = data.cwd
    const parts = currentWorkspace.split('/')
    const folder = parts[parts.length - 1] || currentWorkspace
    currentWsName.textContent = folder
    currentWsName.title = currentWorkspace
  } catch (e) {
    console.error('Workspace yüklenemedi:', e)
  }
}

async function loadSessions() {
  try {
    const res = await fetch('/api/sessions')
    const sessions = await res.json()
    sessionList.innerHTML = ''
    sessionCount.textContent = sessions.length

    if (sessions.length === 0) {
      sessionList.innerHTML = '<div style="font-size:12px;color:var(--text-dimmed);padding:8px 6px;">Henüz sohbet yok</div>'
      return
    }

    sessions.forEach(s => {
      const item = document.createElement('div')
      item.className = `session-item ${s.id === currentSessionId ? 'active' : ''}`
      item.innerHTML = `
        <div class="session-item-content">
          <span class="session-title">${escapeHtml(s.title || 'Yeni Sohbet')}</span>
          <span class="session-time">${formatTimeAgo(s.updatedAt)}</span>
        </div>
        <button class="btn-item-delete" title="Sohbeti Sil">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `
      item.onclick = () => switchSession(s.id)
      item.querySelector('.btn-item-delete').onclick = (e) => {
        e.stopPropagation()
        deleteSession(s.id)
      }
      sessionList.appendChild(item)
    })
  } catch (e) {
    console.error('Oturumlar yüklenemedi:', e)
  }
}

async function loadSkills() {
  try {
    const res = await fetch('/api/skills')
    const skills = await res.json()
    skillsList.innerHTML = ''
    skillsCount.textContent = skills.length

    if (skills.length === 0) {
      skillsList.innerHTML = '<div style="font-size:12px;color:var(--text-dimmed);padding:8px 6px;">Tanımlı beceri yok</div>'
      return
    }

    skills.forEach(skill => {
      const item = document.createElement('div')
      item.className = 'skill-item'
      item.innerHTML = `
        <span class="skill-icon">🧠</span>
        <span class="skill-name">${escapeHtml(skill.name)}</span>
      `
      item.title = skill.description || 'Beceri talimatlarını uygula'
      item.onclick = () => {
        promptInput.value = `Beceri: "${skill.name}" kullanarak şu görevi yerine getir:\n`
        promptInput.focus()
      }
      skillsList.appendChild(item)
    })
  } catch (e) {
    console.error('Skills yüklenemedi:', e)
  }
}

// --- Plugins Manager ---
async function loadPlugins() {
  try {
    const res = await fetch('/api/plugins')
    cachedPlugins = await res.json()
    renderPluginsList(cachedPlugins)
  } catch (e) {
    console.error('Plugins yüklenemedi:', e)
  }
}

function renderPluginsList(plugins) {
  if (!pluginsInventoryList) return
  pluginsInventoryList.innerHTML = ''
  if (pluginsCountBadge) pluginsCountBadge.textContent = `${plugins.length} Eklenti`

  if (plugins.length === 0) {
    pluginsInventoryList.innerHTML = '<div style="font-size:12px;color:var(--text-dimmed);padding:12px;">Eklenti bulunamadı</div>'
    return
  }

  plugins.forEach(plugin => {
    const card = document.createElement('div')
    card.className = `plugin-card ${plugin.enabled ? 'active' : 'disabled'}`
    card.innerHTML = `
      <div class="plugin-info">
        <div class="plugin-title-row">
          <span class="plugin-name">${escapeHtml(plugin.name)}</span>
          <span class="plugin-category-badge">${escapeHtml(plugin.category || 'tool')}</span>
        </div>
        <div class="plugin-desc">${escapeHtml(plugin.description || '')}</div>
        <div class="plugin-meta">${escapeHtml(plugin.module)} · v${escapeHtml(plugin.version || '0.1.0')}</div>
      </div>
      <div class="plugin-action-group">
        <label class="switch" title="${plugin.enabled ? 'Eklentiyi Kapat' : 'Eklentiyi Aç'}">
          <input type="checkbox" class="plugin-toggle-checkbox" data-plugin-id="${plugin.id}" ${plugin.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    `

    const checkbox = card.querySelector('.plugin-toggle-checkbox')
    checkbox.onchange = async () => {
      const isEnabled = checkbox.checked
      try {
        const res = await fetch(`/api/plugins/${plugin.id}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: isEnabled })
        })
        const updated = await res.json()
        plugin.enabled = updated.enabled
        card.className = `plugin-card ${plugin.enabled ? 'active' : 'disabled'}`
        showToast(`🔌 ${plugin.name} ${plugin.enabled ? 'etkinleştirildi' : 'devre dışı bırakıldı'}`, 'info')
        await fetchContextMeasurement()
      } catch (err) {
        checkbox.checked = !isEnabled
        showToast('Eklenti durumu değiştirilemedi: ' + err.message, 'error')
      }
    }

    pluginsInventoryList.appendChild(card)
  })
}

// --- Presets Manager ---
async function loadPresets() {
  try {
    const res = await fetch('/api/presets')
    const data = await res.json()
    cachedPresets = data.presets || []
    currentActivePreset = data.activePreset

    if (currentActivePreset && topbarPresetName) {
      topbarPresetName.textContent = currentActivePreset.name
      if (topbarPresetIcon) topbarPresetIcon.textContent = currentActivePreset.icon || '🚀'
    }

    // Populate Settings Select
    if (settingsDefaultPreset) {
      settingsDefaultPreset.innerHTML = ''
      cachedPresets.forEach(preset => {
        const opt = document.createElement('option')
        opt.value = preset.id
        opt.textContent = `${preset.icon || '🤖'} ${preset.name}`
        if (currentActivePreset && currentActivePreset.id === preset.id) {
          opt.selected = true
        }
        settingsDefaultPreset.appendChild(opt)
      })
    }

    renderPresetsGrid(cachedPresets)
  } catch (e) {
    console.error('Presets yüklenemedi:', e)
  }
}

function renderPresetsGrid(presets) {
  if (!presetsGrid) return
  presetsGrid.innerHTML = ''

  presets.forEach(preset => {
    const isActive = currentActivePreset && currentActivePreset.id === preset.id
    const isBuiltIn = ['full-stack', 'fast-coder', 'code-reviewer'].includes(preset.id)
    const card = document.createElement('div')
    card.className = `preset-card ${isActive ? 'active' : ''}`

    card.innerHTML = `
      <div class="preset-header">
        <div class="preset-icon-name">
          <span>${preset.icon || '🤖'}</span>
          <span>${escapeHtml(preset.name)}</span>
        </div>
        ${isActive ? '<span class="preset-active-badge">Aktif</span>' : ''}
      </div>
      <div class="preset-desc">${escapeHtml(preset.description || '')}</div>
      <div class="preset-footer-row">
        <div class="preset-actions-group">
          ${!isActive ? `<button type="button" class="btn-preset-action btn-preset-select" title="Aktif Profil Yap">✓ Seç</button>` : ''}
          <button type="button" class="btn-preset-action btn-preset-edit" title="Profili Düzenle">✏️ Düzenle</button>
          <button type="button" class="btn-preset-action btn-preset-delete" title="${isBuiltIn ? 'Varsayılana Sıfırla' : 'Profili Sil'}">🗑️</button>
        </div>
      </div>
    `

    // Select Preset Action
    const selectAction = async (e) => {
      if (e) e.stopPropagation()
      try {
        const res = await fetch('/api/presets/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetId: preset.id })
        })
        const data = await res.json()
        if (data.success) {
          currentActivePreset = data.activePreset
          if (topbarPresetName) topbarPresetName.textContent = currentActivePreset.name
          if (topbarPresetIcon) topbarPresetIcon.textContent = currentActivePreset.icon || '🚀'
          if (settingsDefaultPreset) settingsDefaultPreset.value = currentActivePreset.id
          renderPresetsGrid(cachedPresets)
          showToast(`👤 Ajan Profili: ${currentActivePreset.name} seçildi!`, 'success')
        }
      } catch (err) {
        showToast('Profil seçilemedi: ' + err.message, 'error')
      }
    }

    const btnSelect = card.querySelector('.btn-preset-select')
    if (btnSelect) btnSelect.onclick = selectAction

    // Card click selects if clicking header or desc
    card.onclick = (e) => {
      if (e.target.closest('.preset-actions-group')) return
      selectAction(e)
    }

    // Edit Preset Action
    const btnEdit = card.querySelector('.btn-preset-edit')
    btnEdit.onclick = (e) => {
      e.stopPropagation()
      if (presetEditingId) presetEditingId.value = preset.id
      if (presetNewName) presetNewName.value = preset.name
      if (presetNewIcon) presetNewIcon.value = preset.icon || '🤖'
      if (presetNewDesc) presetNewDesc.value = preset.description || ''
      if (presetNewPrompt) presetNewPrompt.value = preset.systemPrompt || ''

      if (builderTitle) builderTitle.textContent = `✏️ Profili Düzenle: ${preset.name}`
      if (btnSaveCustomPresetText) btnSaveCustomPresetText.textContent = 'Değişiklikleri Kaydet'
      if (btnCancelPresetEdit) btnCancelPresetEdit.classList.remove('hidden')
      if (presetsBuilderCard) {
        presetsBuilderCard.classList.add('editing')
        presetsBuilderCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
      if (presetNewName) presetNewName.focus()
    }

    // Delete / Reset Preset Action
    const btnDelete = card.querySelector('.btn-preset-delete')
    btnDelete.onclick = async (e) => {
      e.stopPropagation()
      const confirmMsg = isBuiltIn 
        ? `"${preset.name}" varsayılan profilini orijinal ayarlarına sıfırlamak istiyor musunuz?` 
        : `"${preset.name}" profilini silmek istediğinize emin misiniz?`
      
      if (!confirm(confirmMsg)) return

      try {
        const res = await fetch(`/api/presets/${preset.id}`, { method: 'DELETE' })
        const data = await res.json()
        if (data.success) {
          showToast(isBuiltIn ? `🔄 "${preset.name}" varsayılana sıfırlandı` : `🗑️ "${preset.name}" profili silindi`, 'info')
          if (presetEditingId && presetEditingId.value === preset.id) {
            cancelPresetEditing()
          }
          await loadPresets()
        } else {
          showToast('İşlem tamamlanamadı.', 'error')
        }
      } catch (err) {
        showToast('Hata: ' + err.message, 'error')
      }
    }

    presetsGrid.appendChild(card)
  })
}

function cancelPresetEditing() {
  if (presetEditingId) presetEditingId.value = ''
  if (presetNewName) presetNewName.value = ''
  if (presetNewIcon) presetNewIcon.value = ''
  if (presetNewDesc) presetNewDesc.value = ''
  if (presetNewPrompt) presetNewPrompt.value = ''

  if (builderTitle) builderTitle.textContent = '+ Yeni Özel Ajan Profili Ekle'
  if (btnSaveCustomPresetText) btnSaveCustomPresetText.textContent = 'Profili Kaydet'
  if (btnCancelPresetEdit) btnCancelPresetEdit.classList.add('hidden')
  if (presetsBuilderCard) presetsBuilderCard.classList.remove('editing')
}

function populateModelDropdown() {
  if (!activeSettings) return
  selectModel.innerHTML = ''

  Object.values(activeSettings.providers).forEach(provider => {
    provider.models.forEach(model => {
      const opt = document.createElement('option')
      opt.value = `${provider.id}:${model.id}`
      opt.textContent = `${model.name || model.id} (${provider.name})`
      if (provider.id === activeSettings.defaultProvider && model.id === activeSettings.defaultModel) {
        opt.selected = true
      }
      selectModel.appendChild(opt)
    })
  })
}

// ==========================================================================
// Session Management
// ==========================================================================
async function switchSession(sessionId) {
  currentSessionId = sessionId
  await loadSessions()

  try {
    const res = await fetch(`/api/sessions/${sessionId}`)
    const session = await res.json()
    renderSessionMessages(session.messages || [])
    await fetchContextMeasurement(sessionId)
  } catch (e) {
    showToast('Oturum açılamadı: ' + e.message, 'error')
  }
}

async function deleteSession(sessionId) {
  try {
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    showToast('Sohbet silindi', 'info')
    if (currentSessionId === sessionId) {
      newChat()
    } else {
      loadSessions()
    }
  } catch (e) {
    showToast('Sohbet silinemedi: ' + e.message, 'error')
  }
}

function newChat() {
  currentSessionId = null
  chatMessages.innerHTML = ''
  chatMessages.appendChild(welcomeView)
  welcomeView.classList.remove('hidden')
  loadSessions()
  fetchContextMeasurement(null)
  promptInput.focus()
}

// ==========================================================================
// Message Rendering & Markdown Formatter
// ==========================================================================
let currentAssistantRow = null
let currentThinkingCard = null
let currentThinkingBody = null
let currentMessageBubble = null
let rawAssistantContent = ''

function renderSessionMessages(messages) {
  chatMessages.innerHTML = ''
  if (!messages || messages.length === 0) {
    chatMessages.appendChild(welcomeView)
    welcomeView.classList.remove('hidden')
    return
  }

  welcomeView.classList.add('hidden')

  messages.forEach(msg => {
    if (msg.role === 'user') {
      appendUserMessage(msg.content)
    } else if (msg.role === 'assistant') {
      const row = createAssistantRow()
      if (msg.reasoning_content) {
        const card = createThinkingCard(row)
        card.querySelector('.thinking-body').textContent = msg.reasoning_content
      }
      if (msg.content) {
        const bubble = row.querySelector('.msg-bubble')
        bubble.innerHTML = renderMarkdown(msg.content)
      }
      if (msg.tool_calls) {
        msg.tool_calls.forEach(tc => {
          appendToolCard(row, tc.function.name, tc.function.arguments, 'done')
        })
      }
    } else if (msg.role === 'tool') {
      const lastRow = chatMessages.querySelector('.message-row.assistant:last-child')
      if (lastRow) {
        const lastCard = lastRow.querySelector('.tool-card:last-child')
        if (lastCard) {
          const outEl = lastCard.querySelector('.tool-output-view')
          if (outEl) outEl.textContent = msg.content
        }
      }
    }
  })

  scrollToBottom()
}

function appendUserMessage(text) {
  welcomeView.classList.add('hidden')
  const row = document.createElement('div')
  row.className = 'message-row user'
  row.innerHTML = `
    <div class="msg-avatar">👤</div>
    <div class="msg-body">
      <div class="msg-bubble">${escapeHtml(text)}</div>
    </div>
  `
  chatMessages.appendChild(row)
  scrollToBottom()
}

function createAssistantRow() {
  const row = document.createElement('div')
  row.className = 'message-row assistant'
  row.innerHTML = `
    <div class="msg-avatar">⚡</div>
    <div class="msg-body">
      <div class="msg-bubble"></div>
    </div>
  `
  chatMessages.appendChild(row)
  return row
}

function createThinkingCard(assistantRow) {
  const card = document.createElement('details')
  card.className = 'thinking-card'
  card.open = false // Kapalı başlar
  card.innerHTML = `
    <summary>
      <span>🧠 Thinking</span>
    </summary>
    <div class="thinking-body"></div>
  `
  const body = assistantRow.querySelector('.msg-body')
  body.insertBefore(card, body.firstChild)
  return card
}

function appendToolCard(assistantRow, toolName, args, status = 'running') {
  const card = document.createElement('details')
  card.className = 'tool-card'
  card.open = false // Kapalı başlar, sadece ismi ve durumu görünür
  
  let formattedArgs = args
  if (typeof args === 'object') {
    formattedArgs = args.command || JSON.stringify(args)
  }

  const icon = toolName === 'bash' ? '🐚 bash' : toolName === 'skill' ? '🧠 skill' : `⚙️ ${toolName}`

  card.innerHTML = `
    <summary class="tool-header">
      <div class="tool-identity">
        <span class="tool-name">${escapeHtml(icon)}</span>
      </div>
      <div class="tool-status-pill ${status}">
        ${status === 'running' ? 'Çalışıyor...' : status === 'done' ? '✓ Tamamlandı' : '✕ Hata'}
      </div>
    </summary>
    <div class="tool-body">
      <div class="tool-cmd-line">$ ${escapeHtml(formattedArgs)}</div>
      <div class="tool-output-view"></div>
    </div>
  `
  assistantRow.querySelector('.msg-body').appendChild(card)
  scrollToBottom()
  return card
}

// Simple & clean Markdown Parser for Assistant Bubbles
function renderMarkdown(md) {
  if (!md) return ''
  
  let html = md
  // 1. Code Blocks
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span>${lang || 'code'}</span>
          <button class="btn-copy-code" onclick="copyCodeBlock(this)">Kopyala</button>
        </div>
        <pre class="code-block-content">${escapeHtml(code.trim())}</pre>
      </div>
    `
  })

  // 2. Inline Code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // 3. Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // 4. Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')

  // 5. Unordered List Items
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')

  // 6. Paragraphs and Linebreaks
  html = html.replace(/\n\n+/g, '</p><p>')
  html = '<p>' + html + '</p>'
  html = html.replace(/<p><\/p>/g, '')

  return html
}

window.copyCodeBlock = function(btn) {
  const code = btn.closest('.code-block-wrapper').querySelector('.code-block-content').innerText
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Kopyalandı! ✓'
    setTimeout(() => { btn.textContent = 'Kopyala' }, 2000)
  })
}

// ==========================================================================
// Token Meter & Context Occupancy Manager
// ==========================================================================
function formatTokens(tokens) {
  if (!tokens || tokens === 0) return '0'
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  }
  return tokens.toLocaleString()
}

function updateContextMeter(measurement) {
  if (!measurement) return
  if (measurement.disabled) {
    if (contextRingFill) {
      contextRingFill.setAttribute('stroke-dasharray', '0 37.7')
      contextRingFill.className = 'ring-fill disabled'
    }
    if (contextPercentLabel) contextPercentLabel.textContent = 'OFF'
    if (cpPercent) cpPercent.textContent = 'Devre Dışı'
    if (cpFigures) cpFigures.textContent = 'Eklenti Kapalı'
    if (cpBarSystem) cpBarSystem.style.width = '0%'
    if (cpBarTools) cpBarTools.style.width = '0%'
    if (cpBarMessages) cpBarMessages.style.width = '0%'
    if (cpLegSystem) cpLegSystem.textContent = 'Kapalı'
    if (cpLegTools) cpLegTools.textContent = 'Kapalı'
    if (cpLegMessages) cpLegMessages.textContent = 'Kapalı'
    return
  }
  if (!measurement.contextPressure) return
  const { contextPressure, contextBreakdown, modelId } = measurement
  const percent = contextPressure.percent || 0
  const usedTokens = contextPressure.usedTokens || 0
  const contextWindow = contextPressure.contextWindow || 24576

  // 1. Update Circular Progress Ring
  // Circumference for r=6: 2 * Math.PI * 6 ≈ 37.7
  const circumference = 37.7
  const offset = (circumference * percent) / 100
  if (contextRingFill) {
    contextRingFill.setAttribute('stroke-dasharray', `${offset} ${circumference}`)
    contextRingFill.className = 'ring-fill ' + (percent > 80 ? 'high' : percent > 50 ? 'medium' : 'low')
  }

  if (contextPercentLabel) {
    contextPercentLabel.textContent = `${percent}%`
  }

  // 2. Update Popup Header & Figures
  if (cpPercent) cpPercent.textContent = `${percent}%`
  if (cpFigures) cpFigures.textContent = `~${formatTokens(usedTokens)} / ${formatTokens(contextWindow)}`

  // 3. Update Progress Bar Segments
  if (contextBreakdown) {
    const systemPct = contextBreakdown.systemPercent || 0
    const toolsPct = contextBreakdown.toolsPercent || 0
    const msgPct = contextBreakdown.messagePercent || 0

    if (cpBarSystem) cpBarSystem.style.width = `${systemPct}%`
    if (cpBarTools) cpBarTools.style.width = `${toolsPct}%`
    if (cpBarMessages) cpBarMessages.style.width = `${msgPct}%`

    // 4. Update Legend Values
    if (cpLegSystem) cpLegSystem.textContent = `~${formatTokens(contextBreakdown.systemTokens)} tok (${systemPct}%)`
    if (cpLegTools) cpLegTools.textContent = `~${formatTokens(contextBreakdown.toolsTokens)} tok (${toolsPct}%)`
    if (cpLegMessages) cpLegMessages.textContent = `~${formatTokens(contextBreakdown.messageTokens)} tok (${msgPct}%)`
  }

  // 5. Update Footer
  if (cpModelName) cpModelName.textContent = modelId || 'active-model'
  if (cpCapTokens) cpCapTokens.textContent = contextWindow.toLocaleString()
}

async function fetchContextMeasurement(sessionId) {
  try {
    const targetId = sessionId || currentSessionId
    const url = targetId ? `/api/sessions/${targetId}/context` : `/api/sessions/_/context`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      updateContextMeter(data)
    }
  } catch (e) {
    // safe fallback
  }
}

// ==========================================================================
// Streaming Event Handlers
// ==========================================================================
function handleServerMessage(msg) {
  if (msg.sessionId) {
    currentSessionId = msg.sessionId
  }

  if (msg.measurement) {
    updateContextMeter(msg.measurement)
  }

  if (msg.type === 'context_update' && msg.measurement) {
    updateContextMeter(msg.measurement)
  } else if (msg.type === 'session_init') {
    currentSessionId = msg.sessionId
    loadSessions()
    fetchContextMeasurement(currentSessionId)
  } else if (msg.type === 'thought') {
    if (!currentThinkingCard && currentAssistantRow) {
      currentThinkingCard = createThinkingCard(currentAssistantRow)
      currentThinkingBody = currentThinkingCard.querySelector('.thinking-body')
    }
    if (currentThinkingBody) {
      currentThinkingBody.textContent += msg.text
      scrollToBottom()
    }
  } else if (msg.type === 'chunk') {
    rawAssistantContent += msg.text
    if (!currentMessageBubble && currentAssistantRow) {
      currentMessageBubble = currentAssistantRow.querySelector('.msg-bubble')
    }
    if (currentMessageBubble) {
      currentMessageBubble.innerHTML = renderMarkdown(rawAssistantContent)
      scrollToBottom()
    }
  } else if (msg.type === 'tool_start') {
    if (currentAssistantRow) {
      appendToolCard(currentAssistantRow, msg.call.name, msg.call.args, 'running')
    }
  } else if (msg.type === 'tool_result') {
    if (currentAssistantRow) {
      const cards = currentAssistantRow.querySelectorAll('.tool-card')
      const lastCard = cards[cards.length - 1]
      if (lastCard) {
        const pill = lastCard.querySelector('.tool-status-pill')
        pill.className = 'tool-status-pill done'
        pill.textContent = '✓ Tamamlandı'
        lastCard.querySelector('.tool-output-view').textContent = typeof msg.result.output === 'string'
          ? msg.result.output
          : JSON.stringify(msg.result.output, null, 2)
      }
      scrollToBottom()
    }
  } else if (msg.type === 'compaction') {
    appendCompactionCard(currentAssistantRow || chatMessages, msg.info)
    scrollToBottom()
  } else if (msg.type === 'done') {
    setStreaming(false)
    loadSessions()
    fetchContextMeasurement(currentSessionId)
  } else if (msg.type === 'error') {
    setStreaming(false)
    showToast('LLM Hatası: ' + msg.error, 'error')
    loadSessions()
  }
}

function appendCompactionCard(targetContainer, info) {
  const card = document.createElement('div')
  card.className = 'compaction-banner'
  card.innerHTML = `
    <div class="compaction-badge">
      <span class="compaction-icon">📦</span>
      <span class="compaction-title">Geçmiş Sıkıştırıldı (Compacted)</span>
      <span class="compaction-desc">· ${info?.summary || 'Bağlam penceresi koruması için eski turlar otomatik özetlendi.'}</span>
    </div>
  `
  if (targetContainer && targetContainer.classList && targetContainer.classList.contains('msg-row')) {
    const content = targetContainer.querySelector('.msg-content')
    if (content) {
      content.prepend(card)
    } else {
      targetContainer.prepend(card)
    }
  } else if (chatMessages) {
    chatMessages.appendChild(card)
  }
}

// ==========================================================================
// User Input & Prompt Submission
// ==========================================================================
function sendMessage() {
  const text = promptInput.value.trim()
  if (!text || isStreaming) return

  appendUserMessage(text)
  promptInput.value = ''
  promptInput.style.height = 'auto'

  currentAssistantRow = createAssistantRow()
  currentThinkingCard = null
  currentThinkingBody = null
  currentMessageBubble = currentAssistantRow.querySelector('.msg-bubble')
  rawAssistantContent = ''

  const [providerId, modelId] = selectModel.value.split(':')

  setStreaming(true)

  ws.send(JSON.stringify({
    type: 'chat',
    sessionId: currentSessionId,
    prompt: text,
    providerId,
    modelId
  }))
}

function setStreaming(state) {
  isStreaming = state
  if (state) {
    btnSend.classList.add('hidden')
    btnStop.classList.remove('hidden')
  } else {
    btnSend.classList.remove('hidden')
    btnStop.classList.add('hidden')
  }
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatTimeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Az önce'
  if (mins < 60) return `${mins} dk önce`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} sa önce`
  return `${Math.floor(hours / 24)} gün önce`
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = msg
  toastContainer.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-10px)'
    setTimeout(() => toast.remove(), 200)
  }, 3500)
}

// ==========================================================================
// Event Listeners
// ==========================================================================
function setupEventListeners() {
  chatForm.onsubmit = (e) => {
    e.preventDefault()
    sendMessage()
  }

  promptInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  promptInput.oninput = () => {
    promptInput.style.height = 'auto'
    promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px'
  }

  btnStop.onclick = () => {
    if (ws) ws.send(JSON.stringify({ type: 'abort' }))
    setStreaming(false)
    showToast('İşlem durduruldu', 'info')
  }

  btnNewChat.onclick = newChat

  if (btnContextMeter) {
    btnContextMeter.onclick = (e) => {
      e.stopPropagation()
      if (contextPopup) {
        contextPopup.classList.toggle('hidden')
        fetchContextMeasurement(currentSessionId)
      }
    }
  }

  document.addEventListener('click', (e) => {
    if (contextPopup && !contextPopup.classList.contains('hidden')) {
      if (!contextPopup.contains(e.target) && e.target !== btnContextMeter && !btnContextMeter.contains(e.target)) {
        contextPopup.classList.add('hidden')
      }
    }
  })

  if (selectModel) {
    selectModel.onchange = () => {
      fetchContextMeasurement(currentSessionId)
    }
  }

  // ==========================================================================
  // Workspace Picker & Directory Browser
  // ==========================================================================
  async function openWorkspaceModal() {
    browsingPath = currentWorkspace || '/home/huseyina/code_mode'
    wsInputPath.value = browsingPath
    wsPickerModal.classList.remove('hidden')
    await browseWorkspace(browsingPath)
  }

  async function browseWorkspace(targetPath) {
    try {
      wsDirList.innerHTML = '<div style="font-size:11.5px;color:var(--text-dimmed);padding:8px;">Klasörler taranıyor...</div>'
      const res = await fetch('/api/workspace/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath })
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Sunucu güncel değil. Lütfen terminalden sunucuyu durdurup (Ctrl+C) "pnpm dev" ile yeniden başlatın.')
      }

      const data = await res.json()
      browsingPath = data.current
      browsingParent = data.parent
      wsInputPath.value = browsingPath

      wsDirList.innerHTML = ''
      if (!data.directories || data.directories.length === 0) {
        wsDirList.innerHTML = '<div style="font-size:11.5px;color:var(--text-dimmed);padding:8px;">Alt klasör bulunamadı</div>'
        return
      }

      data.directories.forEach(dirName => {
        const item = document.createElement('div')
        item.className = 'ws-dir-item'
        item.innerHTML = `<span>📁</span><span>${escapeHtml(dirName)}</span>`
        item.onclick = () => {
          const nextPath = browsingPath.endsWith('/') ? browsingPath + dirName : browsingPath + '/' + dirName
          browseWorkspace(nextPath)
        }
        wsDirList.appendChild(item)
      })
    } catch (err) {
      wsDirList.innerHTML = `<div style="font-size:11.5px;color:var(--state-danger);padding:8px;">Hata: ${escapeHtml(err.message)}</div>`
    }
  }

  async function applyWorkspace(selectedPath) {
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, sessionId: currentSessionId })
      })
      const data = await res.json()
      if (data.success) {
        currentWorkspace = data.workspace
        const parts = currentWorkspace.split('/')
        const folder = parts[parts.length - 1] || currentWorkspace
        currentWsName.textContent = folder
        currentWsName.title = currentWorkspace
        if (topbarWsName) {
          topbarWsName.textContent = folder
          topbarWsChip.title = `Aktif Çalışma Alanı: ${currentWorkspace}`
        }
        await loadSkills()
        wsPickerModal.classList.add('hidden')
        showToast(`📁 Çalışma alanı değiştirildi: ${folder}`, 'success')
      } else {
        showToast('Geçersiz çalışma alanı yolu', 'error')
      }
    } catch (e) {
      showToast('Çalışma alanı güncellenemedi: ' + e.message, 'error')
    }
  }

  btnChangeWs.onclick = openWorkspaceModal
  if (topbarWsChip) topbarWsChip.onclick = openWorkspaceModal
  btnCloseWsModal.onclick = () => wsPickerModal.classList.add('hidden')
  wsPickerModal.querySelector('.modal-backdrop').onclick = () => wsPickerModal.classList.add('hidden')

  btnWsNavigate.onclick = () => {
    const p = wsInputPath.value.trim()
    if (p) browseWorkspace(p)
  }

  wsInputPath.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      btnWsNavigate.click()
    }
  }

  btnWsParent.onclick = () => {
    if (browsingParent && browsingParent !== browsingPath) {
      browseWorkspace(browsingParent)
    }
  }

  document.querySelectorAll('.btn-quick-ws').forEach(btn => {
    btn.onclick = () => {
      const p = btn.getAttribute('data-path')
      wsInputPath.value = p
      browseWorkspace(p)
    }
  })

  btnApplyWorkspace.onclick = () => {
    const p = wsInputPath.value.trim() || browsingPath
    applyWorkspace(p)
  }

  // ==========================================================================
  // Settings Tabs & Modal Navigation
  // ==========================================================================
  function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabName)
    })
    document.querySelectorAll('.settings-tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `tab-pane-${tabName}`)
    })

    if (tabName === 'plugins') {
      loadPlugins()
    } else if (tabName === 'presets') {
      loadPresets()
    }
  }

  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.getAttribute('data-tab')
      switchSettingsTab(tab)
    }
  })

  if (topbarPresetChip) {
    topbarPresetChip.onclick = () => {
      btnOpenSettings.click()
      switchSettingsTab('presets')
    }
  }

  if (pluginSearchInput) {
    pluginSearchInput.oninput = () => {
      const q = pluginSearchInput.value.trim().toLowerCase()
      const filtered = cachedPlugins.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.module.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q))
      )
      renderPluginsList(filtered)
    }
  }

  // Custom Preset Builder & Editor
  if (btnCancelPresetEdit) {
    btnCancelPresetEdit.onclick = () => {
      cancelPresetEditing()
    }
  }

  if (btnSaveCustomPreset) {
    btnSaveCustomPreset.onclick = async () => {
      const name = presetNewName.value.trim()
      const icon = presetNewIcon.value.trim() || '🤖'
      const desc = presetNewDesc.value.trim()
      const prompt = presetNewPrompt.value.trim()
      const editingId = presetEditingId ? presetEditingId.value.trim() : ''

      if (!name) {
        showToast('Lütfen profil adı girin!', 'error')
        return
      }

      const id = editingId || ('custom-' + Date.now().toString(36))
      const preset = {
        id,
        name,
        icon,
        description: desc,
        systemPrompt: prompt
      }

      try {
        const res = await fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset })
        })
        const data = await res.json()
        if (data.success) {
          showToast(editingId ? `✓ "${name}" profili güncellendi!` : `🎉 "${name}" profili oluşturuldu!`, 'success')
          cancelPresetEditing()
          await loadPresets()
        }
      } catch (err) {
        showToast('Profil kaydedilemedi: ' + err.message, 'error')
      }
    }
  }

  // Settings Modal Handlers
  if (settingsDefaultPreset) {
    settingsDefaultPreset.onchange = async () => {
      const selectedId = settingsDefaultPreset.value
      if (selectedId) {
        try {
          const res = await fetch('/api/presets/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetId: selectedId })
          })
          const data = await res.json()
          if (data.success) {
            currentActivePreset = data.activePreset
            if (topbarPresetName) topbarPresetName.textContent = currentActivePreset.name
            if (topbarPresetIcon) topbarPresetIcon.textContent = currentActivePreset.icon || '🚀'
            renderPresetsGrid(cachedPresets)
          }
        } catch {}
      }
    }
  }

  // Settings Modal Handlers
  btnOpenSettings.onclick = () => {
    if (activeSettings) {
      if (settingsProvider) settingsProvider.value = activeSettings.defaultProvider || 'gemma-local'
      const prov = activeSettings.providers?.[activeSettings.defaultProvider] || Object.values(activeSettings.providers || {})[0]
      if (prov) {
        if (settingsBaseUrl) settingsBaseUrl.value = prov.baseURL || ''
        if (settingsApiKey) settingsApiKey.value = prov.apiKey || ''
        if (settingsModelId) settingsModelId.value = activeSettings.defaultModel || ''
      }
      if (settingsWorkspace) settingsWorkspace.value = activeSettings.workspace || currentWorkspace || ''
      if (settingsDefaultPreset) {
        settingsDefaultPreset.value = currentActivePreset?.id || activeSettings.defaultPreset || 'full-stack'
      }
    }
    settingsModal.classList.remove('hidden')
  }

  btnCloseSettings.onclick = () => {
    settingsModal.classList.add('hidden')
  }

  settingsModal.querySelector('.modal-backdrop').onclick = () => {
    settingsModal.classList.add('hidden')
  }

  btnDiscoverModels.onclick = async () => {
    const baseURL = settingsBaseUrl.value.trim()
    const apiKey = settingsApiKey.value.trim()
    if (!baseURL) {
      showToast('Lütfen önce Endpoint URL girin!', 'error')
      return
    }

    btnDiscoverModels.querySelector('span').textContent = 'Aranıyor...'
    try {
      const res = await fetch('/api/models/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseURL, apiKey })
      })
      const data = await res.json()
      if (data.models && data.models.length > 0) {
        showToast(`🎉 ${data.models.length} model keşfedildi!`, 'success')
        settingsModelId.value = data.models[0].id
      } else {
        showToast('Model bulunamadı.', 'info')
      }
    } catch (err) {
      showToast(`Keşif Hatası: ${err.message}`, 'error')
    } finally {
      btnDiscoverModels.querySelector('span').textContent = 'Modelleri Keşfet'
    }
  }

  btnSaveSettings.onclick = async () => {
    const providerId = settingsProvider.value
    const baseURL = settingsBaseUrl.value.trim()
    const apiKey = settingsApiKey.value.trim()
    const defaultModel = settingsModelId.value.trim()
    const workspace = settingsWorkspace.value.trim()
    const defaultPreset = currentActivePreset?.id || (settingsDefaultPreset ? settingsDefaultPreset.value : 'full-stack')
    const contextWindow = settingsContextWindow ? parseInt(settingsContextWindow.value) || 24576 : 24576

    const updated = {
      defaultProvider: providerId,
      defaultModel,
      defaultPreset,
      workspace,
      providers: {
        [providerId]: {
          id: providerId,
          name: providerId === 'gemma-local' ? 'Local Gemma 4 (vLLM)' : 'DeepSeek API',
          api: 'openai-completions',
          baseURL,
          apiKey,
          models: [{ id: defaultModel, name: defaultModel, contextWindow, maxTokens: 8192 }]
        }
      }
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      })
      activeSettings = await res.json()
      populateModelDropdown()
      await loadWorkspace()
      await loadPresets()
      await fetchContextMeasurement()
      settingsModal.classList.add('hidden')
      showToast('✅ Ayarlar başarıyla kaydedildi!', 'success')
    } catch (e) {
      showToast('Ayarlar kaydedilemedi: ' + e.message, 'error')
    }
  }
}

// Start
window.onload = init

