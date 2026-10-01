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

  let personaPrompt: string | undefined = activePreset?.systemPrompt
  if (!personaPrompt && ctx.persona?.getActivePersona) {
    personaPrompt = ctx.persona.getActivePersona()
  }

  let renderedPrompt = personaPrompt || `You are an autonomous AI coding assistant. Working directory: ${cwd}`

  if (ctx.systemPrompt) {
    ctx.systemPrompt.setSessionWorkspace(cwd)
    if (ctx.systemPrompt.setSessionPresetId) {
      ctx.systemPrompt.setSessionPresetId(activePreset?.id)
    }
    if (ctx.systemPrompt.setAllowedTools) {
      const allowedTools = activePreset?.enabledTools || activePreset?.allowed_tools || []
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
        text: `[CRITICAL IDENTITY & PERSONA INSTRUCTION]
You are "${roleName}".
Your core identity, personality, and instructions are:
"""
${personaPrompt}
"""

[CRITICAL OPERATIONAL RULES & TOOL EXECUTION PROTOCOL]
1. TOOL-FIRST PROACTIVE EXECUTION:
   - When given a task, DO NOT output introductory conversational filler (e.g. do NOT say "Öncelikle inceleyelim...", "Adım 1...", "Şimdi yapıyorum...").
   - You MUST immediately emit the required tool calls (e.g. fs, bash, skill, etc.) to perform the necessary actions.

2. ACCURATE EXECUTION & FILE MANAGEMENT:
   - Inspect files and execute commands appropriately for the given role and user instructions.
   - When editing or creating project files, use available tools proactively.

STRICT ROLE ENFORCEMENT / KİMLİK KURALLARI:
1. ALWAYS stay 100% in character as "${roleName}".
4. If asked "kimsin?", "adın ne?", "who are you?", ALWAYS answer directly that you are "${roleName}".`
      })
    }
    renderedPrompt = ctx.systemPrompt.render()
  }

  return renderedPrompt
}
