import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export const name = 'repeatGuard'

export interface RepeatGuardState {
  toolName: string
  canonicalArgs: string
  count: number
}

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

export class RepeatToolGuardService extends Service {
  declare ctx: Context
  private sessions = new Map<string, RepeatGuardState>()

  constructor(ctx: Context) {
    super(ctx, 'repeatGuard')
  }

  /**
   * Tracks a tool invocation and returns an advisory reminder if the agent is stuck in a loop
   */
  public inspectCall(sessionId: string, toolName: string, args: any): { isLooping: boolean; reminder?: string; shouldBlock?: boolean } {
    const canonicalArgs = canonicalize(args)
    const current = this.sessions.get(sessionId)

    if (current && current.toolName === toolName && current.canonicalArgs === canonicalArgs) {
      current.count += 1

      if (current.count === 3) {
        return {
          isLooping: true,
          reminder: `[DÖNGÜ UYARISI / LOOP ADVISORY]: You are repeating the exact same tool call ('${toolName}') with identical arguments for the 3rd time. Please analyze previous results and use a different tool or different arguments.`
        }
      } else if (current.count >= 4) {
        return {
          isLooping: true,
          shouldBlock: true,
          reminder: `[LOOP BLOCKED]: Repeated tool call '${toolName}' was blocked because it was called ${current.count} consecutive times with identical parameters without making progress. You must take a different action or edit the code.`
        }
      }
    } else {
      this.sessions.set(sessionId, {
        toolName,
        canonicalArgs,
        count: 1
      })
    }

    return { isLooping: false }
  }

  public reset(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}

export function apply(ctx: Context) {
  ctx.set('repeatGuard', new RepeatToolGuardService(ctx))
}
