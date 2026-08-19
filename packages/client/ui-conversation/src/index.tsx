import React, { useRef, useEffect, useState, FormEvent, KeyboardEvent, ChangeEvent, MouseEvent } from 'react'
import { Button, IconSend, IconStop, IconBrain, IconTerminal, IconCheck, IconCopy } from '@custom-harness/client-ui-primitives'

export interface ToolResultItem {
  id: string
  name: string
  args?: any
  output?: any
  status?: 'running' | 'done' | 'error'
}

export interface ChatMessageItem {
  id?: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string
  reasoning_content?: string
  tool_calls?: any[]
  tool_call_id?: string
  name?: string
  isStreaming?: boolean
  toolResults?: ToolResultItem[]
  compactionInfo?: { messageCount: number; summary: string }
}

export interface ApprovalItem {
  id: string
  sessionId: string
  toolName: string
  args: any
  description?: string
}

export interface ConversationTimelineProps {
  messages: ChatMessageItem[]
  isStreaming: boolean
  activePresetName?: string
  pendingApproval?: ApprovalItem | null
  onRespondApproval?: (id: string, outcome: 'allow_once' | 'allow_always' | 'deny') => void
}

export function ConversationTimeline({
  messages,
  isStreaming,
  activePresetName,
  pendingApproval,
  onRespondApproval
}: ConversationTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming, pendingApproval])

  if (messages.length === 0 && !pendingApproval) {
    return (
      <div className="welcome-hero">
        <div className="welcome-tag">
          <span>⚡</span>
          <span>DeepSeek Harness Otonom Ajan</span>
        </div>
        <h1 className="welcome-title">Size nasıl yardımcı olabilirim?</h1>
        <p className="welcome-desc">
          Kod yazma, hata ayıklama, dosya düzenleme ve terminal komutlarını otonom olarak yöneten
          yeni nesil yapay zekâ asistanınız hazır.
        </p>
        <div className="welcome-suggestions">
          <div className="suggestion-pill">📁 "Projedeki dosyaları listele ve incele"</div>
          <div className="suggestion-pill">⚡ "FastAPI endpointlerine birim test yaz"</div>
          <div className="suggestion-pill">🔍 "Son yapılan değişiklikleri kontrol et"</div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-messages">
      {messages.map((msg, index) => {
        if (msg.compactionInfo) {
          return <CompactionCard key={`compaction-${index}`} info={msg.compactionInfo} />
        }

        if (msg.role === 'user') {
          return <UserMessageBubble key={`user-${index}`} content={msg.content || ''} />
        }

        if (msg.role === 'assistant') {
          return (
            <AssistantMessageBubble
              key={`asst-${index}`}
              message={msg}
              activePresetName={activePresetName}
            />
          )
        }

        return null
      })}

      {pendingApproval && onRespondApproval && (
        <ApprovalCard approval={pendingApproval} onRespond={onRespondApproval} />
      )}

      <div ref={bottomRef} />
    </div>
  )
}

export function UserMessageBubble({ content }: { content: string }) {
  return (
    <div className="msg-row user">
      <div className="msg-avatar user">👤</div>
      <div className="msg-content user">
        <div className="msg-bubble user">{content}</div>
      </div>
    </div>
  )
}

export function AssistantMessageBubble({
  message,
  activePresetName = 'Deep'
}: {
  message: ChatMessageItem
  activePresetName?: string
}) {
  return (
    <div className="msg-row assistant">
      <div className="msg-avatar assistant">⚡</div>
      <div className="msg-content assistant">
        <div className="msg-author-tag">
          <span>🤖</span>
          <span>{activePresetName}</span>
        </div>

        {/* 1. Collapsible Thinking Reasoning Accordion */}
        {message.reasoning_content && (
          <ThinkingCard reasoning={message.reasoning_content} isStreaming={message.isStreaming} />
        )}

        {/* 2. Tool Calls & Results List */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="tool-cards-stack">
            {message.toolResults.map((tool, idx) => (
              <ToolCard key={`tool-${idx}`} tool={tool} />
            ))}
          </div>
        )}

        {/* 3. Assistant Text Content */}
        {message.content && (
          <div className="msg-bubble assistant">
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }} />
          </div>
        )}
      </div>
    </div>
  )
}

export function ThinkingCard({ reasoning, isStreaming }: { reasoning: string; isStreaming?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(reasoning)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleOpen = (e: MouseEvent) => {
    e.preventDefault()
    setIsOpen(prev => !prev)
  }

  return (
    <div className={`thinking-card ${isOpen ? 'open' : ''}`}>
      <div className="thinking-header" onClick={toggleOpen}>
        <div className="thinking-summary-left">
          <span className="thinking-toggle-arrow">{isOpen ? '▾' : '▸'}</span>
          <IconBrain size={15} />
          <span className="thinking-title">Düşünce Süreci (Reasoning)</span>
          {isStreaming && <span className="thinking-pulse" />}
        </div>
        <div className="thinking-summary-right">
          <span className="thinking-chars">{reasoning.length} karakter</span>
          <button className="btn-copy-thought" onClick={handleCopy} title="Düşünceyi Kopyala">
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="thinking-body">{reasoning}</div>
      )}
    </div>
  )
}

export function ToolCard({
  tool
}: {
  tool: ToolResultItem
}) {
  const isDone = tool.status === 'done' || (tool.output !== undefined && tool.status !== 'error')
  const isError = tool.status === 'error'
  const pillClass = isDone ? 'done' : isError ? 'error' : 'running'
  const pillText = isDone ? '✓ Tamamlandı' : isError ? '✕ Hata' : 'Çalışıyor...'

  const outputStr = typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)
  const argsStr = typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)

  return (
    <details className="tool-card" open={false}>
      <summary className="tool-header">
        <div className="tool-summary-left">
          <IconTerminal size={14} />
          <span className="tool-name">{tool.name}</span>
        </div>
        <span className={`tool-status-pill ${pillClass}`}>{pillText}</span>
      </summary>
      <div className="tool-body">
        {tool.args && (
          <div className="tool-section">
            <div className="tool-section-label">Parametreler:</div>
            <pre className="tool-args-view">{argsStr}</pre>
          </div>
        )}
        {tool.output !== undefined && (
          <div className="tool-section">
            <div className="tool-section-label">Sonuç / Çıktı:</div>
            <pre className="tool-output-view">{outputStr || '(Boş çıktı)'}</pre>
          </div>
        )}
      </div>
    </details>
  )
}

export function CompactionCard({ info }: { info: { messageCount: number; summary: string } }) {
  return (
    <div className="compaction-banner">
      <div className="compaction-badge">
        <span className="compaction-icon">📦</span>
        <span className="compaction-title">Geçmiş Sıkıştırıldı (Compacted)</span>
        <span className="compaction-desc">· {info?.summary || 'Bağlam penceresi koruması için eski turlar otomatik özetlendi.'}</span>
      </div>
    </div>
  )
}

export function ApprovalCard({
  approval,
  onRespond
}: {
  approval: ApprovalItem
  onRespond: (id: string, outcome: 'allow_once' | 'allow_always' | 'deny') => void
}) {
  const argsStr = typeof approval.args === 'string' ? approval.args : JSON.stringify(approval.args, null, 2)

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div className="approval-header-left">
          <span className="approval-badge-icon">🛡️</span>
          <span className="approval-title">Kullanıcı Onayı Bekleniyor: <strong>{approval.toolName}</strong></span>
        </div>
        <span className="approval-pending-pill">Onay Gerekli</span>
      </div>

      <div className="approval-body">
        <p className="approval-desc">{approval.description || 'Model bu aracı çalıştırmak istiyor. İzin veriyor musunuz?'}</p>
        <pre className="approval-code-view">{argsStr}</pre>
      </div>

      <div className="approval-actions">
        <Button variant="danger" size="sm" onClick={() => onRespond(approval.id, 'deny')}>
          ✕ Reddet
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onRespond(approval.id, 'allow_always')}>
          ⚡ Bu Oturumda Hep İzin Ver
        </Button>
        <Button variant="primary" size="sm" onClick={() => onRespond(approval.id, 'allow_once')}>
          ✓ Tek Seferlik İzin Ver
        </Button>
      </div>
    </div>
  )
}

const UI_SLASH_COMMANDS = [
  { cmd: '/yolo', desc: 'YOLO / Auto-Approve modu (Tüm izinleri otomatik onayla)', icon: '⚡' },
  { cmd: '/think ', desc: 'Model düşünme yeteneğini aç/kapat (/think on|off)', icon: '💭' },
  { cmd: '/goal ', desc: 'Otonom hedef tanımla ve çalıştır (/goal <hedef>)', icon: '🎯' },
  { cmd: '/mode ', desc: 'Çalışma motorunu değiştir (/mode full | minimal | code)', icon: '⚙️ ' },
  { cmd: '/compact', desc: 'Sohbet geçmişini özetle ve bağlamı temizle', icon: '📦' },
  { cmd: '/tokens', desc: 'Canlı token tüketimini ölç', icon: '📊' },
  { cmd: '/clear', desc: 'Sohbet ekranını temizle', icon: '🧹' },
  { cmd: '/help', desc: 'Komut listesi ve yardım menüsü', icon: '❓' }
]

export interface InputAreaProps {
  onSendMessage: (text: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function InputArea({ onSendMessage, onStop, isStreaming, disabled }: InputAreaProps) {
  const [text, setText] = useState('')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filteredCommands = UI_SLASH_COMMANDS.filter(c =>
    c.cmd.toLowerCase().startsWith(text.toLowerCase()) || text === '/'
  )

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!text.trim() || isStreaming || disabled) return
    onSendMessage(text.trim())
    setText('')
    setShowSlashMenu(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setShowSlashMenu(false)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)
    setShowSlashMenu(val.startsWith('/'))
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`
  }

  const handleSelectCommand = (cmd: string) => {
    setText(cmd)
    setShowSlashMenu(false)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  return (
    <div className="input-container-wrapper">
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="slash-menu-popup">
          <div className="slash-menu-header">
            <span>⚡ Eğik Çizgi Komutları (Slash Commands)</span>
            <span className="slash-menu-hint">Tıkla veya Tab ile tamamla</span>
          </div>
          <div className="slash-menu-list">
            {filteredCommands.map((c) => (
              <div
                key={c.cmd}
                className="slash-menu-item"
                onClick={() => handleSelectCommand(c.cmd)}
              >
                <span className="slash-item-icon">{c.icon}</span>
                <span className="slash-item-cmd">{c.cmd.trim()}</span>
                <span className="slash-item-desc">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <form className="input-card" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="prompt-textarea"
          placeholder="Bir görev verin veya soru sorun... (/ yazarak komut menüsünü açabilirsiniz)"
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div className="input-controls">
          <div className="input-hint">
            <kbd>↵</kbd> Gönder &nbsp;·&nbsp; <kbd>/</kbd> Komut Menüsü &nbsp;·&nbsp; <kbd>Shift</kbd> + <kbd>↵</kbd> Yeni Satır
          </div>
          <div className="input-actions">
            {isStreaming ? (
              <Button variant="danger" size="sm" onClick={onStop} title="Durdur">
                <IconStop size={15} />
                <span>Durdur</span>
              </Button>
            ) : (
              <Button variant="primary" size="sm" type="submit" disabled={!text.trim() || disabled}>
                <IconSend size={15} />
                <span>Gönder</span>
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

function formatMarkdown(text: string): string {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks
  html = html.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `<div class="code-block-wrapper"><div class="code-header"><span>${lang || 'code'}</span></div><pre><code>${code}</code></pre></div>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // Line breaks
  html = html.replace(/\n/g, '<br/>')

  return html
}
