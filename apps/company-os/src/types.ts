export type PositionLevel = 1 | 2 | 3 | 4

export type PositionStatus = 'idle' | 'routing' | 'thinking' | 'executing' | 'completed' | 'error'

export interface FileScopeConfig {
  read?: string[]
  write?: string[]
  deny?: string[]
}

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
  modelId?: string
  providerId?: string
  temperature?: number
  responseFormat?: any
  maxTurns?: number
  // Scoped File Access (READ & WRITE ACL)
  fileScope?: FileScopeConfig
  // Contract-Safe Agent Runtime (Phase 2)
  contract?: any
  contractVersion?: number
  isCallableByAgents?: boolean
  inputSchema?: Record<string, any>
  outputSchema?: Record<string, any>
  allowedDelegates?: string[]
  allowedCallers?: string[]
  verificationRules?: any[]
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
  | 'cases'
  | 'recurring'
  | 'approvals'
  | 'workflows'
  | 'agents'
  | 'positions'
  | 'knowledge'
  | 'skills'
  | 'integrations'
  | 'company'
  | 'org-graph'
  | 'roi'
  | 'settings'
  | 'inspector'


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

export interface ExecutionActionItem {
  id?: string
  label: string
  status: 'completed' | 'running' | 'pending' | 'error'
  detail?: string
  input?: any
  output?: any
  startedAt?: number
  durationMs?: number
}

export interface ExecutionActionCard {
  id: string
  name: string
  icon: string
  badgeText: string
  isExpanded: boolean
  items: ExecutionActionItem[]
}

export interface TokenMeasurement {
  contextPressure?: {
    usedTokens: number
    contextWindow: number
    percent: number
    projectedTokens: number
  }
  contextBreakdown?: {
    systemTokens: number
    toolsTokens: number
    messageTokens: number
    systemPercent: number
    toolsPercent: number
    messagePercent: number
  }
  modelId?: string
  contextWindow?: number
  systemPromptTokens?: number
  toolsTokens?: number
  historyTokens?: number
  totalTokens?: number
  percentage?: number
  actualUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    turnCount: number
    lastPromptTokens: number
    lastCompletionTokens: number
    lastUpdated?: number
    modelId?: string
  }
  isCalibrated?: boolean
}

export interface ThreadMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string
  reasoning_content?: string
  presetName?: string
  tool_calls?: any[]
  tool_call_id?: string
  name?: string
  timestamp?: number
  isStreaming?: boolean
  actionCards?: ExecutionActionCard[]
  attachments?: any[]
  tokenMeasurement?: TokenMeasurement
  tokenUsage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    model?: string
  }
}



