import { useState, useEffect } from 'react'
import type { Position } from '../types.js'
import { INITIAL_POSITIONS, REPORTING_GUARDRAIL } from '../defaultPositions.js'
import { savePreset } from '../api.js'

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>(() => {
    try {
      const saved = localStorage.getItem('company_os_positions_v7') || localStorage.getItem('company_os_positions_v6')
      if (saved) {
        const parsed: Position[] = JSON.parse(saved)
        return parsed.map((p) => {
          const defaultPos = INITIAL_POSITIONS.find((dp) => dp.id === p.id)
          const mergedTools = Array.from(new Set([...(p.tools || []), ...(defaultPos?.tools || [])]))
          let prompt = defaultPos?.systemPrompt || p.systemPrompt || ''
          if (!prompt.includes('RAPOR BİTTİ')) {
            prompt = prompt ? `${prompt}\n\n${REPORTING_GUARDRAIL}` : (defaultPos?.systemPrompt || REPORTING_GUARDRAIL)
          }
          const effectiveWorkspace =
            (p.workspace === '/home/huseyina/code_mode/COMPANY_ABC' || p.workspace === '/home/huseyina/code_mode/custom-harness') &&
            defaultPos &&
            defaultPos.id !== 'ceo'
              ? defaultPos.workspace
              : (p.workspace || defaultPos?.workspace || '/home/huseyina/code_mode/COMPANY_ABC')

          return {
            ...p,
            tools: mergedTools,
            workspace: effectiveWorkspace,
            specialization: defaultPos ? defaultPos.specialization : p.specialization,
            systemPrompt: prompt
          }
        })
      }
    } catch (e) {
      console.warn('[CompanyOS] LocalStorage okuma hatası:', e)
    }
    return INITIAL_POSITIONS
  })

  // Save positions locally
  useEffect(() => {
    try {
      localStorage.setItem('company_os_positions_v7', JSON.stringify(positions))
    } catch (err) {
      console.warn('[CompanyOS] LocalStorage yazma hatası:', err)
    }
  }, [positions])

  // Sync presets with backend
  useEffect(() => {
    positions.forEach((pos) => {
      if (pos.presetId && pos.systemPrompt) {
        savePreset({
          id: pos.presetId,
          name: pos.title,
          description: pos.role,
          systemPrompt: pos.systemPrompt,
          enabledTools: pos.tools,
          enabledSkills: pos.skills || []
        }).catch((err) => console.warn(`[CompanyOS] Preset sync error (${pos.presetId}):`, err))
      }
    })
  }, [])

  // Helper for updating position status
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

  const handleAddPosition = (newPos: Position) => {
    setPositions((prev) => [...prev, newPos])
    if (newPos.presetId) {
      savePreset({
        id: newPos.presetId,
        name: newPos.title,
        description: newPos.role,
        systemPrompt: newPos.systemPrompt,
        enabledTools: newPos.tools,
        enabledSkills: newPos.skills || []
      }).catch((e) => console.warn('Koltuk preset kaydedilemedi:', e))
    }
  }

  const handleUpdatePosition = (updated: Position) => {
    setPositions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    if (updated.presetId) {
      savePreset({
        id: updated.presetId,
        name: updated.title,
        description: updated.role,
        systemPrompt: updated.systemPrompt,
        enabledTools: updated.tools,
        enabledSkills: updated.skills || []
      }).catch((e) => console.warn('Koltuk preset güncellenemedi:', e))
    }
  }

  const handleDeletePosition = (posId: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== posId))
  }

  return {
    positions,
    setPositions,
    updatePositionStatus,
    handleAddPosition,
    handleUpdatePosition,
    handleDeletePosition
  }
}
