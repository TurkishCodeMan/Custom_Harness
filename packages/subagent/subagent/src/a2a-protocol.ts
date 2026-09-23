/**
 * Typed A2A (Agent-to-Agent) communication schemas.
 * Atlantic-style: delegate -> execute -> report -> escalate -> approve
 */

export interface ToolCallTrace {
  toolName: string
  args: any
  result?: string
  timestamp: number
  status: 'running' | 'completed' | 'failed'
}

export interface TaskDispatch {
  from: string        // Preset ID or role of dispatcher (e.g. 'CEO', 'novatrend-ceo')
  to: string          // Preset ID or role of receiver (e.g. 'CFO', 'novatrend-cfo')
  task: string        // Short task title
  description: string // Full instructions & context
  priority?: 'low' | 'normal' | 'high' | 'critical'
  deadline?: string
  requiredOutput?: string  // Expected output schema or format
  traceId: string
  parentSessionId?: string
}

export interface TaskResult {
  from: string
  to?: string
  status: 'completed' | 'failed' | 'escalated'
  finding: string
  evidence?: string[]       // Files, rows, metrics inspected
  recommendedAction?: string
  escalateTo?: string        // If escalation is needed
  traceId: string
  durationMs: number
}

export function formatTaskDispatch(dispatch: TaskDispatch): string {
  return `[A2A GÖREV DEVRİ]:
${JSON.stringify(dispatch, null, 2)}

Lütfen yukarıdaki görevi rolüne uygun şekilde titizlikle yürüt ve sonucunu aşağıdaki yapıda raporla:
- Bulgular (Finding)
- Kanıtlar / İnceleme Verileri (Evidence)
- Tavsiye Edilen Aksiyon (Recommended Action)
- Eskalasyon gerekirse kime eskalasyon yapılacağı (EscalateTo)`
}

export function parseTaskResult(output: string): TaskResult | null {
  if (!output) return null

  // 1. Try matching ```json ... ``` block
  const match = output.match(/```json\s*([\s\S]*?)\s*```/)
  if (match) {
    try {
      return JSON.parse(match[1])
    } catch {}
  }

  // 2. Try raw JSON
  try {
    const trimmed = output.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return JSON.parse(trimmed)
    }
  } catch {}

  return null
}
