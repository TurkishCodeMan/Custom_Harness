import React, { useRef, useEffect, useState, FormEvent, KeyboardEvent, ChangeEvent, MouseEvent } from 'react'
import {
  Button,
  IconSend,
  IconStop,
  IconBrain,
  IconTerminal,
  IconCheck,
  IconCopy,
  IconPlus,
  IconPaperclip,
  IconFileSpreadsheet,
  IconFileText,
  IconImage,
  IconX,
  IconUpload,
  IconChevronDown
} from '@custom-harness/client-ui-primitives'

export interface ToolResultItem {
  id: string
  name: string
  args?: any
  output?: any
  status?: 'running' | 'done' | 'error'
}

export interface UploadedAttachment {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType?: string
  fileCategory: 'spreadsheet' | 'document' | 'image' | 'code' | 'pdf' | 'other'
  schemaSummary?: string
  ocrText?: string
  previewUrl?: string
  isUploading?: boolean
  preview?: string
  summary?: string
  structuredData?: any
  sessionId?: string
  uploadedAt?: number
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
  attachments?: UploadedAttachment[]
  presetName?: string
  modelName?: string
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
  activeModelName?: string
  pendingApproval?: ApprovalItem | null
  onRespondApproval?: (id: string, outcome: 'allow_once' | 'allow_always' | 'deny') => void
  onQuickAction?: (promptText: string) => void
  onDropFiles?: (files: File[]) => void
}

export function ConversationTimeline({
  messages,
  isStreaming,
  activePresetName = 'Full-Stack Developer',
  activeModelName = 'Gemma 4 (27B)',
  pendingApproval,
  onRespondApproval,
  onQuickAction,
  onDropFiles
}: ConversationTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming, pendingApproval])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onDropFiles) {
      onDropFiles(Array.from(e.dataTransfer.files))
    }
  }

  return (
    <div
      className={`chat-messages-container ${isDragOver ? 'drag-over-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="chat-dropzone-overlay">
          <div className="dropzone-card">
            <IconUpload size={40} className="dropzone-icon" />
            <div className="dropzone-title">Dosyaları Buraya Bırakın</div>
            <div className="dropzone-desc">Excel (.xlsx, .csv), PDF, Görseller veya Kaynak Kodlar</div>
          </div>
        </div>
      )}

      {messages.length === 0 && !pendingApproval ? (
        <div className="welcome-chatgpt-hero">
          <div className="welcome-hero-badge">
            <span className="badge-sparkle">⚡</span>
            <span>ArtificaX · Enterprise GPT ({activeModelName})</span>
          </div>

          <h1 className="welcome-chatgpt-title">Bugün ne inşa etmek istersiniz?</h1>
          <p className="welcome-chatgpt-subtitle">
            ArtificaX Enterprise GPT ile otonom kodlama, Excel veri analizi, görsel OCR/SigLIP araması ve mimari planlama parmaklarınızın ucunda.
          </p>

          <div className="welcome-cards-grid">
            <div
              className="welcome-action-card"
              onClick={() => onQuickAction?.('Projedeki kod yapısını incele, mimariyi analiz et ve iyileştirme öner.')}
            >
              <div className="card-icon">🔍</div>
              <div className="card-title">Kod Analizi & İnceleme</div>
              <div className="card-desc">Mimariyi tara, dosya yapısını özetle ve optimizasyon önerileri sun.</div>
            </div>

            <div
              className="welcome-action-card"
              onClick={() => onQuickAction?.('Excel veya CSV dosyamı analiz et, toplamları ve özet istatistikleri çıkar.')}
            >
              <div className="card-icon">📊</div>
              <div className="card-title">Excel & Veri Analizi</div>
              <div className="card-desc">Tabloları yükle, Pandas/SQL ile kesin hesaplama ve grafik çizdir.</div>
            </div>

            <div
              className="welcome-action-card"
              onClick={() => onQuickAction?.('Yüklediğim görseldeki metinleri (OCR) oku ve diyagramı açıkla.')}
            >
              <div className="card-icon">🖼️</div>
              <div className="card-title">Görsel & Şema İnceleme</div>
              <div className="card-desc">Ekran görüntüleri, mimari şemalar veya benzer görsel araması yap.</div>
            </div>

            <div
              className="welcome-action-card"
              onClick={() => onQuickAction?.('/goal Proje için detaylı mimari plan oluştur ve doğrulama adımlarını belirle')}
            >
              <div className="card-icon">📋</div>
              <div className="card-title">Mimari Plan & Hedef</div>
              <div className="card-desc">Büyük görevler için planlama modunu başlat ve adım adım yürüt.</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-messages-timeline">
          {messages.map((msg, index) => {
            if (msg.compactionInfo) {
              return <CompactionCard key={`compaction-${index}`} info={msg.compactionInfo} />
            }

            if (msg.role === 'user') {
              return (
                <UserMessageBubble
                  key={`user-${index}`}
                  content={msg.content || ''}
                  attachments={msg.attachments}
                />
              )
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

          <div ref={bottomRef} style={{ height: 40 }} />
        </div>
      )}
    </div>
  )
}

export function UserMessageBubble({
  content,
  attachments
}: {
  content: string
  attachments?: UploadedAttachment[]
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="msg-row user-row">
      <div className="user-bubble-container">
        {attachments && attachments.length > 0 && (
          <div className="user-attachments-grid">
            {attachments.map((att) => (
              <div key={att.id || att.filePath} className="user-attachment-chip">
                <span className="att-chip-icon">
                  {att.fileCategory === 'spreadsheet' ? (
                    <IconFileSpreadsheet size={14} />
                  ) : att.fileCategory === 'image' ? (
                    <IconImage size={14} />
                  ) : (
                    <IconFileText size={14} />
                  )}
                </span>
                <span className="att-chip-name">{att.fileName}</span>
                {att.fileSize > 0 && (
                  <span className="att-chip-size">({(att.fileSize / 1024).toFixed(0)} KB)</span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="user-bubble-content">{content}</div>
        <button className="btn-msg-copy" onClick={handleCopy} title="Metni Kopyala">
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
        </button>
      </div>
    </div>
  )
}

export function AssistantMessageBubble({
  message,
  activePresetName = 'Full-Stack Developer'
}: {
  message: ChatMessageItem
  activePresetName?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const hasTools = message.tool_calls && message.tool_calls.length > 0
  const hasToolResults = message.toolResults && message.toolResults.length > 0
  const isPending = message.isStreaming && !message.content && !message.reasoning_content

  return (
    <div className="msg-row assistant-row">
      <div className="assistant-avatar-column">
        <div className="assistant-avatar-badge">
          <IconBrain size={16} />
        </div>
      </div>

      <div className="assistant-bubble-container">
        <div className="assistant-header-meta">
          <span className="asst-name">ArtificaX</span>
          <span className="asst-preset-tag">{message.presetName || activePresetName}</span>
          {message.isStreaming && <span className="streaming-pulse-dot" title="Üretiyor..." />}
        </div>

        {/* Reasoning / Thinking Accordion */}
        {message.reasoning_content && (
          <ThinkingBlock reasoning={message.reasoning_content} isStreaming={message.isStreaming} />
        )}

        {/* Tool Invocations */}
        {hasTools && (
          <div className="tool-cards-container">
            {message.tool_calls!.map((tc, idx) => (
              <ToolCallCard key={tc.id || `tc-${idx}`} call={tc} />
            ))}
          </div>
        )}

        {/* Tool Results */}
        {hasToolResults && (
          <div className="tool-results-container">
            {message.toolResults!.map((tr, idx) => (
              <ToolResultCard key={tr.id || `tr-${idx}`} result={tr} />
            ))}
          </div>
        )}

        {/* Assistant Markdown Content */}
        {message.content ? (
          <div
            className="assistant-content-markdown"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
          />
        ) : isPending ? (
          <div className="streaming-cursor-loader">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        ) : null}

        {message.content && (
          <div className="assistant-bottom-actions">
            <button className="btn-action-small" onClick={handleCopy} title="Yanıtı Kopyala">
              {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
              <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ThinkingBlock({
  reasoning,
  isStreaming
}: {
  reasoning: string
  isStreaming?: boolean
}) {
  // Default is CLOSED
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Token calculation: ~4 characters per token
  const tokenCount = Math.max(1, Math.ceil(reasoning.length / 4))
  const tokenDisplay = tokenCount >= 1000 ? `${(tokenCount / 1000).toFixed(1)}k` : tokenCount.toLocaleString('tr-TR')
  const charDisplay = reasoning.length.toLocaleString('tr-TR')

  return (
    <div className={`thinking-accordion ${isOpen ? 'open' : 'closed'}`}>
      <div className="thinking-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="thinking-summary-left">
          <span className="thinking-icon">💭</span>
          <span className="thinking-title">Düşünce Süreci</span>
          <span className="thinking-token-badge">~{tokenDisplay} token</span>
          {isStreaming ? (
            <span className="thinking-streaming-label">
              <span className="thinking-pulse" />
              Düşünüyor...
            </span>
          ) : (
            <span className="thinking-chars-label">({charDisplay} karakter)</span>
          )}
        </div>
        <div className="thinking-summary-right">
          <button
            type="button"
            className="btn-copy-thought"
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard.writeText(reasoning)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            title="Düşünce Metnini Kopyala"
          >
            {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
            <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
          </button>
          <span className={`accordion-arrow ${isOpen ? 'open' : ''}`}>
            <IconChevronDown size={14} />
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="thinking-content">
          <pre>{reasoning}</pre>
        </div>
      )}
    </div>
  )
}

export function ToolCallCard({ call }: { call: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const fnName = call.function?.name || call.name || 'Bilinmeyen Araç'
  let argsStr = call.function?.arguments || call.args || '{}'
  if (typeof argsStr !== 'string') argsStr = JSON.stringify(argsStr, null, 2)

  return (
    <div className={`tool-card tool-call ${isOpen ? 'open' : 'closed'}`}>
      <div className="tool-card-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="tool-badge-info">
          <IconTerminal size={13} className="tool-badge-icon" />
          <span className="tool-title">Araç Çağrısı:</span>
          <code className="tool-name">{fnName}</code>
        </div>
        <span className={`tool-toggle-arrow ${isOpen ? 'open' : ''}`}>
          <IconChevronDown size={13} />
        </span>
      </div>
      {isOpen && (
        <div className="tool-card-body">
          <pre><code>{argsStr}</code></pre>
        </div>
      )}
    </div>
  )
}

export function ToolResultCard({ result }: { result: ToolResultItem }) {
  const [isOpen, setIsOpen] = useState(false)
  let outStr = result.output
  if (typeof outStr !== 'string') outStr = JSON.stringify(outStr, null, 2)

  return (
    <div className={`tool-card tool-result ${isOpen ? 'open' : 'closed'}`}>
      <div className="tool-card-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="tool-badge-info">
          <span className="result-icon">⚡</span>
          <span className="tool-title">Sonuç:</span>
          <code className="tool-name">{result.name}</code>
        </div>
        <span className={`tool-toggle-arrow ${isOpen ? 'open' : ''}`}>
          <IconChevronDown size={13} />
        </span>
      </div>
      {isOpen && (
        <div className="tool-card-body">
          <pre><code>{outStr}</code></pre>
        </div>
      )}
    </div>
  )
}

export function CompactionCard({ info }: { info: { messageCount: number; summary: string } }) {
  return (
    <div className="compaction-card">
      <div className="compaction-header">
        <span>📦 Bağlam Sıkıştırma (Compaction)</span>
        <span className="compaction-count">{info.messageCount} mesaj arşivlendi</span>
      </div>
      <div className="compaction-summary">{info.summary}</div>
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
  return (
    <div className="approval-card-wrapper">
      <div className="approval-card">
        <div className="approval-header">
          <span className="approval-shield">🛡️</span>
          <div className="approval-title-box">
            <h4>Güvenlik Onayı Gerekiyor</h4>
            <p>Model şu komutu çalıştırmak istiyor:</p>
          </div>
        </div>
        <div className="approval-body">
          <div className="approval-tool-name">{approval.toolName}</div>
          <pre className="approval-args">
            <code>{JSON.stringify(approval.args, null, 2)}</code>
          </pre>
          {approval.description && (
            <p className="approval-desc">{approval.description}</p>
          )}
        </div>
        <div className="approval-actions">
          <Button variant="danger" size="sm" onClick={() => onRespond(approval.id, 'deny')}>
            Engelle (Reddet)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onRespond(approval.id, 'allow_once')}>
            Bir Kere İzin Ver
          </Button>
          <Button variant="primary" size="sm" onClick={() => onRespond(approval.id, 'allow_always')}>
            Her Zaman İzin Ver
          </Button>
        </div>
      </div>
    </div>
  )
}

export interface SlashCommandItem {
  cmd: string
  desc: string
  icon: string
  action?: 'files' | 'think' | 'rag' | 'skills' | 'workspace' | 'goal' | 'compact' | 'tokens' | 'clear' | 'help' | 'mode'
}

export const UI_SLASH_COMMANDS: SlashCommandItem[] = [
  { cmd: '/files', desc: '📁 Dosyalarım: Kayıtlı belgeleri sohbete bağla', icon: '📁', action: 'files' },
  { cmd: '/think', desc: '💭 Düşünme Modu: Derin akıl yürütmeyi aç/kapat', icon: '💭', action: 'think' },
  { cmd: '/rag', desc: '🧠 RAG: Bilgi bankası ve vektör yönetimi', icon: '🧠', action: 'rag' },
  { cmd: '/skills', desc: '✨ Beceriler: Uzmanlık ajanları ve talimatlar', icon: '✨', action: 'skills' },
  { cmd: '/workspace', desc: '📂 Çalışma Alanı: Proje dizinini değiştir', icon: '📂', action: 'workspace' },
  { cmd: '/goal ', desc: '🎯 Otonom Hedef: Kendi kendine çalışan hedef ver (/goal <hedef>)', icon: '🎯', action: 'goal' },
  { cmd: '/clear', desc: '🧹 Ekranı Temizle: Sohbet mesajlarını sıfırla', icon: '🧹', action: 'clear' },
  { cmd: '/compact', desc: '📦 Bağlamı Sıkıştır: Sohbet geçmişini özetle', icon: '📦', action: 'compact' },
  { cmd: '/tokens', desc: '📊 Token Sayacı: Canlı kullanım durumunu göster', icon: '📊', action: 'tokens' },
  { cmd: '/help', desc: '❓ Komut Rehberi: Tüm komut ve kısayollar', icon: '❓', action: 'help' }
]

export interface InputAreaProps {
  onSendMessage: (text: string, attachments?: UploadedAttachment[]) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  tokenInfo?: { usedTokens?: number; maxTokens?: number; pct?: number }
  attachments?: UploadedAttachment[]
  onUploadFiles?: (files: File[]) => void
  onRemoveAttachment?: (id: string) => void
  isUploading?: boolean
  onOpenMyFiles?: () => void
  onOpenRag?: () => void
  onOpenSkills?: () => void
  onOpenWorkspace?: () => void
  onClearChat?: () => void
  onToggleThinking?: () => void
}

export function InputArea({
  onSendMessage,
  onStop,
  isStreaming,
  disabled,
  tokenInfo,
  attachments = [],
  onUploadFiles,
  onRemoveAttachment,
  isUploading = false,
  onOpenMyFiles,
  onOpenRag,
  onOpenSkills,
  onOpenWorkspace,
  onClearChat,
  onToggleThinking
}: InputAreaProps) {
  const [text, setText] = useState('')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredCommands = UI_SLASH_COMMANDS.filter(c =>
    c.cmd.toLowerCase().startsWith(text.toLowerCase()) || text === '/' || text === ''
  )

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if ((!text.trim() && attachments.length === 0) || isStreaming || disabled || isUploading) return
    onSendMessage(text.trim(), attachments)
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
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault()
      onUploadFiles?.(Array.from(e.clipboardData.files))
    }
  }

  const handleSelectCommand = (c: SlashCommandItem) => {
    setShowSlashMenu(false)
    if (c.action === 'files') {
      setText('')
      onOpenMyFiles?.()
      return
    }
    if (c.action === 'rag') {
      setText('')
      onOpenRag?.()
      return
    }
    if (c.action === 'skills') {
      setText('')
      onOpenSkills?.()
      return
    }
    if (c.action === 'workspace') {
      setText('')
      onOpenWorkspace?.()
      return
    }
    if (c.action === 'clear') {
      setText('')
      if (onClearChat) onClearChat()
      else onSendMessage('/clear')
      return
    }
    if (c.action === 'think') {
      setText('')
      if (onToggleThinking) onToggleThinking()
      else onSendMessage('/think')
      return
    }
    if (c.action === 'compact') {
      setText('')
      onSendMessage('/compact')
      return
    }
    if (c.action === 'tokens') {
      setText('')
      onSendMessage('/tokens')
      return
    }
    if (c.action === 'help') {
      setText('')
      onSendMessage('/help')
      return
    }

    setText(c.cmd)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUploadFiles) {
      onUploadFiles(Array.from(e.target.files))
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="floating-input-pill-wrapper">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="*/*"
      />

      {(attachments.length > 0 || isUploading) && (
        <div className="input-attachments-tray">
          {attachments.map((att) => (
            <div key={att.id} className="input-attachment-chip">
              <span className="att-chip-icon">
                {att.fileCategory === 'spreadsheet' ? (
                  <IconFileSpreadsheet size={15} />
                ) : att.fileCategory === 'image' ? (
                  <IconImage size={15} />
                ) : (
                  <IconFileText size={15} />
                )}
              </span>
              <div className="att-chip-details">
                <span className="att-chip-name" title={att.fileName}>{att.fileName}</span>
                <span className="att-chip-meta">
                  {att.fileCategory === 'spreadsheet' ? 'Tablo (Excel/CSV)' : att.fileCategory === 'image' ? 'Görsel / OCR' : 'Doküman'}
                  {att.fileSize > 0 && ` · ${(att.fileSize / 1024).toFixed(0)} KB`}
                </span>
              </div>
              {onRemoveAttachment && (
                <button
                  type="button"
                  className="btn-remove-att"
                  onClick={() => onRemoveAttachment(att.id)}
                  title="Dosyayı Kaldır"
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
          ))}

          {isUploading && (
            <div className="input-attachment-chip uploading">
              <span className="spinner-mini" />
              <span className="att-chip-name">Dosya yükleniyor & analiz ediliyor...</span>
            </div>
          )}
        </div>
      )}

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
                onClick={() => handleSelectCommand(c)}
              >
                <span className="slash-item-icon">{c.icon}</span>
                <span className="slash-item-cmd">{c.cmd.trim()}</span>
                <span className="slash-item-desc">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <form className="floating-input-pill" onSubmit={handleSubmit}>
        <div className="pill-left-actions">
          <button
            type="button"
            className="btn-pill-icon"
            title="Dosya / Görsel Ekle (Excel, PDF, Resim, Kod)"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconPaperclip size={17} />
          </button>

          <button
            type="button"
            className={`btn-pill-icon ${showSlashMenu ? 'active' : ''}`}
            title="İşlemler & Komut Menüsü (+ veya /)"
            onClick={() => {
              setShowSlashMenu(!showSlashMenu)
              if (!showSlashMenu) {
                textareaRef.current?.focus()
              }
            }}
          >
            <IconPlus size={16} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className="pill-textarea"
          placeholder="Bir görev verin, Excel analiz edin, görsel veya soru yükleyin... (/ ile komutlar)"
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
        />

        <div className="pill-right-actions">
          {isStreaming ? (
            <button
              type="button"
              className="btn-pill-stop"
              onClick={onStop}
              title="Üretimi Durdur"
            >
              <div className="stop-square" />
            </button>
          ) : (
            <button
              type="submit"
              className={`btn-pill-send ${(text.trim() || attachments.length > 0) && !isUploading ? 'active' : ''}`}
              disabled={(!text.trim() && attachments.length === 0) || disabled || isUploading}
              title="Gönder (Enter)"
            >
              <IconSend size={16} />
            </button>
          )}
        </div>
      </form>

      <div className="input-sub-bar">
        <div className="input-sub-hint">
          <span><kbd>Enter</kbd> Gönder</span>
          <span><kbd>Shift+Enter</kbd> Yeni Satır</span>
          <span><kbd>Ctrl+V</kbd> Görsel Yapıştır</span>
          <span><kbd>/</kbd> Komutlar</span>
        </div>

        {tokenInfo && tokenInfo.usedTokens !== undefined && (
          <div className="input-sub-tokens">
            <span className="token-dot" />
            <span>{tokenInfo.usedTokens.toLocaleString()} / {(tokenInfo.maxTokens || 32768).toLocaleString()} tokens</span>
            {tokenInfo.pct !== undefined && <span className="token-pct">({tokenInfo.pct}%)</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function formatMarkdown(text: string): string {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 1. Code blocks (preserve and format)
  const codeBlocks: string[] = []
  html = html.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push(
      `<div class="code-block-wrapper"><div class="code-header"><span class="code-lang">${lang || 'kod'}</span><button class="btn-code-copy" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').innerText);this.innerText='✓ Kopyalandı';setTimeout(()=>this.innerText='Kopyala',2000)">Kopyala</button></div><pre><code>${code}</code></pre></div>`
    )
    return `__CODE_BLOCK_${idx}__`
  })

  // 2. GFM Markdown Tables
  html = html.replace(/((?:^[ \t]*\|.+?\|[ \t]*(?:\r?\n|$)){2,})/gm, (tableBlock) => {
    const lines = tableBlock.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return tableBlock

    const headerCols = lines[0].split('|').slice(1, -1).map(c => c.trim())
    
    let startRow = 1
    if (lines[1] && /^\|(?:[ \t]*:?-+:?[ \t]*\|)+$/.test(lines[1])) {
      startRow = 2
    }

    const headerHtml = `<thead><tr>${headerCols.map(c => `<th>${c}</th>`).join('')}</tr></thead>`
    
    const bodyRows = lines.slice(startRow).map(row => {
      const cols = row.split('|').slice(1, -1).map(c => c.trim())
      return `<tr>${cols.map(c => `<td>${c}</td>`).join('')}</tr>`
    }).join('')

    return `<div class="md-table-wrapper"><table class="md-table">${headerHtml}<tbody>${bodyRows}</tbody></table></div>`
  })

  // 3. Images: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="md-image-wrapper"><img src="$2" alt="$1" class="md-image" /><span class="md-image-caption">$1</span></div>')

  // 4. Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1 ↗</a>')

  // 5. Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // 6. Headings with gradient accents
  html = html.replace(/^#### (.*$)/gim, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>')

  // 7. Blockquotes / Callout Highlights
  html = html.replace(/^>\s*(.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>')

  // 8. Horizontal rules
  html = html.replace(/^(?:---|___|\*\*\*)$/gim, '<hr class="md-hr" />')

  // 9. Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="md-strong">$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // 10. Bullet points
  html = html.replace(/^[\*\-]\s+(.*$)/gim, '<li class="md-list-item">$1</li>')

  // 11. Newlines
  html = html.replace(/\n/g, '<br/>')

  // 12. Restore code blocks
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, block)
  })

  return html
}
