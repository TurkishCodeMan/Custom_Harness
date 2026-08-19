import fs from 'node:fs'
import path from 'node:path'
import type { Context } from '@custom-harness/core-context'
import { FsService, type FsStat } from '@custom-harness/fs'

export class LocalFsService extends FsService {
  constructor(ctx: Context) {
    super(ctx)
  }

  public async readText(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf8')
  }

  public async writeText(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }
    await fs.promises.writeFile(filePath, content, 'utf8')
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath)
      return true
    } catch {
      return false
    }
  }

  public async mkdir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true })
  }

  public async stat(filePath: string): Promise<FsStat> {
    const s = await fs.promises.stat(filePath)
    return {
      size: s.size,
      isDirectory: s.isDirectory(),
      isFile: s.isFile(),
      mtime: s.mtime
    }
  }

  public async unlink(filePath: string): Promise<void> {
    await fs.promises.unlink(filePath)
  }

  public async listDir(dirPath: string): Promise<string[]> {
    return fs.promises.readdir(dirPath)
  }

  public async glob(pattern: string | string[], options: { cwd?: string; ignore?: string[] } = {}): Promise<string[]> {
    const cwd = options.cwd || process.cwd()
    const entries: string[] = []

    const walk = async (currentDir: string) => {
      const list = await fs.promises.readdir(currentDir, { withFileTypes: true })
      for (const entry of list) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue
        const fullPath = path.join(currentDir, entry.name)
        const relPath = path.relative(cwd, fullPath)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else {
          entries.push(relPath)
        }
      }
    }

    await walk(cwd)
    return entries
  }
}

export const name = 'fs-local'

export function apply(ctx: Context) {
  ctx.set('fs', new LocalFsService(ctx))
}

export default LocalFsService
