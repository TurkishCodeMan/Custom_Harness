import type { Context } from '@custom-harness/core-context'

/**
 * Dynamically constructs the system prompt utilizing persona and systemPrompt services.
 */
export function buildSystemPrompt(ctx: Context, activePreset: any, cwd: string, customSystemPrompt?: string): string {
  if (customSystemPrompt && customSystemPrompt.trim()) {
    let rendered = customSystemPrompt.trim()
    const activeTools = ctx.tools?.getActiveTools() || []
    const allowed = activePreset?.enabledTools || activePreset?.allowed_tools
    const filteredTools = allowed ? activeTools.filter((t: any) => allowed.includes(t.name)) : activeTools
    if (filteredTools.length > 0) {
      const toolList = filteredTools.map((t: any) => `- **${t.name}**: ${t.description}`).join('\n')
      rendered += `\n\n[ÇALIŞMA ALANI & KULLANILABİLİR ARAÇLAR]\nÇalışma dizini: ${cwd}\nKullanılabilir Araçlar:\n${toolList}\n\nÖNEMLİ KURAL: İncelemeyi tamamladığında başka hiçbir metin veya açıklama eklemeden YALNIZCA geçerli tek bir JSON nesnesi döndür.`
    }
    return rendered
  }

  // Preset systemPrompt: undefined/null → persona fallback; empty string "" → minimal neutral identity (no hallucination)
  let personaPrompt: string | undefined
  const rawPresetPrompt = activePreset?.systemPrompt
  if (rawPresetPrompt && rawPresetPrompt.trim()) {
    // Preset has a real system prompt → use it directly
    personaPrompt = rawPresetPrompt.trim()
  } else if (rawPresetPrompt === undefined || rawPresetPrompt === null) {
    // No preset at all → fall back to persona service
    personaPrompt = ctx.persona?.getActivePersona?.()
  }
  // else: rawPresetPrompt === "" → personaPrompt stays undefined → minimal identity below

  const presetLabel = activePreset?.name ? `"${activePreset.name}"` : 'an AI assistant'
  let renderedPrompt = personaPrompt || `You are ${presetLabel}, an autonomous AI assistant. Working directory: ${cwd}`

  if (ctx.systemPrompt) {
    ctx.systemPrompt.setSessionWorkspace(cwd)
    if (ctx.systemPrompt.setSessionPresetId) {
      ctx.systemPrompt.setSessionPresetId(activePreset?.id)
    }
    if (ctx.systemPrompt.setAllowedTools) {
      const allowedTools = activePreset?.enabledTools || activePreset?.allowed_tools
      ctx.systemPrompt.setAllowedTools(allowedTools)
    }
    if (ctx.systemPrompt.setAllowedSkills) {
      const allowedSkills = activePreset?.enabledSkills || activePreset?.allowed_skills
      ctx.systemPrompt.setAllowedSkills(allowedSkills)
    }
    if (personaPrompt) {
      const roleName = activePreset?.name || 'ArtificaX'
      ctx.systemPrompt.section({
        name: 'identity',
        order: -100,
        text: `[IDENTITY & ROLE]
You are "${roleName}".
Your core instructions and expertise:
"""
${personaPrompt}
"""

ROLE RULES:
1. Always stay in character as "${roleName}".
2. If asked "kimsin?", "adın ne?", "who are you?", directly introduce yourself as "${roleName}".`
      })
    }
    renderedPrompt = ctx.systemPrompt.render()
  }

  return renderedPrompt
}
