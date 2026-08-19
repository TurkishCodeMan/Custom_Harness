#!/usr/bin/env node
import { Context } from '@custom-harness/core-context'
import * as settings from '@custom-harness/settings'
import * as tools from '@custom-harness/core-tools'
import * as llm from '@custom-harness/llm'
import * as session from '@custom-harness/session'
import * as agent from '@custom-harness/core-agent'
import * as bash from '@custom-harness/tool-bash'
import * as skills from '@custom-harness/tool-skill'
import readline from 'node:readline'

async function main() {
  console.log('⚡ Custom Harness CLI Başlatılıyor...\n')

  const ctx = new Context()
  ctx.plugin(settings)
  ctx.plugin(tools)
  ctx.plugin(llm)
  ctx.plugin(session)
  ctx.plugin(agent)
  ctx.plugin(bash)
  ctx.plugin(skills)

  await ctx.start()

  const currentSession = ctx.session.createSession('CLI Session')
  console.log(`📁 Çalışma Alanı: ${currentSession.workspace}`)
  console.log(`🤖 Aktif Model: ${ctx.settings.getActiveModel()?.name || ctx.settings.getActiveModel()?.id}`)
  console.log(`(Çıkmak için 'exit' veya Ctrl+C)\n`)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '⚡ prompt> '
  })

  rl.prompt()

  rl.on('line', async (line) => {
    const input = line.trim()
    if (!input) {
      rl.prompt()
      return
    }

    if (input === 'exit' || input === 'quit') {
      process.exit(0)
    }

    try {
      console.log('\n[Asistan düşünülüyor...]')
      const response = await ctx.agent.run({
        sessionId: currentSession.id,
        prompt: input,
        onThought: (text) => process.stdout.write(`\x1b[90m${text}\x1b[0m`),
        onChunk: (text) => process.stdout.write(text),
        onToolStart: (call) => console.log(`\n\x1b[36m⚙️ [Araç Başlatıldı]: ${call.name}\x1b[0m`),
        onToolResult: (res) => console.log(`\x1b[32m✔ [Araç Tamamlandı]: ${res.name}\x1b[0m\n`)
      })
      console.log('\n')
    } catch (err: any) {
      console.error(`\x1b[31mHata: ${err.message}\x1b[0m\n`)
    }

    rl.prompt()
  })
}

main().catch((err) => {
  console.error('CLI Fatal Error:', err)
  process.exit(1)
})
