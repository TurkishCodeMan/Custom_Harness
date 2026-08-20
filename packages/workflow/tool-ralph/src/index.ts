import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-ralph'
export const inject = ['tools', 'agent', 'session', 'systemPrompt']

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'ralph',
      description: 'Executes a multi-round Ralph Loop (Fresh-Agent Orchestration). Each round spawns a fresh agent with no conversation seed, using the shared workspace as durable long-term memory, until the objective is complete.',
      parameters: {
        type: 'object',
        properties: {
          objective: {
            type: 'string',
            description: 'The immutable goal/objective to accomplish across fresh agent rounds.'
          },
          maxRounds: {
            type: 'integer',
            description: 'Maximum number of fresh child agent rounds to run (default: 6, max: 20).'
          }
        },
        required: ['objective']
      },
      async execute({ objective, maxRounds }: { objective: string; maxRounds?: number }, exec?: { cwd?: string; signal?: AbortSignal }) {
        const ceiling = Math.min(Math.max(1, maxRounds || 6), 20)
        let lastHandoff = '(Başlangıç - Henüz önceki tur raporu yok)'
        let roundsCompleted = 0
        let isFinalComplete = false

        console.log(`[RalphLoop] Starting Ralph run with objective: "${objective}" (Max Rounds: ${ceiling})`)

        for (let round = 1; round <= ceiling; round++) {
          if (exec?.signal?.aborted) {
            return `### ⚠️ Ralph Loop İptal Edildi\n- **Tamamlanan Tur:** ${roundsCompleted}/${ceiling}\n- **Son Durum:** İptal edildi (Aborted).`
          }

          console.log(`[RalphLoop] Executing Round ${round}/${ceiling}...`)

          const roundPrompt = `[RALPH LOOP - ROUND ${round}/${ceiling}]
IMMUTABLE OBJECTIVE: "${objective}"

DURABLE MEMORY & WORKSPACE RULES:
1. You are a FRESH AGENT in a sequential Ralph Loop. You have NO prior conversation history.
2. The filesystem / workspace is your ONLY source of truth and durable memory.
3. PREVIOUS ROUND HANDOFF:
"""
${lastHandoff}
"""

YOUR INSTRUCTIONS:
- Inspect files and git changes to understand what previous rounds accomplished.
- Execute real edits, tool calls, and tests to advance the objective.
- At the very end of your response, MUST provide a clear handoff block:
  [RALPH_STATUS]: COMPLETE | CONTINUE | BLOCKED
  [SUMMARY]: What was done in this round.
  [NEXT_STEPS]: What should be done next (if CONTINUE).
`

          try {
            const childSession = ctx.session.createSession(`Ralph Round ${round}: ${objective.slice(0, 30)}`, exec?.cwd)
            const resultText = await ctx.agent.run({
              sessionId: childSession.id,
              prompt: roundPrompt,
              signal: exec?.signal
            })

            roundsCompleted++
            lastHandoff = resultText.trim()

            // Check if status COMPLETE is declared
            if (
              resultText.includes('[RALPH_STATUS]: COMPLETE') ||
              resultText.includes('[RALPH_STATUS]:COMPLETE') ||
              resultText.toLowerCase().includes('status: complete') ||
              resultText.toLowerCase().includes('hedef başarıyla tamamlandı')
            ) {
              isFinalComplete = true
              console.log(`[RalphLoop] Round ${round} declared COMPLETE!`)
              break
            }

            if (resultText.includes('[RALPH_STATUS]: BLOCKED')) {
              console.log(`[RalphLoop] Round ${round} reported BLOCKED.`)
              break
            }
          } catch (err: any) {
            console.error(`[RalphLoop] Error in round ${round}:`, err)
            lastHandoff = `[Hata]: Tur ${round} hatayla karşılaştı: ${err.message}`
            break
          }
        }

        let header = `### 🚀 Ralph Loop Sonucu (${roundsCompleted} Tur Tamamlandı)\n`
        header += `- **Hedef:** "${objective}"\n`
        header += `- **Durum:** ${isFinalComplete ? '✅ BAŞARIYLA TAMAMLANDI (COMPLETE)' : '🏁 TUR BÜTÇESİNE ULAŞILDI / BLOCKED'}\n\n`
        header += `#### 📋 Son Ajan Raporu ve Devir Bilgisi:\n\n`

        return header + lastHandoff
      }
    })
  )

  // System prompt layer for Ralph tool guidance
  if (ctx.systemPrompt?.section) {
    ctx.systemPrompt.section({
      name: 'ralph-guidance',
      order: 86,
      text: () => `\n## RALPH FRESH-AGENT LOOP (Active)
- Use 'ralph' when executing deep, multi-round autonomous workflows without conversational fatigue or context window limits.
- Each round starts a fresh child agent using the shared workspace as durable memory.
`
    })
  }
}
