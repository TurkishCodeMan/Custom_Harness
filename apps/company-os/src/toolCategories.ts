export type ToolCategory =
  | 'all'
  | 'fs'
  | 'terminal'
  | 'planning'
  | 'subagent'
  | 'schedule'
  | 'rag_web'
  | 'mcp_skills'

export interface ToolClassMeta {
  id: ToolCategory
  label: string
  icon: string
  color: string
  badgeBg: string
}

export const TOOL_CLASSES: ToolClassMeta[] = [
  { id: 'all', label: 'Tümü', icon: '🌐', color: '#818cf8', badgeBg: 'rgba(99, 102, 241, 0.15)' },
  { id: 'fs', label: 'Dosya & Kod', icon: '📁', color: '#38bdf8', badgeBg: 'rgba(56, 189, 248, 0.15)' },
  { id: 'terminal', label: 'Terminal & Komut', icon: '💻', color: '#34d399', badgeBg: 'rgba(52, 211, 153, 0.15)' },
  { id: 'planning', label: 'Otonom & Plan', icon: '🧠', color: '#fbbf24', badgeBg: 'rgba(251, 191, 36, 0.15)' },
  { id: 'subagent', label: 'Alt Ajanlar', icon: '🤖', color: '#a855f7', badgeBg: 'rgba(168, 85, 247, 0.15)' },
  { id: 'schedule', label: 'Zamanlayıcı', icon: '⏰', color: '#f43f5e', badgeBg: 'rgba(244, 63, 94, 0.15)' },
  { id: 'rag_web', label: 'RAG & Web', icon: '🔍', color: '#06b6d4', badgeBg: 'rgba(6, 182, 212, 0.15)' },
  { id: 'mcp_skills', label: 'MCP & Entegrasyon', icon: '🔌', color: '#ec4899', badgeBg: 'rgba(236, 72, 153, 0.15)' },
]

// Basit ve dinamik kategori eşleştirme kuralları
const CATEGORY_MATCHERS: Array<{ category: ToolCategory; match: RegExp }> = [
  { category: 'mcp_skills', match: /^(mcp|skill|query_session)/i },
  { category: 'rag_web', match: /(rag|folder|image|web_)/i },
  { category: 'schedule', match: /^schedule/i },
  { category: 'subagent', match: /subagent/i },
  { category: 'planning', match: /(goal|todo|reflection|plan|ralph|workflow)/i },
  { category: 'terminal', match: /(bash|terminal|job)/i },
  { category: 'fs', match: /(read|write|edit|file|dir|grep|diff|lsp)/i },
]

export function getToolCategory(toolName: string): ToolCategory {
  const found = CATEGORY_MATCHERS.find(m => m.match.test(toolName))
  return found ? found.category : 'fs'
}

export function getToolCategoryMeta(toolName: string): ToolClassMeta {
  const cat = getToolCategory(toolName)
  return TOOL_CLASSES.find(c => c.id === cat) || TOOL_CLASSES[1]
}
