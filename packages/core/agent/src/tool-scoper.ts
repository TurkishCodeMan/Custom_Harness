/**
 * Helper utilities for scoping tool schemas and available skills
 * based on role/preset permissions (Zero-Trust Model).
 */

export interface ScopedSkillSummary {
  id: string
  name: string
  description: string
}

export function formatDelegationToolName(presetId: string): string {
  return `delegate_to_${presetId.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

export function parseDelegationTargetId(toolName: string): string | null {
  if (!toolName.startsWith('delegate_to_')) return null
  return toolName.slice('delegate_to_'.length)
}

/**
 * Prepares and customizes OpenAI tool schemas for an active preset.
 * - Filters tools down to activePreset.enabledTools if defined.
 * - Strips the 'skill' tool if no skills are enabled on the preset.
 * - Dynamically annotates 'skill' description & parameters with authorized skills.
 * - Dynamically generates 'delegate_to_<presetId>' tools for authorized contract delegates.
 */
export function prepareToolsForPreset(
  toolsService: any,
  activePreset?: any,
  presetsResolver?: any,
  userId?: string
): any[] {
  if (!toolsService?.getOpenAiSchemas) return []

  const enabledTools: string[] | undefined = activePreset?.enabledTools || activePreset?.allowed_tools
  // Zero-Trust Default: If enabledTools is undefined or empty, agent gets NO tools
  if (!enabledTools || !Array.isArray(enabledTools) || enabledTools.length === 0) {
    return []
  }

  let toolsToPass = toolsService.getOpenAiSchemas(enabledTools)

  const enabledSkills: string[] | undefined = activePreset?.enabledSkills || activePreset?.allowed_skills

  // Zero-Trust: If preset has no enabledSkills, remove 'skill' tool so agent cannot see or call it
  if (!enabledSkills || !Array.isArray(enabledSkills) || enabledSkills.length === 0) {
    toolsToPass = toolsToPass.filter((t: any) => (t.function?.name ?? t.name) !== 'skill')
  } else {
    // Preset has authorized skills: scope the 'skill' tool description and parameter schema strictly to those skills
    toolsToPass = toolsToPass.map((t: any) => {
      const toolName = t.function?.name ?? t.name
      if (toolName === 'skill' && t.function) {
        return {
          ...t,
          function: {
            ...t.function,
            description: `Uzmanlık becerilerini (.agents/skills/) okur ve oturuma yükler. Bu koltuğun yetkili olduğu beceriler: ${enabledSkills.join(', ')}.`,
            parameters: {
              ...t.function.parameters,
              properties: {
                ...t.function.parameters?.properties,
                skillName: {
                  type: 'string',
                  description: `Yüklenecek yetkili beceri adı. İzin verilenler: ${enabledSkills.join(', ')}.`
                }
              }
            }
          }
        }
      }
      return t
    })
  }

  // Phase 2: Dynamic Contract-Safe Delegation Tools (Schema-Enforced Delegation)
  const allowedDelegates: string[] | undefined =
    activePreset?.contract?.allowedDelegates || activePreset?.allowedDelegates

  if (allowedDelegates && Array.isArray(allowedDelegates) && allowedDelegates.length > 0 && presetsResolver) {
    const callerId = activePreset.id || activePreset.name || 'unknown'
    const callerName = activePreset.name || callerId

    for (const targetId of allowedDelegates) {
      const altTargetId = targetId.includes('_') ? targetId.replace(/_/g, '-') : targetId.replace(/-/g, '_')
      const target =
        presetsResolver.get?.(targetId, userId) ??
        presetsResolver.get?.(altTargetId, userId) ??
        presetsResolver.get?.(targetId) ??
        presetsResolver.get?.(altTargetId) ??
        presetsResolver.getPreset?.(targetId) ??
        presetsResolver.getPreset?.(altTargetId) ??
        (presetsResolver.list ? (presetsResolver.list(userId) || presetsResolver.list()).find((p: any) =>
          p.id === targetId ||
          p.id === altTargetId ||
          p.id?.toLowerCase() === targetId.toLowerCase() ||
          p.id?.toLowerCase() === altTargetId.toLowerCase() ||
          p.name === targetId ||
          p.name === altTargetId
        ) : undefined)

      if (!target) {
        continue
      }

      // 1. Inbound access control: target's allowedCallers must include callerId or callerName
      const targetCallers: string[] | undefined = target.contract?.allowedCallers || target.allowedCallers
      if (targetCallers && Array.isArray(targetCallers) && targetCallers.length > 0) {
        const isCallerAllowed =
          targetCallers.includes('*') ||
          targetCallers.includes(callerId) ||
          targetCallers.includes(callerName) ||
          targetCallers.some((c: string) =>
            c.toLowerCase() === callerId.toLowerCase() ||
            c.toLowerCase() === callerName.toLowerCase() ||
            c.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === callerId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
          )
        if (!isCallerAllowed) {
          continue
        }
      }

      // 2. Strict Production Guard: Target must have inputSchema and isCallableByAgents !== false
      const isCallable = target.contract ? target.contract.isCallableByAgents : (target.isCallableByAgents ?? true)
      const inputSchema = target.contract?.inputSchema ?? target.inputSchema
      if (!isCallable || !inputSchema || typeof inputSchema !== 'object' || Object.keys(inputSchema).length === 0) {
        continue
      }

      // 3. Synthesize dynamic OpenAI tool for the target agent
      const toolName = formatDelegationToolName(target.id)
      const desc =
        `[Organizational Delegation] Delegates a structured subtask to specialized agent '${target.name || target.id}'. ` +
        (target.description ? `Role: ${target.description}. ` : '') +
        `Executes autonomously under its isolated contract and returns validated output.`

      toolsToPass.push({
        type: 'function',
        function: {
          name: toolName,
          description: desc,
          parameters: {
            type: 'object',
            properties: inputSchema.properties || {},
            required: Array.isArray(inputSchema.required) ? inputSchema.required : [],
            additionalProperties: inputSchema.additionalProperties ?? false
          }
        }
      })
    }
  }

  return toolsToPass
}

/**
 * Resolves the list of active skills authorized for the current preset and user.
 */
export function resolveAvailableSkills(
  skillsService: any,
  activePreset?: any,
  userId?: string,
  cwd?: string
): ScopedSkillSummary[] {
  if (!skillsService) return []
  const enabledSkills: string[] | undefined = activePreset?.enabledSkills || activePreset?.allowed_skills
  if (!enabledSkills || !Array.isArray(enabledSkills) || enabledSkills.length === 0) {
    return []
  }

  const list = skillsService.listActiveSkills
    ? skillsService.listActiveSkills(userId, false, cwd)
    : (skillsService.listSkills?.(userId, false, cwd) || []).filter((s: any) => s.enabled !== false)

  const allowedSet = new Set(enabledSkills.map((s: string) => s.toLowerCase()))
  const filtered = list.filter((s: any) => allowedSet.has((s.id || '').toLowerCase()) || allowedSet.has((s.name || '').toLowerCase()))

  return filtered.map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? ''
  }))
}
