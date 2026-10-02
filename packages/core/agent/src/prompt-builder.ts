import type { Context } from '@custom-harness/core-context'

/**
 * Clean helper to render file scope security restrictions for the agent prompt.
 */
function renderFileScopeSection(fileScope: any): string {
  if (!fileScope) return ''

  const hasReadScope = Boolean(fileScope.read && Array.isArray(fileScope.read) && fileScope.read.length > 0)
  const hasWriteScope = Boolean(fileScope.write && Array.isArray(fileScope.write) && fileScope.write.length > 0)
  const hasDenyScope = Boolean(fileScope.deny && Array.isArray(fileScope.deny) && fileScope.deny.length > 0)

  const readRules = hasReadScope
    ? fileScope.read.map((r: string) => `\`${r}\``).join(', ')
    : 'Tüm çalışma alanı (Genel Okuma)'

  const writeRules = hasWriteScope
    ? fileScope.write.map((w: string) => `\`${w}\``).join(', ')
    : '⛔ YAZMA YETKİNİZ YOKTUR (Salt-Okunur / Read-Only Rol). Hiçbir dosya oluşturamaz, üzerine yazamaz veya silemezsiniz.'

  const denyRules = hasDenyScope
    ? fileScope.deny.map((d: string) => `\`${d}\``).join(', ')
    : null

  let text = `[GÜVENLİK & DOSYA ERİŞİM SINIRLARI (FILE SCOPE)]
Bu koltuğun çalışma alanı güvenlik politikası gereği izinli yolları:
- 📖 Okuma İzniniz (READ Scope): ${readRules}
- ✍️ Yazma İzniniz (WRITE Scope): ${writeRules}`

  if (denyRules) {
    text += `\n- ⛔ Kesinlikle Yasaklı (DENY Scope): ${denyRules}`
  }

  text += `\n\nÖNEMLİ GÜVENLİK KURALI: Bu kalıpların dışındaki dosyalara erişim ve yazma denemeleri sistem güvenlik katmanı (ACL) tarafından engellenecektir. Yalnızca yetkili olduğunuz klasörlerle çalışın. Yazma izniniz olmayan yollara dosya araçlarıyla ('write_file', 'edit_file') veya terminalle ('bash' üzerinden echo >, touch, rm, cp, mv vb.) müdahale etmeyin.`

  return text
}

/**
 * Dynamically constructs the system prompt utilizing persona and systemPrompt services.
 */
export function buildSystemPrompt(ctx: Context, activePreset: any, cwd: string, customSystemPrompt?: string): string {
  // Case 1: Direct custom system prompt provided
  if (customSystemPrompt && customSystemPrompt.trim()) {
    let rendered = customSystemPrompt.trim()
    const activeTools = ctx.tools?.getActiveTools() || []
    const allowed = activePreset?.enabledTools || activePreset?.allowed_tools
    const filteredTools = allowed ? activeTools.filter((t: any) => allowed.includes(t.name)) : activeTools
    if (filteredTools.length > 0) {
      const toolList = filteredTools.map((t: any) => `- **${t.name}**: ${t.description}`).join('\n')
      rendered += `\n\n[ÇALIŞMA ALANI & KULLANILABİLİR ARAÇLAR]\nÇalışma dizini: ${cwd}\nKullanılabilir Araçlar:\n${toolList}`
    }
    if (activePreset?.fileScope) {
      const scopeBlock = renderFileScopeSection(activePreset.fileScope)
      if (scopeBlock) {
        rendered += `\n\n${scopeBlock}`
      }
    }
    rendered += `\n`
    return rendered
  }

  // Case 2: Preset systemPrompt: undefined/null → persona fallback; empty string "" → minimal neutral identity
  let personaPrompt: string | undefined
  const rawPresetPrompt = activePreset?.systemPrompt
  if (rawPresetPrompt && rawPresetPrompt.trim()) {
    personaPrompt = rawPresetPrompt.trim()
  } else if (rawPresetPrompt === undefined || rawPresetPrompt === null) {
    personaPrompt = ctx.persona?.getActivePersona?.()
  }

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

    if (activePreset?.fileScope) {
      const scopeBlock = renderFileScopeSection(activePreset.fileScope)
      if (scopeBlock) {
        ctx.systemPrompt.section({
          name: 'file-scope-policy',
          order: -50,
          text: scopeBlock
        })
      }
    }

    renderedPrompt = ctx.systemPrompt.render()
  }

  return renderedPrompt
}
