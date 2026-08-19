import type { Context } from '@custom-harness/core-context'
import * as fs from '@custom-harness/fs'
import * as fsLocal from '@custom-harness/fs-local'
import * as subprocess from '@custom-harness/subprocess'
import * as subprocessLocal from '@custom-harness/subprocess-local'
import * as spill from '@custom-harness/spill'
import * as spillLocal from '@custom-harness/spill-local'
import * as userApproval from '@custom-harness/user-approval'
import * as settings from '@custom-harness/settings'
import * as systemPrompt from '@custom-harness/core-system-prompt'
import * as tools from '@custom-harness/core-tools'
import * as llm from '@custom-harness/llm'
import * as session from '@custom-harness/session'
import * as agentPresets from '@custom-harness/preset-agent-presets'
import * as persona from '@custom-harness/preset-persona'
import * as repeatGuard from '@custom-harness/guard-repeat-tool-reminder'
import * as toolResultPruner from '@custom-harness/compaction-tool-result-pruner'
import * as compactor from '@custom-harness/compaction-basic'
import * as agent from '@custom-harness/core-agent'
import * as tokenMeter from '@custom-harness/token-meter'
import * as bash from '@custom-harness/tool-bash'
import * as bashPersistent from '@custom-harness/tool-bash-persistent'
import * as toolFs from '@custom-harness/tool-fs'

export interface HeadlessConfig {
  llmPlugin?: any
}

export async function apply(ctx: Context, config: HeadlessConfig = {}) {
  // 1. Capability Seams & Providers
  await ctx.plugin(fs)
  await ctx.plugin(fsLocal)
  await ctx.plugin(subprocess)
  await ctx.plugin(subprocessLocal)
  await ctx.plugin(spill)
  await ctx.plugin(spillLocal)
  await ctx.plugin(userApproval)

  // 2. Core Infrastructure & Services
  await ctx.plugin(settings)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(tools)
  await ctx.plugin(config.llmPlugin || llm)
  await ctx.plugin(session)
  await ctx.plugin(agentPresets)
  await ctx.plugin(persona)
  await ctx.plugin(repeatGuard)
  await ctx.plugin(toolResultPruner)
  await ctx.plugin(compactor)
  await ctx.plugin(agent)
  await ctx.plugin(tokenMeter)

  // 3. Focused Coding Tools for Benchmarks
  await ctx.plugin(toolFs)
}

