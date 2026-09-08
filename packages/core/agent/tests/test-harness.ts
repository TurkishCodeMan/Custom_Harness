import type { ChatMessage } from '@custom-harness/core-types'
import { AgentService } from '../src/index.js'

export function createAgentService(ctx: any): AgentService {
  const svc = Object.create(AgentService.prototype) as AgentService
  ;(svc as any).ctx = ctx
  return svc
}

export interface MockSessionData {
  id: string
  messages: ChatMessage[]
  workspace?: string
  userId?: string
}

export function createMockContext(overrides: Record<string, any> = {}) {
  const sessionStore = new Map<string, MockSessionData>()

  const defaultSession = {
    _store: sessionStore,
    getSession: (id: string) => sessionStore.get(id),
    createSession: (title?: string, workspace?: string, userId?: string) => {
      const s: MockSessionData = {
        id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        messages: [],
        workspace,
        userId
      }
      sessionStore.set(s.id, s)
      return s
    },
    appendMessage: (id: string, msg: ChatMessage) => {
      let s = sessionStore.get(id)
      if (!s) {
        s = { id, messages: [] }
        sessionStore.set(id, s)
      }
      s.messages.push(msg)
    }
  }

  const defaultSettings = {
    getSettings: () => ({
      workspace: '/test/workspace',
      defaultPreset: 'developer',
      providers: {
        mockProvider: {
          id: 'mockProvider',
          name: 'Mock Provider',
          models: [
            { id: 'mock-model-1', name: 'Mock Model 1', contextWindow: 16384, maxTokens: 4096 },
            { id: 'qwen-2.5-coder', name: 'Qwen 2.5 Coder', contextWindow: 32768, maxTokens: 8192 }
          ]
        }
      }
    }),
    getActiveProvider: () => ({
      id: 'mockProvider',
      name: 'Mock Provider',
      models: [{ id: 'mock-model-1', name: 'Mock Model 1' }]
    }),
    getActiveModel: () => ({
      id: 'mock-model-1',
      name: 'Mock Model 1',
      contextWindow: 16384,
      maxTokens: 4096
    }),
    getActivePreset: () => ({
      id: 'developer',
      name: 'Full-Stack Developer',
      systemPrompt: 'You are a test assistant.'
    }),
    getPreset: (id: string) => ({
      id,
      name: 'Full-Stack Developer',
      systemPrompt: 'You are a test assistant.'
    })
  }

  const defaultTools = {
    getOpenAiSchemas: () => [
      {
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test tool',
          parameters: { type: 'object', properties: {} }
        }
      }
    ],
    execute: async (name: string, args: any) => `tool executed: ${name}`
  }

  const defaultLlm = {
    streamChat: async function* (messages: any[], options: any) {
      yield { type: 'chunk', content: 'Test ' }
      yield { type: 'chunk', content: 'response.' }
    }
  }

  const defaultMiddleware = {
    runBeforeChat: async (ctx: any) => {},
    runAfterChat: async (ctx: any) => ({ shouldContinue: false }),
    runBeforeTool: async (ctx: any) => ({ shouldBlock: false }),
    runAfterTool: async (ctx: any) => ctx.output
  }

  return {
    session: 'session' in overrides ? overrides.session : defaultSession,
    settings: 'settings' in overrides ? overrides.settings : defaultSettings,
    tools: 'tools' in overrides ? overrides.tools : defaultTools,
    llm: 'llm' in overrides ? overrides.llm : defaultLlm,
    agentMiddleware: 'agentMiddleware' in overrides ? overrides.agentMiddleware : defaultMiddleware,
    agentPresets: overrides.agentPresets,
    persona: overrides.persona,
    systemPrompt: overrides.systemPrompt,
    compactor: overrides.compactor,
    repeatGuard: overrides.repeatGuard,
    approval: overrides.approval,
    spillStore: overrides.spillStore,
    skills: overrides.skills
  } as any
}
