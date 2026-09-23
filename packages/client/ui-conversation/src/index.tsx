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
  isInternal?: boolean
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

  // Intelligently group consecutive assistant and tool turns into a single unified bubble per round
  const groupedTimelineMessages = React.useMemo(() => {
    const result: (ChatMessageItem & { key: string })[] = []
    let currentAssistantGroup: (ChatMessageItem & { key: string }) | null = null


    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const key = `msg-${i}`

      // Skip internal messages (e.g. Ralph Loop rounds or internal agent runs)
      if (msg.isInternal || msg.content?.includes('[RALPH LOOP - ROUND')) {
        continue
      }

      if (msg.compactionInfo) {
        if (currentAssistantGroup) {
          result.push(currentAssistantGroup)
          currentAssistantGroup = null
        }
        result.push({ ...msg, key })
        continue
      }

      if (msg.role === 'user') {
        if (currentAssistantGroup) {
          result.push(currentAssistantGroup)
          currentAssistantGroup = null
        }
        result.push({ ...msg, key })
        continue
      }

      if (msg.role === 'assistant' || msg.role === 'tool') {
        if (!currentAssistantGroup) {
          currentAssistantGroup = {
            role: 'assistant',
            content: msg.content || '',
            reasoning_content: msg.reasoning_content || '',
            presetName: msg.presetName,
            isStreaming: msg.isStreaming,
            tool_calls: msg.tool_calls ? [...msg.tool_calls] : [],
            toolResults: msg.toolResults
              ? [...msg.toolResults]
              : (msg.role === 'tool'
                ? [{
                    id: (msg as any).tool_call_id || `tool-${i}`,
                    name: (msg as any).name || 'Tool Result',
                    output: msg.content,
                    status: 'done' as const
                  }]
                : []),
            key: `asst-group-${i}`
          }
        } else {
          // Merge consecutive assistant/tool turns into single bubble
          if (msg.role === 'assistant') {
            if (msg.content) {
              const prevText = currentAssistantGroup.content ? currentAssistantGroup.content.trim() : ''
              const nextText = msg.content.trim()
              if (nextText) {
                currentAssistantGroup.content = prevText 
                  ? `${prevText}\n\n${nextText}`
                  : nextText
              }
            }
            if (msg.reasoning_content) {
              currentAssistantGroup.reasoning_content = currentAssistantGroup.reasoning_content
                ? `${currentAssistantGroup.reasoning_content}\n\n${msg.reasoning_content}`
                : msg.reasoning_content
            }
            if (msg.tool_calls && msg.tool_calls.length > 0) {
              const existingCalls = currentAssistantGroup.tool_calls ? [...currentAssistantGroup.tool_calls] : []
              for (const tc of msg.tool_calls) {
                const tcId = tc.id || (tc.function?.name || tc.name)
                if (!existingCalls.some(c => (c.id || c.function?.name || c.name) === tcId)) {
                  existingCalls.push(tc)
                }
              }
              currentAssistantGroup.tool_calls = existingCalls
            }
            if (msg.toolResults && msg.toolResults.length > 0) {
              const existingTools = currentAssistantGroup.toolResults ? [...currentAssistantGroup.toolResults] : []
              for (const tr of msg.toolResults) {
                const exIdx = existingTools.findIndex(t => t.id === tr.id)
                if (exIdx >= 0) {
                  existingTools[exIdx] = { ...existingTools[exIdx], ...tr }
                } else {
                  existingTools.push({ ...tr })
                }
              }
              currentAssistantGroup.toolResults = existingTools
            }
            if (msg.presetName) {
              currentAssistantGroup.presetName = msg.presetName
            }
            if (msg.isStreaming !== undefined) {
              currentAssistantGroup.isStreaming = msg.isStreaming
            }
          } else if (msg.role === 'tool') {
            const toolId = (msg as any).tool_call_id || `tool-${i}`
            const toolName = (msg as any).name || 'Tool Result'
            const existingTools = currentAssistantGroup.toolResults ? [...currentAssistantGroup.toolResults] : []
            const exIdx = existingTools.findIndex(t => t.id === toolId)
            if (exIdx >= 0) {
              existingTools[exIdx] = {
                ...existingTools[exIdx],
                output: msg.content,
                status: 'done'
              }
            } else {
              existingTools.push({
                id: toolId,
                name: toolName,
                output: msg.content,
                status: 'done'
              })
            }
            currentAssistantGroup.toolResults = existingTools
          }
        }
      }
    }

    if (currentAssistantGroup) {
      result.push(currentAssistantGroup)
    }

    return result
  }, [messages])

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
            ArtificaX Enterprise GPT ile otonom kodlama, veri analizi ve mimari planlama parmaklarınızın ucunda.
          </p>
        </div>
      ) : (
        <div className="chat-messages-timeline">
          {groupedTimelineMessages.map((msg, index) => {
            if (msg.compactionInfo) {
              return <CompactionCard key={`compaction-${index}`} info={msg.compactionInfo} />
            }

            if (msg.role === 'user') {
              return (
                <UserMessageBubble
                  key={msg.key || `user-${index}`}
                  content={msg.content || ''}
                  attachments={msg.attachments}
                />
              )
            }

            if (msg.role === 'assistant') {
              return (
                <AssistantMessageBubble
                  key={msg.key || `asst-${index}`}
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

          <div ref={bottomRef} style={{ height: 12 }} />
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

  // Combine tool_calls and toolResults into a single, deduplicated, ordered list
  const unifiedTools = React.useMemo(() => {
    const list: UnifiedToolItem[] = []
    const indexMap = new Map<string, number>()

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const tc of message.tool_calls) {
        const id = tc.id || `tc-${tc.function?.name || tc.name}`
        const name = tc.function?.name || tc.name || 'Bilinmeyen Araç'
        const args = tc.function?.arguments || tc.args
        const item: UnifiedToolItem = {
          id,
          name,
          args,
          status: message.isStreaming ? 'running' : 'done'
        }
        indexMap.set(id, list.length)
        indexMap.set(name, list.length)
        list.push(item)
      }
    }

    if (message.toolResults && message.toolResults.length > 0) {
      for (const tr of message.toolResults) {
        const targetIdx = indexMap.has(tr.id)
          ? indexMap.get(tr.id)!
          : (indexMap.has(tr.name) ? indexMap.get(tr.name)! : -1)

        if (targetIdx >= 0 && list[targetIdx]) {
          const existing = list[targetIdx]
          if (tr.output !== undefined) existing.output = tr.output
          if (tr.args && !existing.args) existing.args = tr.args
          if (tr.status && tr.status !== 'running') {
            existing.status = tr.status
          } else if (existing.output !== undefined || tr.output !== undefined) {
            existing.status = 'done'
          } else if (tr.status) {
            existing.status = tr.status
          }
        } else {
          const hasOutput = tr.output !== undefined && tr.output !== null
          const item: UnifiedToolItem = {
            id: tr.id,
            name: tr.name || 'Bilinmeyen Araç',
            args: tr.args,
            output: tr.output,
            status: hasOutput ? 'done' : (tr.status || (message.isStreaming ? 'running' : 'done'))
          }
          indexMap.set(tr.id, list.length)
          list.push(item)
        }
      }
    }

    return list.map((item) => {
      const hasOutput = item.output !== undefined && item.output !== null
      const isFinished = hasOutput || !message.isStreaming
      let status = item.status
      if (isFinished && status === 'running') {
        status = 'done'
      }
      return {
        ...item,
        status
      }
    })
  }, [message.tool_calls, message.toolResults, message.isStreaming])

  // 🧠 Extract inline <thought> / <think> tags from content if present (e.g. Gemma, DeepSeek, Qwen)
  let displayContent = (message.content || '').trim()
  let displayReasoning = (message.reasoning_content || '').trim()

  if (displayContent && (displayContent.includes('<thought') || displayContent.includes('<think') || displayContent.includes('<commentary'))) {
    const thoughtRegex = /<(?:thought|think|commentary)(?:>|[\s\n\r])([\s\S]*?)(?:<\/(?:thought|think|commentary)>|$)/gi
    let match: RegExpExecArray | null
    const extracted: string[] = []
    while ((match = thoughtRegex.exec(displayContent)) !== null) {
      const inner = match[1].replace(/<\/?(?:thought|think|commentary)(?:>|[\s\n\r])?/gi, '').trim()
      if (inner) extracted.push(inner)
    }
    if (extracted.length > 0) {
      displayReasoning = displayReasoning ? `${displayReasoning}\n\n${extracted.join('\n\n')}` : extracted.join('\n\n')
      displayContent = displayContent.replace(/<(?:thought|think|commentary)(?:>|[\s\n\r])[\s\S]*?(?:<\/(?:thought|think|commentary)>|$)/gi, '').trim()
    }
  }

  const hasRunningTools = unifiedTools.some(t => t.status === 'running')
  const hasTools = unifiedTools.length > 0
  const isPending = message.isStreaming && !displayContent && !displayReasoning && !hasRunningTools && !hasTools

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
        {displayReasoning ? (
          <ThinkingBlock reasoning={displayReasoning} isStreaming={message.isStreaming} />
        ) : null}

        {/* Unified Tool Execution Cards */}
        {hasTools && (
          <div className="unified-tools-list">
            {unifiedTools.map((t, idx) => (
              <UnifiedToolCard key={t.id || `tool-${idx}`} tool={t} />
            ))}
          </div>
        )}

        {/* Assistant Markdown Content */}
        {displayContent ? (
          <div
            className="assistant-content-markdown"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(displayContent) }}
          />
        ) : isPending ? (
          <div className="streaming-cursor-loader">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        ) : null}

        {displayContent && (
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

export interface UnifiedToolItem {
  id: string
  name: string
  args?: any
  output?: any
  status: 'running' | 'done' | 'error'
}

export function UnifiedToolCard({ tool }: { tool: UnifiedToolItem }) {
  const [isOpen, setIsOpen] = useState(false)

  // Extract a concise 1-line argument summary for the header chip
  let argsSummary = ''
  if (tool.args) {
    try {
      const parsed = typeof tool.args === 'string' ? JSON.parse(tool.args) : tool.args
      if (typeof parsed === 'object' && parsed !== null) {
        const keys = Object.keys(parsed)
        if (keys.length === 1) {
          const val = String(parsed[keys[0]])
          argsSummary = `${keys[0]}="${val.length > 35 ? val.substring(0, 32) + '...' : val}"`
        } else if (keys.length > 1) {
          const firstKey = keys[0]
          const val = String(parsed[firstKey])
          argsSummary = `${firstKey}="${val.length > 25 ? val.substring(0, 22) + '...' : val}" (+${keys.length - 1})`
        }
      } else if (typeof parsed === 'string') {
        argsSummary = parsed.length > 35 ? parsed.substring(0, 32) + '...' : parsed
      }
    } catch {
      if (typeof tool.args === 'string') {
        argsSummary = tool.args.length > 35 ? tool.args.substring(0, 32) + '...' : tool.args
      }
    }
  }

  let formattedArgs = ''
  if (tool.args) {
    try {
      const parsed = typeof tool.args === 'string' ? JSON.parse(tool.args) : tool.args
      formattedArgs = JSON.stringify(parsed, null, 2)
    } catch {
      formattedArgs = String(tool.args)
    }
  }

  let formattedOutput = ''
  if (tool.output !== undefined && tool.output !== null) {
    try {
      const parsed = typeof tool.output === 'string' ? JSON.parse(tool.output) : tool.output
      formattedOutput = typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed)
    } catch {
      formattedOutput = String(tool.output)
    }
  }

  const hasOutput = tool.output !== undefined && tool.output !== null
  const effectiveStatus = (tool.status === 'running' && hasOutput) ? 'done' : tool.status
  const isRunning = effectiveStatus === 'running' && !hasOutput
  const isError = effectiveStatus === 'error'

  const isSubagent = tool.name === 'invoke_subagent'
  let subagentTaskName = ''
  let subagentPreset = ''
  let subagentResult = ''
  let subagentDuration = ''

  if (isSubagent) {
    try {
      const pArgs = typeof tool.args === 'string' ? JSON.parse(tool.args) : tool.args
      subagentTaskName = pArgs?.taskName || ''
      subagentPreset = pArgs?.preset || ''
    } catch {}

    try {
      const pOut = typeof tool.output === 'string' ? JSON.parse(tool.output) : tool.output
      if (pOut?.result) {
        subagentResult = pOut.result
      }
      if (pOut?.durationSeconds) {
        subagentDuration = `${pOut.durationSeconds}s`
      }
    } catch {}
  }

  return (
    <div className={`unified-tool-card ${effectiveStatus} ${isOpen ? 'open' : 'closed'} ${isSubagent ? 'subagent-card' : ''}`}>
      <div className="unified-tool-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="unified-tool-left">
          {isSubagent ? (
            <>
              <span className="unified-tool-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.18)', borderColor: 'rgba(99, 102, 241, 0.45)' }}>
                {isRunning ? (
                  <span className="tool-spinner-ring" />
                ) : isError ? (
                  <span className="tool-status-error">✕</span>
                ) : (
                  <span style={{ fontSize: '13px' }}>🤖</span>
                )}
              </span>
              <span className="unified-tool-label" style={{ color: '#818cf8', fontWeight: 600 }}>Alt Ajan:</span>
              <code className="unified-tool-name" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.35)' }}>
                {subagentPreset || 'novatrend-subagent'}
              </code>
              {subagentTaskName && (
                <span className="unified-tool-args-preview" title={subagentTaskName} style={{ color: '#c7d2fe', fontWeight: 500 }}>
                  {subagentTaskName}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="unified-tool-icon-wrap">
                {isRunning ? (
                  <span className="tool-spinner-ring" />
                ) : isError ? (
                  <span className="tool-status-error">✕</span>
                ) : (
                  <IconTerminal size={12} className="tool-icon-term" />
                )}
              </span>
              <span className="unified-tool-label">Araç:</span>
              <code className="unified-tool-name">{tool.name}</code>
              {argsSummary && (
                <span className="unified-tool-args-preview" title={typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args)}>
                  {argsSummary}
                </span>
              )}
            </>
          )}
        </div>

        <div className="unified-tool-right">
          <span className={`unified-tool-badge ${effectiveStatus}`}>
            {isRunning ? 'Çalışıyor...' : isError ? 'Hata' : 'Tamamlandı'}
          </span>
          <span className={`unified-tool-arrow ${isOpen ? 'open' : ''}`}>
            <IconChevronDown size={12} />
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="unified-tool-body">
          {formattedArgs && !isSubagent && (
            <div className="unified-tool-section">
              <div className="unified-tool-section-label">Parametreler (Girdi)</div>
              <pre className="unified-tool-pre"><code>{formattedArgs}</code></pre>
            </div>
          )}

          {isSubagent && subagentResult ? (
            <div className="unified-tool-section subagent-result-section">
              <div className="unified-tool-section-label" style={{ display: 'flex', justifyContent: 'space-between', color: '#a5b4fc', marginBottom: '6px' }}>
                <span>Alt Ajan Bulguları ve Raporu</span>
                {subagentDuration && <span style={{ opacity: 0.75 }}>Süre: {subagentDuration}</span>}
              </div>
              <div
                className="subagent-markdown-content"
                style={{
                  padding: '12px 16px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#e2e8f0',
                  maxHeight: '420px',
                  overflowY: 'auto'
                }}
                dangerouslySetInnerHTML={{ __html: formatMarkdown(subagentResult) }}
              />
            </div>
          ) : hasOutput ? (
            <div className="unified-tool-section">
              <div className="unified-tool-section-label">Sonuç (Çıktı)</div>
              <pre className="unified-tool-pre"><code>{formattedOutput || '(Boş çıktı / Başarılı)'}</code></pre>
            </div>
          ) : isRunning ? (
            <div className="unified-tool-section running-notice">
              <span className="tool-spinner-ring" />
              <span>{isSubagent ? 'Alt ajan araştırmasını yürütüyor, sonuç bekleniyor...' : 'Komut yürütülüyor, sonuç bekleniyor...'}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// Backwards-compatibility wrapper
export function ToolCallCard({ call }: { call: any }) {
  const fnName = call.function?.name || call.name || 'Bilinmeyen Araç'
  return <UnifiedToolCard tool={{ id: call.id || 'tc', name: fnName, args: call.function?.arguments || call.args, status: 'done' }} />
}

// Backwards-compatibility wrapper
export function ToolResultCard({ result }: { result: ToolResultItem }) {
  return <UnifiedToolCard tool={{ id: result.id, name: result.name, args: result.args, output: result.output, status: result.status || 'done' }} />
}

export function CompactionCard({ info }: { info: { messageCount: number; summary: string } }) {
  const [isOpen, setIsOpen] = useState(false)

  // Clean summary of any leaked prompt headers if present in older records
  const cleanText = (info.summary || '')
    .replace(/^\[GEÇMİŞ BAĞLAM[^\]]*\]:?\s*/i, '')
    .replace(/\(Konuşma kesintisiz devam etmektedir[^)]*\)/gi, '')
    .trim()

  return (
    <div className="compaction-banner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '14px 0' }}>
      <div
        className="compaction-badge"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '20px',
          background: 'rgba(147, 51, 234, 0.14)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          color: '#d8b4fe',
          fontSize: '12px',
          boxShadow: '0 2px 10px rgba(147, 51, 234, 0.15)'
        }}
        title="Arşiv detaylarını göster/gizle"
      >
        <span style={{ fontSize: '14px' }}>📦</span>
        <span style={{ fontWeight: 600, color: '#f3e8ff' }}>Bağlam Sıkıştırıldı</span>
        <span style={{ opacity: 0.85 }}>· {info.messageCount} mesaj arşivlendi</span>
        <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.7 }}>{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && cleanText && (
        <div
          style={{
            marginTop: '8px',
            maxWidth: '680px',
            width: '90%',
            background: 'rgba(147, 51, 234, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '11.5px',
            color: '#e9d5ff',
            lineHeight: '1.6',
            whiteSpace: 'pre-line',
            textAlign: 'left'
          }}
        >
          {cleanText}
        </div>
      )}
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
            <span>{tokenInfo.usedTokens.toLocaleString()} / {(tokenInfo.maxTokens || 24576).toLocaleString()} tokens</span>
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

  // Normalize line endings
  html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 1. Code blocks (preserve and format)
  const codeBlocks: string[] = []
  html = html.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push(
      `<div class="code-block-wrapper"><div class="code-header"><span class="code-lang">${lang || 'kod'}</span><button class="btn-code-copy" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').innerText);this.innerText='✓ Kopyalandı';setTimeout(()=>this.innerText='Kopyala',2000)">Kopyala</button></div><pre><code>${code}</code></pre></div>`
    )
    return `\n__CODE_BLOCK_${idx}__\n`
  })

  // 2. GFM Markdown Tables
  html = html.replace(/((?:^[ \t]*\|.+?\|[ \t]*(?:\n|$)){2,})/gm, (tableBlock) => {
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

    return `\n<div class="md-table-wrapper"><table class="md-table">${headerHtml}<tbody>${bodyRows}</tbody></table></div>\n`
  })

  // 3. Images: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '\n<div class="md-image-wrapper"><img src="$2" alt="$1" class="md-image" /><span class="md-image-caption">$1</span></div>\n')

  // 4. Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1 ↗</a>')

  // 5. Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // 6. Headings with gradient accents
  html = html.replace(/^#### (.*$)/gim, '\n<h4 class="md-h4">$1</h4>\n')
  html = html.replace(/^### (.*$)/gim, '\n<h3 class="md-h3">$1</h3>\n')
  html = html.replace(/^## (.*$)/gim, '\n<h2 class="md-h2">$1</h2>\n')
  html = html.replace(/^# (.*$)/gim, '\n<h1 class="md-h1">$1</h1>\n')

  // 7. Blockquotes / Callout Highlights
  html = html.replace(/^>\s*(.*$)/gim, '\n<blockquote class="md-blockquote">$1</blockquote>\n')

  // 8. Horizontal rules
  html = html.replace(/^(?:---|___|\*\*\*)$/gim, '\n<hr class="md-hr" />\n')

  // 9. Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="md-strong">$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // 10. Bullet points (wrap in <ul> and remove inner newlines)
  html = html.replace(/^[\*\-]\s+(.*$)/gim, '<li class="md-list-item">$1</li>')
  html = html.replace(/((?:<li class="md-list-item">[\s\S]*?<\/li>\s*)+)/g, (_m, listItems) => {
    const cleanItems = listItems.replace(/\n+/g, '')
    return `\n<ul class="md-list">${cleanItems}</ul>\n`
  })

  // 11. Clean up newlines around block elements so they NEVER get <br/>
  const blockTags = 'h[1-6]|blockquote|hr|div|ul|ol|li|table|thead|tbody|tr|th|td|__CODE_BLOCK_\\d+__'
  const openOrCloseBlockRegex = new RegExp(`\\n*(<\\/?(?:${blockTags})[^>]*>)\\n*`, 'gi')
  html = html.replace(openOrCloseBlockRegex, '$1')

  // 12. Collapse excessive consecutive newlines in remaining inline text
  html = html.replace(/\n{3,}/g, '\n\n')

  // 13. Convert paragraph breaks (\n\n) to a single <br/> with clean line spacing, or single \n to <br/>
  html = html.replace(/\n\n/g, '<br/><br/>')
  html = html.replace(/\n/g, '<br/>')

  // 14. Purge any accidental <br/> adjacent to block elements
  html = html.replace(/(?:<br\s*\/?>\s*)+(<\/?(?:h[1-6]|blockquote|hr|div|ul|ol|li|table|thead|tbody|tr|th|td)[^>]*>)/gi, '$1')
  html = html.replace(/(<\/?(?:h[1-6]|blockquote|hr|div|ul|ol|li|table|thead|tbody|tr|th|td)[^>]*>)(?:\s*<br\s*\/?>)+/gi, '$1')
  // Collapse 3 or more consecutive <br/> into at most 2 (standard paragraph break)
  html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br/><br/>')

  // 15. Restore code blocks
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, block)
  })

  // Clean any <br/> touching code-block-wrapper
  html = html.replace(/(?:<br\s*\/?>\s*)+(<div class="code-block-wrapper">)/gi, '$1')
  html = html.replace(/(<\/div>)(?:\s*<br\s*\/?>)+(?=\s*<div class="code-block-wrapper">|$)/gi, '$1')

  return html.trim()
}
