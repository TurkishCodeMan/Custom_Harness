/**
 * Laya Neural Decision Engine (System 1) - TypeScript Client
 * Sub-15ms reflex classification, smart routing, risk audit and task priority triage.
 */

export interface LayaHealth {
  status: 'online' | 'offline'
  model: string
  device: string
  cuda_available: boolean
  zero_token_inference: boolean
  typical_latency_ms: number
  loaded_positions_count?: number
  positions?: Array<{ id: string; title: string; icon: string; role?: string }>
}

export interface TargetPositionInfo {
  id: string
  title: string
  icon: string
  role?: string
  workspace?: string
}

export interface LayaRouteResult {
  target_position_id: string
  target_position: TargetPositionInfo
  confidence: number
  probabilities: Record<string, number>
  act_probability: number
  latency_ms: number
  zero_token: boolean
}

export interface LayaAuditResult {
  should_escalate: boolean
  risk_score: number
  approval_needed_probability: number
  act_probability: number
  latency_ms: number
  details?: Record<string, any>
}

export interface LayaPriorityResult {
  priority_level: 'P0' | 'P1' | 'P2'
  priority_score: number
  latency_ms: number
}

const LAYA_BASE_URL = 'http://127.0.0.1:8765'

export class LayaService {
  private static isAvailable: boolean | null = null
  private static lastHealthCheck = 0

  /**
   * Check if Laya microservice is reachable on port 8765.
   */
  static async checkHealth(): Promise<LayaHealth> {
    try {
      const res = await fetch(`${LAYA_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(1500)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      this.isAvailable = true
      this.lastHealthCheck = Date.now()
      return { ...data, status: 'online' }
    } catch {
      this.isAvailable = false
      return {
        status: 'offline',
        model: 'LayaDecisionModel (Offline)',
        device: 'None',
        cuda_available: false,
        zero_token_inference: true,
        typical_latency_ms: 0
      }
    }
  }

  /**
   * Sub-15ms Dynamic Intent Routing:
   * Classifies user inquiry to the optimal position without LLM token cost.
   */
  static async routeMessage(
    text: string,
    positions?: Array<{ id: string; title: string; role?: string; specialization?: string }>
  ): Promise<LayaRouteResult | null> {
    if (!text.trim()) return null

    try {
      const res = await fetch(`${LAYA_BASE_URL}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          positions: positions && positions.length > 0 ? positions : undefined
        }),
        signal: AbortSignal.timeout(3000)
      })

      if (!res.ok) return null
      const data: LayaRouteResult = await res.json()
      return data
    } catch (err) {
      console.warn('[LayaService] routeMessage offline or timeout:', err)
      return null
    }
  }

  /**
   * Risk Audit: Checks if an action or prompt requires human escalation (Approvals).
   */
  static async auditAction(
    text: string,
    options?: { positionId?: string; workspace?: string; action?: string; details?: any }
  ): Promise<LayaAuditResult | null> {
    try {
      const res = await fetch(`${LAYA_BASE_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          position_id: options?.positionId,
          workspace: options?.workspace,
          action: options?.action || 'general_execution',
          details: options?.details
        }),
        signal: AbortSignal.timeout(3000)
      })

      if (!res.ok) return null
      return await res.json()
    } catch (err) {
      console.warn('[LayaService] auditAction failed:', err)
      return null
    }
  }

  /**
   * Task & Ticket Triage: Computes priority level (P0, P1, P2) in 12ms.
   */
  static async triagePriority(text: string): Promise<LayaPriorityResult | null> {
    try {
      const res = await fetch(`${LAYA_BASE_URL}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(3000)
      })

      if (!res.ok) return null
      return await res.json()
    } catch (err) {
      console.warn('[LayaService] triagePriority failed:', err)
      return null
    }
  }

  /**
   * Sync active positions into Laya runtime memory.
   */
  static async syncPositions(positions: any[]): Promise<boolean> {
    try {
      const res = await fetch(`${LAYA_BASE_URL}/positions/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
        signal: AbortSignal.timeout(2000)
      })
      return res.ok
    } catch {
      return false
    }
  }
}
