import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface SpillEntry {
  id: string
  content: string
  length: number
  preview: string
  createdAt: number
}

export interface ProcessOutputResult {
  modelText: string
  spilled: boolean
  spillId?: string
  length: number
}

export abstract class SpillService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'spillStore')
  }

  public abstract store(content: string, previewLimit?: number): Promise<{ id: string; preview: string; length: number }>
  public abstract get(id: string): Promise<string | undefined>
  public abstract getPreview(id: string): Promise<string | undefined>
  public abstract processOutput(output: any, sessionId?: string, toolName?: string): Promise<ProcessOutputResult>
}

export const name = 'spill'

export function apply(ctx: Context) {
  // Service definition seam
}

export default SpillService
