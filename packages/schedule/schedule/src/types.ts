export type ScheduleType = 'after' | 'at' | 'every' | 'cron'
export type ScheduleStatus = 'active' | 'triggered' | 'cancelled'

export interface ScheduleRecord {
  id: string
  prompt: string
  type: ScheduleType
  targetTime: number // Next trigger unix timestamp in ms
  afterSeconds?: number
  atIso?: string
  everySeconds?: number
  cronExpression?: string
  preset?: string
  workspace?: string
  sessionId?: string
  userId?: string
  status: ScheduleStatus
  createdAt: number
  lastTriggeredAt?: number
  triggerCount: number
  reuseSession?: boolean
}

export interface ScheduleCreateOptions {
  prompt: string
  after_seconds?: number
  at?: string
  every_seconds?: number
  cron?: string
  preset?: string
  workspace?: string
  sessionId?: string
  userId?: string
  reuseSession?: boolean
}

export interface ScheduleListFilter {
  status?: ScheduleStatus
  sessionId?: string
  preset?: string
  userId?: string
}
