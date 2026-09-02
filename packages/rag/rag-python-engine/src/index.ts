import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import { spawn, ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface ParsedDocumentResult {
  id?: string
  filePath: string
  success: boolean
  type?: 'pdf' | 'docx' | 'excel' | 'text'
  content?: string
  pageCount?: number
  paragraphCount?: number
  sheetCount?: number
  pages?: Array<{ page: number; text: string }>
  error?: string
}

interface WorkerInstance {
  id: number
  process: ChildProcess
  activeJobs: number
  isReady: boolean
}

export const name = 'pythonRagEngine'

export class PythonRagEngineService extends Service {
  private workers: WorkerInstance[] = []
  private poolSize: number
  private pendingRequests = new Map<string, { resolve: (res: ParsedDocumentResult) => void; reject: (err: any) => void; timer: NodeJS.Timeout; workerId: number }>()
  private reqSeq = 0
  private scriptPath: string

  constructor(ctx: Context) {
    super(ctx, 'pythonRagEngine')

    const candidates = [
      path.resolve(__dirname, 'python/document_parser.py'),
      path.resolve(__dirname, '../python/document_parser.py'),
      path.resolve(process.cwd(), 'python/document_parser.py'),
      path.resolve(process.cwd(), 'dist/python/document_parser.py'),
      path.resolve(__dirname, '../../packages/rag/rag-python-engine/python/document_parser.py')
    ]
    this.scriptPath = candidates.find(p => fs.existsSync(p)) || candidates[0]
    
    // Auto-scale pool size according to CPU cores (min 2, max 8)
    const cpuCount = os.cpus().length || 4
    this.poolSize = Math.max(2, Math.min(8, Math.floor(cpuCount / 2)))

    this.initWorkerPool()

    this.ctx.on('dispose', () => {
      this.stopAllWorkers()
    })
  }

  public setPoolSize(size: number) {
    const targetSize = Math.max(1, Math.min(16, size))
    if (targetSize === this.poolSize) return

    if (targetSize > this.poolSize) {
      for (let i = this.poolSize; i < targetSize; i++) {
        this.spawnWorker(i)
      }
    } else {
      while (this.workers.length > targetSize) {
        const w = this.workers.pop()
        w?.process.kill('SIGTERM')
      }
    }
    this.poolSize = targetSize
  }

  public getPoolSize(): number {
    return this.workers.length
  }

  private initWorkerPool() {
    for (let i = 0; i < this.poolSize; i++) {
      this.spawnWorker(i)
    }
  }

  private spawnWorker(index: number) {
    try {
      const proc = spawn('python3', [this.scriptPath], {
        stdio: ['pipe', 'pipe', 'inherit'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      })

      const worker: WorkerInstance = {
        id: index,
        process: proc,
        activeJobs: 0,
        isReady: false
      }

      const rl = readline.createInterface({
        input: proc.stdout!,
        terminal: false
      })

      rl.on('line', (line) => {
        const trimmed = line.trim()
        if (!trimmed) return

        try {
          const msg = JSON.parse(trimmed)
          if (msg.type === 'ready') {
            worker.isReady = true
            return
          }

          const id = msg.id
          if (id && this.pendingRequests.has(id)) {
            const { resolve, timer } = this.pendingRequests.get(id)!
            clearTimeout(timer)
            this.pendingRequests.delete(id)
            worker.activeJobs = Math.max(0, worker.activeJobs - 1)
            resolve(msg as ParsedDocumentResult)
          }
        } catch (e) {
          console.error(`[PythonRagEngine:Worker-${index}] JSON parse error:`, e, line)
        }
      })

      proc.on('exit', (code, signal) => {
        worker.isReady = false
        const idx = this.workers.findIndex(w => w.id === index)
        if (idx !== -1) {
          this.workers.splice(idx, 1)
        }
        if (code !== 0 && signal !== 'SIGTERM') {
          console.warn(`[PythonRagEngine:Worker-${index}] Exited with code ${code}, respawning...`)
          setTimeout(() => this.spawnWorker(index), 1000)
        }
      })

      this.workers.push(worker)
    } catch (err) {
      console.error(`[PythonRagEngine] Failed to spawn worker ${index}:`, err)
    }
  }

  public stopAllWorkers() {
    for (const worker of this.workers) {
      worker.process.kill('SIGTERM')
    }
    this.workers = []
  }

  /**
   * Dispatches document parsing to the least-busy replica Python worker.
   */
  public async parseDocument(filePath: string, timeoutMs = 1200000): Promise<ParsedDocumentResult> {
    if (this.workers.length === 0) {


      this.initWorkerPool()
    }

    // Pick the worker with the fewest active jobs (Load Balancing)
    let bestWorker = this.workers.find(w => w.isReady && w.activeJobs === 0)
    if (!bestWorker) {
      bestWorker = this.workers.reduce((min, w) => (w.activeJobs < min.activeJobs ? w : min), this.workers[0])
    }

    if (!bestWorker || !bestWorker.process.stdin) {
      return {
        filePath,
        success: false,
        error: 'No active Python worker replica available in pool.'
      }
    }

    bestWorker.activeJobs++
    const id = `req_${++this.reqSeq}_${Date.now()}`
    const workerId = bestWorker.id

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          if (bestWorker) bestWorker.activeJobs = Math.max(0, bestWorker.activeJobs - 1)
          resolve({
            id,
            filePath,
            success: false,
            error: `Timeout: Document parsing exceeded ${timeoutMs}ms limit on worker-${workerId}.`
          })
        }
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timer, workerId })

      const payload = JSON.stringify({ id, filePath }) + '\n'
      bestWorker.process.stdin?.write(payload, 'utf8', (err) => {
        if (err) {
          clearTimeout(timer)
          this.pendingRequests.delete(id)
          bestWorker.activeJobs = Math.max(0, bestWorker.activeJobs - 1)
          reject(err)
        }
      })
    })
  }
}

export function apply(ctx: Context) {
  ctx.plugin(PythonRagEngineService)
}
