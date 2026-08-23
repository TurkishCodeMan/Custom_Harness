import type { Context } from '@custom-harness/core-context'
import * as fs from '@custom-harness/fs'
import * as fsLocal from '@custom-harness/fs-local'
import * as subprocess from '@custom-harness/subprocess'
import * as subprocessLocal from '@custom-harness/subprocess-local'
import * as sandbox from '@custom-harness/sandbox'
import * as sandboxLocal from '@custom-harness/sandbox-local'
import * as spill from '@custom-harness/spill'
import * as spillLocal from '@custom-harness/spill-local'
import * as userApproval from '@custom-harness/user-approval'
import * as userQuestions from '@custom-harness/user-questions'
import * as lsp from '@custom-harness/lsp'
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
import * as agentMiddleware from '@custom-harness/agent-middleware'
import * as agentMiddlewareBuiltin from '@custom-harness/agent-middleware-builtin'
import * as tokenMeter from '@custom-harness/token-meter'

import * as bash from '@custom-harness/tool-bash'
import * as bashPersistent from '@custom-harness/tool-bash-persistent'
import * as toolFs from '@custom-harness/tool-fs'
import * as toolTodo from '@custom-harness/tool-todo'
import * as skills from '@custom-harness/tool-skill'
import * as toolAskUser from '@custom-harness/tool-ask-user'
import * as toolLsp from '@custom-harness/tool-lsp'
import * as planMode from '@custom-harness/plan-mode'
import * as subagent from '@custom-harness/subagent'
import * as toolSubagent from '@custom-harness/tool-subagent'
import * as mcpClient from '@custom-harness/mcp-client'
import * as toolGoal from '@custom-harness/tool-goal'
import * as toolSessionQuery from '@custom-harness/tool-session-query'
import * as toolFsSearch from '@custom-harness/tool-fs-search'
import * as rag from '@custom-harness/rag'
import * as ragPgVector from '@custom-harness/rag-pgvector'
import * as toolRag from '@custom-harness/tool-rag'
import * as auth from '@custom-harness/auth'
import * as authLocal from '@custom-harness/auth-local'
import * as web from '@custom-harness/web-service'
import * as webFetchHttp from '@custom-harness/web-fetch-http'
import * as webSearch from '@custom-harness/web-search'
import * as toolWeb from '@custom-harness/tool-web'
import * as jobs from '@custom-harness/jobs'
import * as jobsLocal from '@custom-harness/jobs-local'
import * as toolJobs from '@custom-harness/tool-jobs'
import * as terminals from '@custom-harness/terminal'
import * as terminalBash from '@custom-harness/terminal-bash'
import * as toolTerminal from '@custom-harness/tool-terminal'
import * as workflow from '@custom-harness/workflow'
import * as workflowWorkerThread from '@custom-harness/workflow-worker-thread'
import * as toolWorkflow from '@custom-harness/tool-workflow'
import * as toolRalph from '@custom-harness/tool-ralph'

export const name = 'bundle-base'

export function apply(ctx: Context) {
  // 1. Capability Seams & Providers
  ctx.plugin(auth)
  ctx.plugin(authLocal)
  ctx.plugin(fs)
  ctx.plugin(fsLocal)
  ctx.plugin(sandbox)
  ctx.plugin(sandboxLocal)
  ctx.plugin(subprocess)
  ctx.plugin(subprocessLocal)
  ctx.plugin(spill)
  ctx.plugin(spillLocal)
  ctx.plugin(userApproval)
  ctx.plugin(userQuestions)
  ctx.plugin(lsp)
  ctx.plugin(rag)
  ctx.plugin(ragPgVector)
  ctx.plugin(web)
  ctx.plugin(webFetchHttp)
  ctx.plugin(webSearch)
  ctx.plugin(jobs)
  ctx.plugin(jobsLocal)
  ctx.plugin(terminals)
  ctx.plugin(terminalBash)
  ctx.plugin(workflow)
  ctx.plugin(workflowWorkerThread)

  // 2. Core Infrastructure & Services
  ctx.plugin(settings)
  ctx.plugin(systemPrompt)
  ctx.plugin(tools)
  ctx.plugin(llm)
  ctx.plugin(session)
  ctx.plugin(agentPresets)
  ctx.plugin(persona)
  ctx.plugin(repeatGuard)
  ctx.plugin(toolResultPruner)
  ctx.plugin(compactor)
  ctx.plugin(agentMiddleware)
  ctx.plugin(agentMiddlewareBuiltin)
  ctx.plugin(agent)
  ctx.plugin(tokenMeter)

  ctx.plugin(planMode)
  ctx.plugin(subagent)
  ctx.plugin(mcpClient)
  ctx.plugin(toolGoal)

  // 3. Built-in Tools
  ctx.plugin(bash)
  ctx.plugin(bashPersistent)
  ctx.plugin(toolFs)
  ctx.plugin(toolTodo)
  ctx.plugin(skills)
  ctx.plugin(toolAskUser)
  ctx.plugin(toolLsp)
  ctx.plugin(toolSubagent)
  ctx.plugin(toolSessionQuery)
  ctx.plugin(toolFsSearch)
  ctx.plugin(toolRag)
  ctx.plugin(toolWeb)
  ctx.plugin(toolJobs)
  ctx.plugin(toolTerminal)
  ctx.plugin(toolWorkflow)
  ctx.plugin(toolRalph)
}



