export interface ToolParameterSchema {
  type: string
  description?: string
  properties?: Record<string, any>
  required?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameterSchema | any
  execute: (args: any, context?: { signal?: AbortSignal; cwd?: string }) => Promise<any>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  reasoning_content?: string
  tool_calls?: {
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }[]
  tool_call_id?: string
  name?: string
  presetName?: string
  modelName?: string
}

export interface ModelConfig {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
  reasoningFormat?: 'deepseek' | 'openai' | 'none'
}

export interface ProviderConfig {
  id: string
  name: string
  api: 'openai-completions' | 'deepseek' | 'ollama'
  baseURL: string
  apiKey?: string
  apiKeyEnv?: string
  models: ModelConfig[]
}

export interface PluginConfig {
  id: string
  name: string
  module: string
  description?: string
  enabled: boolean
  category: 'tool' | 'llm' | 'core' | 'extension'
  version?: string
  config?: Record<string, any>
}

export interface AgentPreset {
  id: string
  name: string
  description: string
  icon?: string
  systemPrompt?: string
  modelId?: string
  providerId?: string
  enabledTools?: string[]
  temperature?: number
  ownerId?: string
  isGlobal?: boolean
}

export interface UiSettings {
  defaultTitlePrompt?: string
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  fontSize?: 'sm' | 'md' | 'lg'
  bubbleStyle?: 'modern' | 'minimal' | 'glass'
}

export interface SettingsDoc {
  defaultProvider: string
  defaultModel: string
  defaultPreset?: string
  workspace: string
  providers: Record<string, ProviderConfig>
  plugins?: Record<string, PluginConfig>
  presets?: Record<string, AgentPreset>
  ui?: UiSettings
  thinkingEnabled?: boolean
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'
}

export interface SkillItem {
  id: string
  name: string
  description: string
  filePath: string
  content: string
  ownerId?: string
  isGlobal?: boolean
  allowedUserIds?: string[]
  isPublic?: boolean
  enabled?: boolean
}

export type UserRole = 'admin' | 'user'

export interface User {
  id: string
  username: string
  name: string
  email?: string
  role: UserRole
  createdAt: number
  lastActiveAt?: number
  avatar?: string
}

export interface TenantContext {
  userId: string
  user: User
  workspaceDir: string
  uploadsDir: string
  sessionsDir: string
  ragNamespace: string
}

export interface SessionData {
  id: string
  title: string
  clientType?: 'web' | 'cli' | 'vscode' | string
  createdAt: number
  updatedAt: number
  workspace: string
  userId?: string
  messages: ChatMessage[]
}


