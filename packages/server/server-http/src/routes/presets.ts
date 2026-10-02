import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'

export function createPresetsRouter(ctx: Context): Router {
  const router = Router()

  const safeGetAgentPresets = () => {
    try { return (ctx as any).agentPresets || null } catch { return null }
  }

  // 1. GET Presets
  router.get('/presets', (req, res) => {
    try {
      const user = req.user
      const isAdmin = user?.role === 'admin'
      const ap = safeGetAgentPresets()
      const presets = ap ? ap.list(user?.id, isAdmin) : ctx.settings.getPresets()
      const activePreset = ap ? ap.getActive(user?.id) : ctx.settings.getActivePreset()
      res.json({ presets, activePreset })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. Select Active Preset
  router.post('/presets/select', (req, res) => {
    try {
      const user = req.user
      const { presetId } = req.body
      if (!presetId) return res.status(400).json({ error: 'presetId zorunludur' })
      const ap = safeGetAgentPresets()
      const activePreset = ap ? ap.select(presetId, user?.id) : (ctx.settings.setDefaultPreset(presetId), ctx.settings.getActivePreset())
      res.json({ success: true, activePreset })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 3. Save Preset
  router.post('/presets', (req, res) => {
    try {
      const user = req.user
      const isAdmin = user?.role === 'admin'
      const raw = req.body?.preset || req.body
      if (!raw || typeof raw !== 'object' || (!raw.name && !raw.id)) {
        return res.status(400).json({ error: 'Geçersiz önayar bilgileri: Profil adı zorunludur' })
      }
      const preset = {
        id: raw.id || raw.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || `preset_${Date.now()}`,
        name: raw.name || raw.id,
        description: raw.description || '',
        systemPrompt: raw.systemPrompt || raw.personaPrompt || '',
        tools: Array.isArray(raw.tools) ? raw.tools : [],
        enabledTools: Array.isArray(raw.enabledTools) ? raw.enabledTools : (Array.isArray(raw.tools) && raw.tools.length > 0 ? raw.tools : undefined),
        enabledSkills: Array.isArray(raw.enabledSkills) ? raw.enabledSkills : undefined,
        modelId: raw.modelId,
        providerId: raw.providerId,
        temperature: typeof raw.temperature === 'number' ? raw.temperature : undefined,
        responseFormat: raw.responseFormat || raw.response_format,
        maxTurns: typeof raw.maxTurns === 'number' ? raw.maxTurns : (raw.max_turns ? Number(raw.max_turns) : undefined),
        icon: raw.icon || '👤',
        workspace: raw.workspace,
        level: typeof raw.level === 'number' ? raw.level : (raw.level ? Number(raw.level) : undefined),
        parentId: raw.parentId,
        specialization: raw.specialization,
        currentAction: raw.currentAction,
        isDefault: Boolean(raw.isDefault),
        isGlobal: Boolean(raw.isGlobal && isAdmin),
        ownerId: user?.id || 'user_admin',
        // Phase 2: Contract-Safe Agent Runtime & Delegation Mesh
        contract: raw.contract,
        inputSchema: raw.inputSchema,
        outputSchema: raw.outputSchema,
        allowedDelegates: Array.isArray(raw.allowedDelegates) ? raw.allowedDelegates : undefined,
        allowedCallers: Array.isArray(raw.allowedCallers) ? raw.allowedCallers : undefined,
        verificationRules: Array.isArray(raw.verificationRules) ? raw.verificationRules : undefined,
        isCallableByAgents: typeof raw.isCallableByAgents === 'boolean' ? raw.isCallableByAgents : undefined,
        fileScope: raw.fileScope
      }
      const ap = safeGetAgentPresets()
      const saved = ap ? ap.save(preset, user?.id, isAdmin) : ctx.settings.savePreset(preset)
      res.json({ success: true, preset: saved || preset })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 4. Delete Preset
  router.delete('/presets/:id', (req, res) => {
    try {
      const user = req.user
      const isAdmin = user?.role === 'admin'
      const ap = safeGetAgentPresets()
      const result = ap ? ap.delete(req.params.id, user?.id, isAdmin) : ctx.settings.deletePreset(req.params.id)
      res.json(typeof result === 'object' ? result : { success: Boolean(result) })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 5. Set Default Preset
  router.post('/presets/default', (req, res) => {
    try {
      const user = req.user
      const { presetId } = req.body
      if (!presetId) return res.status(400).json({ error: 'presetId zorunludur' })
      const ap = safeGetAgentPresets()
      const activePreset = ap ? ap.select(presetId, user?.id) : (ctx.settings.setDefaultPreset(presetId), ctx.settings.getActivePreset())
      res.json({ success: true, activePreset })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  return router
}
