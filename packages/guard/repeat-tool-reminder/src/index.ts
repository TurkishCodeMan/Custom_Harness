import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import { createHash } from 'node:crypto'

export const name = 'repeatGuard'

export interface ToolCallEntry {
  toolName: string
  hash: string
  timestamp: number
}

export interface SessionGuardHistory {
  window: ToolCallEntry[]
  consecutiveCount: number
  lastHash: string
}

const MAX_WINDOW_SIZE = 12
const EXEMPT_TOOLS = new Set(['check_subagent', 'manage_task', 'sleep'])

function canonicalize(val: any): string {
  if (val === null || val === undefined) return ''
  if (typeof val !== 'object') return String(val)
  try {
    const keys = Object.keys(val).sort()
    const sortedObj: Record<string, any> = {}
    for (const k of keys) {
      sortedObj[k] = val[k]
    }
    return JSON.stringify(sortedObj)
  } catch {
    return String(val)
  }
}

function hashToolCall(toolName: string, canonicalArgs: string): string {
  return createHash('sha256')
    .update(`${toolName}:${canonicalArgs}`)
    .digest('hex')
    .slice(0, 16)
}

export class RepeatToolGuardService extends Service {
  declare ctx: Context
  private sessionHistories = new Map<string, SessionGuardHistory>()

  constructor(ctx: Context) {
    super(ctx, 'repeatGuard')
  }

  /**
   * Tracks tool invocations using a sliding window and content hashing.
   * Catches:
   * 1. Consecutive identical tool calls (A -> A -> A)
   * 2. Periodic ping-pong cycles (A -> B -> A -> B -> A -> B)
   * 3. High-frequency repetitions within the recent window
   */
  public inspectCall(sessionId: string, toolName: string, args: any): { isLooping: boolean; reminder?: string; shouldBlock?: boolean } {
    if (EXEMPT_TOOLS.has(toolName)) {
      return { isLooping: false }
    }

    const canonicalArgs = canonicalize(args)
    const callHash = hashToolCall(toolName, canonicalArgs)

    let history = this.sessionHistories.get(sessionId)
    if (!history) {
      history = {
        window: [],
        consecutiveCount: 0,
        lastHash: ''
      }
      this.sessionHistories.set(sessionId, history)
    }

    // 1. Direct Consecutive Repetition
    if (history.lastHash === callHash) {
      history.consecutiveCount += 1
    } else {
      history.consecutiveCount = 1
      history.lastHash = callHash
    }

    // Add to sliding window
    history.window.push({ toolName, hash: callHash, timestamp: Date.now() })
    if (history.window.length > MAX_WINDOW_SIZE) {
      history.window.shift()
    }

    // Check consecutive threshold
    if (history.consecutiveCount === 3) {
      return {
        isLooping: true,
        reminder: `[DÖNGÜ UYARISI / LOOP ADVISORY]: You are repeating the exact same tool call ('${toolName}') with identical arguments for the 3rd consecutive time. Please analyze previous results and use a different tool or different arguments.`
      }
    } else if (history.consecutiveCount >= 4) {
      return {
        isLooping: true,
        shouldBlock: true,
        reminder: `[LOOP BLOCKED]: Repeated tool call '${toolName}' was blocked because it was called ${history.consecutiveCount} consecutive times with identical parameters without making progress. You must take a different action or edit the code.`
      }
    }

    // 2. Periodic Cycle Detection (A -> B -> A -> B ping-pong)
    const win = history.window
    if (win.length >= 4) {
      // Check 2-cycle (A, B, A, B)
      const len = win.length
      const a1 = win[len - 1].hash
      const b1 = win[len - 2].hash
      const a2 = win[len - 3].hash
      const b2 = win[len - 4].hash

      if (a1 === a2 && b1 === b2 && a1 !== b1) {
        // We have at least 2 full cycles of A-B
        if (len >= 6 && win[len - 5].hash === a1 && win[len - 6].hash === b1) {
          // 3 full cycles of A-B -> Hard block
          return {
            isLooping: true,
            shouldBlock: true,
            reminder: `[LOOP BLOCKED]: Alternating tool execution loop detected between '${win[len - 2].toolName}' and '${win[len - 1].toolName}'. Stop toggling between these actions and proceed to the next step.`
          }
        }
        return {
          isLooping: true,
          reminder: `[DÖNGÜ UYARISI / LOOP ADVISORY]: Alternating cycle detected between '${win[len - 2].toolName}' and '${win[len - 1].toolName}'. Please break the cycle and make forward progress.`
        }
      }
    }

    // 3. Sliding Window Frequency (Same tool call appearing >= 4 times in window of 8)
    const recentWindow = win.slice(-8)
    const occurrences = recentWindow.filter(e => e.hash === callHash).length
    if (occurrences >= 4) {
      return {
        isLooping: true,
        shouldBlock: true,
        reminder: `[LOOP BLOCKED]: High-frequency repetition detected for '${toolName}' (${occurrences} occurrences in recent history). Execution paused to prevent wasted context.`
      }
    }

    return { isLooping: false }
  }

  public reset(sessionId: string): void {
    this.sessionHistories.delete(sessionId)
  }
}

export function apply(ctx: Context) {
  ctx.set('repeatGuard', new RepeatToolGuardService(ctx))
}

export default RepeatToolGuardService
