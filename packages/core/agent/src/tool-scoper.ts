/**
 * Helper utilities for scoping tool schemas and available skills
 * based on role/preset permissions (Zero-Trust Model).
 */

export interface ScopedSkillSummary {
  id: string
  name: string
  description: string
}

/**
 * Prepares and customizes OpenAI tool schemas for an active preset.
 * - Filters tools down to activePreset.enabledTools if defined.
 * - Strips the 'skill' tool if no skills are enabled on the preset.
 * - Dynamically annotates 'skill' description & parameters with authorized skills.
 */
export function prepareToolsForPreset(toolsService: any, activePreset?: any): any[] {
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
    return toolsToPass.filter((t: any) => (t.function?.name ?? t.name) !== 'skill')
  }

  // Preset has authorized skills: scope the 'skill' tool description and parameter schema strictly to those skills
  return toolsToPass.map((t: any) => {
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
