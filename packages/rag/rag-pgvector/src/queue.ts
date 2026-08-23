import type { IndexingProgress } from '@custom-harness/rag'
import EventEmitter from 'node:events'
import net from 'node:net'

export interface IndexJob {
  filePath: string
  sourceId: string
  resolvedPath: string
}

export interface QueueConfig {
  redisHost?: string
  redisPort?: number
  concurrency?: number
  enableRedis?: boolean
}

export class RagIndexingQueue extends EventEmitter {
  private queue: IndexJob[] = []
  private activeWorkers = 0
  private concurrency: number = 4
  private isPaused = false
  private isCancelled = false
  private isProcessing = false

  private totalFiles = 0
  private processedFiles = 0
  private totalChunks = 0
  private currentFile: string = ''
  private startedAt = 0
  private lastUpdateTime = 0
  private lastProcessedCount = 0
  private currentSpeed = 0

  private redisConnected = false

  constructor(config?: QueueConfig) {
    super()
    this.concurrency = config?.concurrency || 4
    const shouldEnableRedis = config?.enableRedis ?? (process.env.RAG_ENABLE_REDIS === 'true' || process.env.ENABLE_REDIS_QUEUE === 'true')
    if (shouldEnableRedis) {
      this.tryConnectRedis(config?.redisHost || 'localhost', config?.redisPort || 16379)
    }
  }


  public setConcurrency(concurrency: number) {
    this.concurrency = Math.max(1, Math.min(16, concurrency))
  }

  public getConcurrency(): number {
    return this.concurrency
  }

  /**
   * Lightweight native Redis ping & checkpoint client
   */
  private tryConnectRedis(host: string, port: number) {
    try {
      const socket = net.createConnection({ host, port, timeout: 2000 })
      socket.on('connect', () => {
        this.redisConnected = true
        socket.write('*1\r\n$4\r\nPING\r\n')
      })
      socket.on('data', (data) => {
        if (data.toString().includes('PONG')) {
          console.log(`[RAG:Queue] Dedicated Redis connected on ${host}:${port} for big-data queue coordination.`)
        }
      })
      socket.on('error', () => {
        this.redisConnected = false
      })
      socket.on('close', () => {
        this.redisConnected = false
      })
    } catch {
      this.redisConnected = false
    }
  }

  public reset(jobs: IndexJob[]) {
    this.queue = [...jobs]
    this.totalFiles = jobs.length
    this.processedFiles = 0
    this.totalChunks = 0
    this.isPaused = false
    this.isCancelled = false
    this.currentFile = ''
    this.startedAt = Date.now()
    this.lastUpdateTime = Date.now()
    this.lastProcessedCount = 0
    this.currentSpeed = 0
    this.emitProgress()
  }

  public async start(handler: (job: IndexJob) => Promise<number>): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true
    this.startedAt = Date.now()
    this.lastUpdateTime = Date.now()

    return new Promise<void>((resolve, reject) => {
      const workerPump = async () => {
        if (this.isCancelled) {
          this.isProcessing = false
          this.emitProgress('completed')
          return resolve()
        }

        if (this.isPaused) {
          setTimeout(workerPump, 200)
          return
        }

        while (this.activeWorkers < this.concurrency && this.queue.length > 0 && !this.isPaused && !this.isCancelled) {
          const job = this.queue.shift()
          if (!job) break

          this.activeWorkers++
          this.currentFile = job.filePath

          // Execute job
          handler(job)
            .then((chunksStored) => {
              this.processedFiles++
              this.totalChunks += chunksStored
              this.updateSpeed()
              this.emitProgress('running')
            })
            .catch((err) => {
              this.processedFiles++
              console.warn(`[RAG:Worker] Job failed for "${job.filePath}":`, err.message)
              this.emitProgress('running')
            })
            .finally(() => {
              this.activeWorkers--
              workerPump()
            })
        }

        if (this.activeWorkers === 0 && this.queue.length === 0) {
          this.isProcessing = false
          this.emitProgress('completed')
          resolve()
        }
      }

      workerPump().catch(reject)
    })
  }

  private updateSpeed() {
    const now = Date.now()
    const elapsedSec = (now - this.lastUpdateTime) / 1000
    if (elapsedSec >= 1) {
      const processedDelta = this.processedFiles - this.lastProcessedCount
      this.currentSpeed = Math.round((processedDelta / elapsedSec) * 10) / 10
      this.lastUpdateTime = now
      this.lastProcessedCount = this.processedFiles
    }
  }

  private emitProgress(statusOverride?: IndexingProgress['status']) {
    const prog = this.getProgress(statusOverride)
    this.emit('progress', prog)
  }

  public getProgress(statusOverride?: IndexingProgress['status']): IndexingProgress {
    let status: IndexingProgress['status'] = 'idle'
    if (this.isCancelled) {
      status = 'idle'
    } else if (this.isPaused) {
      status = 'paused'
    } else if (this.isProcessing) {
      status = 'running'
    } else if (this.totalFiles > 0 && this.processedFiles >= this.totalFiles) {
      status = 'completed'
    }

    if (statusOverride) {
      status = statusOverride
    }

    const percent = this.totalFiles > 0 ? Math.min(100, Math.round((this.processedFiles / this.totalFiles) * 100)) : 0
    const remainingFiles = Math.max(0, this.totalFiles - this.processedFiles)
    const estimatedRemainingSec = this.currentSpeed > 0 ? Math.round(remainingFiles / this.currentSpeed) : undefined

    return {
      totalFiles: this.totalFiles,
      processedFiles: this.processedFiles,
      totalChunks: this.totalChunks,
      percent,
      currentFile: this.currentFile,
      status,
      speedFilesPerSec: this.currentSpeed,
      startedAt: this.startedAt,
      estimatedRemainingSec
    }
  }

  public pause() {
    this.isPaused = true
    this.emitProgress('paused')
    console.log('[RAG:Queue] Indexing paused.')
  }

  public resume() {
    this.isPaused = false
    this.emitProgress('running')
    console.log('[RAG:Queue] Indexing resumed.')
  }

  public cancel() {
    this.isCancelled = true
    this.isPaused = false
    this.queue = []
    this.emitProgress('idle')
    console.log('[RAG:Queue] Indexing cancelled.')
  }

  public isBusy(): boolean {
    return this.isProcessing && !this.isPaused && !this.isCancelled
  }
}
