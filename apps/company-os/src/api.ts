export const API_BASE = '/api'

export async function fetchPresets(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/presets`)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : data.presets || []
  } catch (err) {
    console.warn('[CompanyOS] Presets çekilemedi, yerel liste kullanılacak:', err)
    return []
  }
}

export async function savePreset(preset: any): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset })
    })
    return res.ok
  } catch (err) {
    console.error('[CompanyOS] Preset kaydedilemedi:', err)
    return false
  }
}

export async function fetchSkills(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/skills`)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : data.skills || []
  } catch (err) {
    console.warn('[CompanyOS] Skills çekilemedi:', err)
    return []
  }
}

export async function fetchTools(): Promise<Array<{ name: string; description: string }>> {
  try {
    const res = await fetch(`${API_BASE}/tools`)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.warn('[CompanyOS] Tools çekilemedi:', err)
    return []
  }
}

export async function fetchSchedules(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/schedules`)
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : data.schedules || []
  } catch (err) {
    console.warn('[CompanyOS] Schedules çekilemedi:', err)
    return []
  }
}

export async function createSchedule(payload: {
  prompt: string
  preset?: string
  workspace?: string
  after_seconds?: number
  cron?: string
  every_seconds?: number
}): Promise<any> {
  const res = await fetch(`${API_BASE}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`Plan oluşturulamadı: HTTP ${res.status}`)
  return res.json()
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/schedules/${id}`, {
    method: 'DELETE'
  })
  return res.ok
}

export async function triggerSchedule(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/schedules/${encodeURIComponent(id)}/trigger`, {
      method: 'POST'
    })
    return res.ok
  } catch (err) {
    console.error('[CompanyOS] triggerSchedule isteği başarısız oldu:', err)
    return false
  }
}

export async function fetchSessions(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/sessions`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : data.sessions || []
  } catch (err) {
    console.warn('[CompanyOS] Sessions alınamadı:', err)
    return []
  }
}

export async function fetchSession(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/sessions/${id}`)
  if (!res.ok) throw new Error(`Session bulunamadı: HTTP ${res.status}`)
  return res.json()
}

export async function createSession(title: string, workspace?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, workspace })
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `Session oluşturulamadı: HTTP ${res.status}`)
  }
  return res.json()
}

export async function deleteSession(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': 'user_admin' }
    })
    return res.ok
  } catch (err) {
    console.error('[CompanyOS] Session silinemedi:', err)
    return false
  }
}

export async function clearAllSessions(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'DELETE',
      headers: { 'X-User-Id': 'user_admin' }
    })
    return res.ok
  } catch (err) {
    console.error('[CompanyOS] Tüm oturumlar temizlenemedi:', err)
    return false
  }
}

export async function fetchFileContent(filePath: string): Promise<string> {
  try {
    let effectivePath = filePath
    if (!effectivePath.startsWith('/')) {
      effectivePath = `/home/huseyina/code_mode/COMPANY_ABC/${effectivePath}`
    }
    const res = await fetch(`${API_BASE}/files/read?path=${encodeURIComponent(effectivePath)}`)
    if (!res.ok) {
      if (res.status === 404) {
        return `# ℹ️ Rapor Henüz Hazırlanmadı\n\nBu rapor dosyası henüz diskte oluşturulmamış:\n\`${effectivePath}\`\n\nİlgili pozisyona direktif vererek bu raporu hemen oluşturmasını sağlayabilirsiniz.`
      }
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `HTTP ${res.status}`)
    }
    const data = await res.json()
    return data.content || data.data || ''
  } catch (err: any) {
    return `# Hata\nDosya okunamadı: ${err.message}`
  }
}

export async function fetchMcpServers(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/mcp/servers`)
    if (!res.ok) return []
    const data = await res.json()
    return data.servers || []
  } catch (err) {
    console.warn('[CompanyOS] MCP sunucuları çekilemedi:', err)
    return []
  }
}

export async function fetchRagStatus(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/rag/status`)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.warn('[CompanyOS] RAG durumu çekilemedi:', err)
    return null
  }
}

export interface WorkspaceFileItem {
  name: string
  relativePath: string
  fullPath: string
  size: number
  extension: string
}

export async function browseWorkspace(dirPath?: string, options?: { recursive?: boolean }): Promise<{
  current: string
  parent: string
  directories: string[]
  files: string[]
  allFiles?: WorkspaceFileItem[]
} | null> {
  try {
    const res = await fetch(`${API_BASE}/workspace/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath, recursive: options?.recursive })
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.warn('[CompanyOS] Workspace browse hatası:', err)
    return null
  }
}

export interface RagSearchResult {
  score: number
  text: string
  filePath?: string
  chunkIndex?: number
  metadata?: any
}

export interface RagProgress {
  totalFiles: number
  processedFiles: number
  totalChunks: number
  percent: number
  currentFile?: string
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  speedFilesPerSec?: number
  estimatedRemainingSec?: number
}

export async function searchRag(query: string, topK: number = 5, filePathPrefix?: string): Promise<RagSearchResult[]> {
  const res = await fetch(`${API_BASE}/rag/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': 'user_admin' },
    body: JSON.stringify({ query, topK, filePathPrefix })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `RAG arama hatası: HTTP ${res.status}`)
  }
  const data = await res.json()
  const rawResults = data.results || []
  return rawResults.map((r: any) => ({
    score: r.score ?? r.similarity ?? 0,
    text: r.text ?? r.content ?? '',
    filePath: r.filePath ?? r.sourcePath ?? r.metadata?.filePath ?? '',
    chunkIndex: r.chunkIndex,
    metadata: r.metadata
  }))
}

export async function indexRagFolder(folderPath: string, config?: any): Promise<any> {
  const res = await fetch(`${API_BASE}/rag/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': 'user_admin' },
    body: JSON.stringify({ path: folderPath, config })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `RAG indeksleme hatası: HTTP ${res.status}`)
  }
  return res.json()
}

export async function removeRagSource(sourceId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/rag/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': 'user_admin' },
    body: JSON.stringify({ id: sourceId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `RAG kaynak silme hatası: HTTP ${res.status}`)
  }
  return res.json()
}

export async function clearRagAll(): Promise<any> {
  const res = await fetch(`${API_BASE}/rag/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': 'user_admin' }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `RAG temizleme hatası: HTTP ${res.status}`)
  }
  return res.json()
}

export async function getRagProgress(): Promise<RagProgress> {
  const res = await fetch(`${API_BASE}/rag/progress`)
  if (!res.ok) return { totalFiles: 0, processedFiles: 0, totalChunks: 0, percent: 0, status: 'idle' }
  return res.json()
}

export async function pauseRagIndexing(): Promise<any> {
  const res = await fetch(`${API_BASE}/rag/pause`, { method: 'POST' })
  return res.json()
}

export async function resumeRagIndexing(): Promise<any> {
  const res = await fetch(`${API_BASE}/rag/resume`, { method: 'POST' })
  return res.json()
}

export async function cancelRagIndexing(): Promise<any> {
  const res = await fetch(`${API_BASE}/rag/cancel`, { method: 'POST' })
  return res.json()
}

export async function updateRagConfig(config: any): Promise<any> {
  const res = await fetch(`${API_BASE}/rag/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  return res.json()
}

export async function searchRagImages(textQuery?: string, imagePath?: string, topK: number = 6): Promise<any[]> {
  const res = await fetch(`${API_BASE}/rag/search-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': 'user_admin' },
    body: JSON.stringify({ textQuery, imagePath, topK })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Görsel RAG arama hatası: HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.results || []
}

export async function toggleRagMode(enabled: boolean): Promise<any> {
  const res = await fetch(`${API_BASE}/rag/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  })
  return res.json()
}

export async function updateRagPermissions(sourceId: string, allowedUserIds: string[], isPublic: boolean): Promise<any> {
  const res = await fetch(`${API_BASE}/rag/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': 'user_admin' },
    body: JSON.stringify({ sourceId, allowedUserIds, isPublic })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `İzin güncelleme hatası: HTTP ${res.status}`)
  }
  return res.json()
}

export async function setWorkspaceApi(path: string, sessionId?: string, isGlobal: boolean = true): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/workspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'user_admin' },
      body: JSON.stringify({ path, sessionId, global: isGlobal })
    })
    return await res.json()
  } catch (err) {
    console.warn('[CompanyOS] Workspace API set error:', err)
    return null
  }
}

export async function fetchUsers(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: { 'X-User-Id': 'user_admin' }
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.users || []
  } catch (err) {
    console.warn('[CompanyOS] Kullanıcılar çekilemedi:', err)
    return []
  }
}

export async function fetchAuditLogs(filter?: {
  positionId?: string
  actionType?: string
  traceId?: string
  sessionId?: string
  limit?: number
}): Promise<any[]> {
  try {
    const params = new URLSearchParams()
    if (filter?.positionId) params.append('positionId', filter.positionId)
    if (filter?.actionType) params.append('actionType', filter.actionType)
    if (filter?.traceId) params.append('traceId', filter.traceId)
    if (filter?.sessionId) params.append('sessionId', filter.sessionId)
    if (filter?.limit) params.append('limit', String(filter.limit))

    const res = await fetch(`${API_BASE}/audit/logs?${params.toString()}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.logs || []
  } catch (err) {
    console.warn('[CompanyOS] Audit logları çekilemedi:', err)
    return []
  }
}

export function getAuditExportUrl(filter?: { positionId?: string; actionType?: string }): string {
  const params = new URLSearchParams()
  if (filter?.positionId) params.append('positionId', filter.positionId)
  if (filter?.actionType) params.append('actionType', filter.actionType)
  return `${API_BASE}/audit/logs/export?${params.toString()}`
}

export async function fetchTrace(traceId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/trace/${encodeURIComponent(traceId)}`)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.warn('[CompanyOS] Trace bilgisi çekilemedi:', err)
    return null
  }
}

export async function fetchTraceGraph(traceId: string): Promise<{ nodes: any[]; edges: any[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/trace/${encodeURIComponent(traceId)}/graph`)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.warn('[CompanyOS] Trace grafiği çekilemedi:', err)
    return null
  }
}

