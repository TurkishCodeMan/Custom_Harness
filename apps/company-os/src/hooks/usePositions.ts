import { useState, useEffect, useCallback } from 'react'
import type { Position } from '../types.js'
import { SEED_PRESETS } from '../defaultPositions.js'
import { fetchPresets, savePreset, deletePreset } from '../api.js'

// Backend'den gelen preset'i Position tipine dönüştür
function presetToPosition(preset: any): Position {
  // Icon'u smart fallback ile belirle
  const icon = preset.icon || (() => {
    const id = (preset.id || '').toLowerCase()
    if (id === 'ceo') return '👑'
    if (id.includes('cfo') || id.includes('finans')) return '📊'
    if (id.includes('kalite') || id.includes('iade')) return '🛡️'
    if (id.includes('tedarik') || id.includes('satin')) return '📦'
    if (id === 'full-stack' || id.includes('cto') || id.includes('tekno')) return '💻'
    if (id.includes('invoice')) return '👔'
    if (id.includes('fast') || id === 'fast-coder') return '⚡'
    if (id.includes('review') || id.includes('architect')) return '🔍'
    return '🤖'
  })()

  return {
    id: preset.id,
    title: preset.name || preset.id,
    role: preset.description || 'AI Teammate',
    icon,
    level: (preset.level as any) || 2,
    presetId: preset.id,
    parentId: preset.parentId,
    workspace: preset.workspace || '/home/huseyina/code_mode/COMPANY_ABC',
    tools: Array.isArray(preset.enabledTools) ? preset.enabledTools : (Array.isArray(preset.tools) ? preset.tools : []),
    skills: Array.isArray(preset.enabledSkills) ? preset.enabledSkills : [],
    specialization: preset.specialization || preset.description,
    systemPrompt: preset.systemPrompt || '',
    modelId: preset.modelId || undefined,
    providerId: preset.providerId || undefined,
    temperature: typeof preset.temperature === 'number' ? preset.temperature : undefined,
    responseFormat: preset.responseFormat || undefined,
    maxTurns: typeof preset.maxTurns === 'number' ? preset.maxTurns : undefined,
    status: 'idle',
    currentAction: preset.currentAction || 'Hazır',
    fileScope: preset.fileScope || preset.contract?.fileScope,
    // Phase 2: Contract-Safe Agent Runtime & Delegation Mesh
    isCallableByAgents: preset.isCallableByAgents ?? (preset.contract?.isCallableByAgents ?? !!preset.inputSchema),
    allowedDelegates: preset.allowedDelegates || preset.contract?.allowedDelegates || [],
    allowedCallers: preset.allowedCallers || preset.contract?.allowedCallers || [],
    inputSchema: preset.inputSchema || preset.contract?.inputSchema,
    outputSchema: preset.outputSchema || preset.contract?.outputSchema,
    contract: preset.contract || (preset.inputSchema ? {
      contractVersion: 1,
      isCallableByAgents: preset.isCallableByAgents ?? !!preset.inputSchema,
      inputSchema: preset.inputSchema,
      outputSchema: preset.outputSchema,
      allowedDelegates: preset.allowedDelegates,
      allowedCallers: preset.allowedCallers
    } : undefined)
  }
}

// Position'ı kaydetmek için preset formatına çevir
function positionToPreset(pos: Position): any {
  return {
    id: pos.id,
    name: pos.title,
    description: pos.role,
    icon: pos.icon,
    level: pos.level,
    parentId: pos.parentId,
    workspace: pos.workspace,
    systemPrompt: pos.systemPrompt,
    enabledTools: pos.tools,
    enabledSkills: pos.skills || [],
    specialization: pos.specialization,
    currentAction: pos.currentAction,
    modelId: pos.modelId || undefined,
    providerId: pos.providerId || undefined,
    temperature: typeof pos.temperature === 'number' ? pos.temperature : undefined,
    responseFormat: pos.responseFormat || undefined,
    maxTurns: typeof pos.maxTurns === 'number' ? pos.maxTurns : undefined,
    // Phase 2: Contract-Safe Agent Runtime & Delegation Mesh
    isCallableByAgents: pos.isCallableByAgents,
    allowedDelegates: pos.allowedDelegates,
    allowedCallers: pos.allowedCallers,
    inputSchema: pos.inputSchema,
    outputSchema: pos.outputSchema,
    contract: pos.contract,
    fileScope: pos.fileScope
  }
}

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Backend'den presetleri yükle — bu tek kaynak
  const loadFromBackend = useCallback(async () => {
    try {
      const backendPresets = await fetchPresets()
      if (Array.isArray(backendPresets) && backendPresets.length > 0) {
        const mapped = backendPresets.map(presetToPosition)
        setPositions(mapped)
        setIsLoaded(true)
        return
      }
    } catch (err) {
      console.warn('[usePositions] Backend presetleri yüklenemedi:', err)
    }

    // Backend boşsa ilk çalışma: seed presetleri backend'e yaz ve kullan
    setIsLoaded(true)
    setPositions(SEED_PRESETS.map(presetToPosition))
    for (const preset of SEED_PRESETS) {
      savePreset(preset).catch(() => {})
    }
  }, [])

  useEffect(() => {
    loadFromBackend()
  }, [loadFromBackend])

  // Runtime status güncellemeleri — sadece memory'de, backend'e yazılmaz
  const updatePositionStatus = (
    posId: string,
    status: Position['status'],
    action?: string,
    report?: { title: string; path: string; date: string }
  ) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id === posId) {
          return {
            ...p,
            status,
            currentAction: action !== undefined ? action : p.currentAction,
            lastActive: Date.now(),
            ...(report ? { lastReport: report } : {})
          }
        }
        return p
      })
    )
  }

  const handleAddPosition = async (newPos: Position) => {
    // 1. Backend'e kaydet
    await savePreset(positionToPreset(newPos))
    // 2. Backend'den taze listeyi çek
    await loadFromBackend()
  }

  const handleUpdatePosition = async (updated: Position) => {
    // 1. Backend'e kaydet
    await savePreset(positionToPreset(updated))
    // 2. Anında UI'da güncelle (optimistic)
    setPositions((prev) => prev.map((p) => (p.id === updated.id ? { ...updated } : p)))
  }

  const handleDeletePosition = async (posId: string) => {
    // 1. Önce UI'dan kaldır (optimistic)
    setPositions((prev) => prev.filter((p) => p.id !== posId))
    // 2. Backend'den sil
    await deletePreset(posId)
  }

  return {
    positions,
    setPositions,
    isLoaded,
    loadFromBackend,
    updatePositionStatus,
    handleAddPosition,
    handleUpdatePosition,
    handleDeletePosition
  }
}
