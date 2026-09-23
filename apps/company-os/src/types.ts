export type PositionLevel = 1 | 2 | 3 | 4

export type PositionStatus = 'idle' | 'routing' | 'thinking' | 'executing' | 'completed' | 'error'

export interface Position {
  id: string
  title: string
  role: string
  icon: string
  level: PositionLevel
  presetId: string
  parentId?: string
  workspace: string
  tools: string[]
  skills?: string[]
  specialization?: string
  systemPrompt?: string
  status: PositionStatus
  currentAction?: string
  lastActive?: number
  lastReport?: {
    title: string
    path: string
    date: string
  }
}

export interface Directive {
  id: string
  senderId: string
  targetPositionIds: string[]
  prompt: string
  status: 'pending' | 'in-progress' | 'completed'
  timestamp: number
  progress: Record<string, 'pending' | 'running' | 'done'>
}

export interface ActivityReceipt {
  id: string
  positionId: string
  positionTitle: string
  actionType: 'tool_call' | 'report_generated' | 'directive_issued' | 'routine_triggered' | 'thought' | 'subagent_spawn' | 'subagent_completed' | 'system'
  summary: string
  details?: any
  timestamp: number
  sessionId?: string
  traceId?: string
}

export interface Routine {
  id: string
  prompt: string
  type: 'cron' | 'after' | 'every' | 'at'
  preset?: string
  workspace?: string
  cronExpression?: string
  afterSeconds?: number
  everySeconds?: number
  targetTime: number
  status: 'active' | 'triggered' | 'cancelled'
  triggerCount: number
}

export type NavView =
  | 'dashboard'
  | 'assistant'
  | 'tasks'
  | 'recurring'
  | 'approvals'
  | 'workflows'
  | 'agents'
  | 'knowledge'
  | 'integrations'
  | 'company'
  | 'roi'
  | 'settings'

export interface ApprovalItem {
  id: string
  sessionId?: string
  toolName: string
  title: string
  status: 'pending' | 'approved' | 'denied' | 'timed_out'
  details: any
  to?: string
  subject?: string
  body?: string
  timeoutSeconds?: number
  createdAt: number
  resolvedAt?: number
}

export interface ChatThread {
  id: string
  title: string
  period: 'today' | 'yesterday' | 'last_7_days'
  timestamp: number
  lastMessage?: string
  sessionId?: string
  targetPositionId?: string
}

export interface ExecutionActionCard {
  id: string
  name: string
  icon: string
  badgeText: string
  isExpanded: boolean
  items: {
    label: string
    status: 'completed' | 'running' | 'pending' | 'error'
    detail?: string
  }[]
}

export interface ThreadMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string
  reasoning_content?: string
  presetName?: string
  tool_calls?: any[]
  timestamp?: number
  isStreaming?: boolean
}


