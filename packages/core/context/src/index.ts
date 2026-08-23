import { Context as BaseContext } from 'cordis'
import type { LlmService } from '@custom-harness/llm'
import type { ToolsService } from '@custom-harness/core-tools'
import type { AgentService } from '@custom-harness/core-agent'
import type { SessionService } from '@custom-harness/session'
import type { SettingsService } from '@custom-harness/settings'
import type { SkillsService } from '@custom-harness/tool-skill'
import type { TokenMeterService } from '@custom-harness/token-meter'
import type { AgentPresetsService } from '@custom-harness/preset-agent-presets'
import type { PersonaService } from '@custom-harness/preset-persona'
import type { SystemPromptService } from '@custom-harness/core-system-prompt'
import type { RepeatToolGuardService } from '@custom-harness/guard-repeat-tool-reminder'
import type { ToolResultPrunerService } from '@custom-harness/compaction-tool-result-pruner'
import type { CompactionBasicService } from '@custom-harness/compaction-basic'
import type { SpillService } from '@custom-harness/spill'
import type { RagService } from '@custom-harness/rag'
import type { AuthService } from '@custom-harness/auth'

declare module 'cordis' {
  interface Events {
    'ready'(): void | Promise<void>
    'dispose'(): void | Promise<void>
    'approval/asked'(request: any): void
    'user-question/asked'(request: any): void
  }

  interface Context {
    start(): Promise<void>
    stop(): Promise<void>
    auth: AuthService
    llm: LlmService
    tools: ToolsService
    agent: AgentService
    session: SessionService
    settings: SettingsService
    skills: SkillsService
    tokenMeter: TokenMeterService
    agentPresets: AgentPresetsService
    persona: PersonaService
    systemPrompt: SystemPromptService
    repeatGuard: RepeatToolGuardService
    toolResultPruner: ToolResultPrunerService
    compactor: CompactionBasicService
    userQuestions: any
    lsp: any
    planMode: any
    subagent: any
    mcpClient: any
    goal: any
    fs: any
    subprocess: any
    approval: any
    spillStore: SpillService
    rag: RagService
    web: any
    jobs: any
    terminals: any
    agentMiddleware: any
    workflowEngine: any
  }
}

export class Context extends BaseContext {
  constructor(config?: any) {
    super()
  }

  async start(): Promise<void> {
    const runtimes = Array.from((this as any).registry?.values?.() || [])
    const fibers = runtimes.flatMap((r: any) => Array.from((r as any).fibers || []))
    await Promise.all(fibers.map((f: any) => f.await?.()))
    await (this as any).parallel?.('ready')
  }

  async stop(): Promise<void> {
    await (this as any).parallel?.('dispose')
  }
}
