import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export interface FsStat {
  size: number
  isDirectory: boolean
  isFile: boolean
  mtime: Date
}

export abstract class FsService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'fs')
  }

  public abstract readText(filePath: string): Promise<string>
  public abstract writeText(filePath: string, content: string): Promise<void>
  public abstract exists(filePath: string): Promise<boolean>
  public abstract mkdir(dirPath: string): Promise<void>
  public abstract stat(filePath: string): Promise<FsStat>
  public abstract unlink(filePath: string): Promise<void>
  public abstract listDir(dirPath: string): Promise<string[]>
  public abstract glob(pattern: string | string[], options?: { cwd?: string; ignore?: string[] }): Promise<string[]>
}

export const name = 'fs'

export function apply(ctx: Context) {
  // Service definition seam
}

export default FsService
