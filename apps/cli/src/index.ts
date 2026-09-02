import { Context } from '@custom-harness/core-context'
import * as headlessBundle from '@custom-harness/bundle-headless'
import * as llmQwen from '@custom-harness/llm-qwen'
import readline from 'node:readline'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// ANSI Color helper
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  inverse: '\x1b[7m'
}

interface SlashCommand {
  name: string
  desc: string
  icon: string
  snippet?: string
}

const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/workspace', desc: 'İnteraktif çalışma dizini gezgini ve seçici (/workspace [yol])', icon: '📁', snippet: '/workspace' },
  { name: '/preset', desc: 'İnteraktif ajan rolü/kişiliği seçici (/preset)', icon: '🎭', snippet: '/preset' },
  { name: '/model', desc: 'İnteraktif LLM sağlayıcı ve model seçici (/model)', icon: '🤖', snippet: '/model' },
  { name: '/mode', desc: 'İnteraktif çalışma motoru seçici (full | minimal)', icon: '⚙️ ', snippet: '/mode' },
  { name: '/sessions', desc: 'İnteraktif Oturum Yöneticisi (Gezin, Seç veya Sil)', icon: '📋', snippet: '/sessions' },
  { name: '/new', desc: 'Sıfırdan yeni bir oturum başlat', icon: '✨', snippet: '/new' },
  { name: '/yolo', desc: 'YOLO / Auto-Approve (Onay sormadan tüm komutları otomatik çalıştır)', icon: '⚡', snippet: '/yolo' },
  { name: '/think', desc: 'Modele giden düşünme (Reasoning) yeteneğini aç/kapat (/think on|off|<bütçe>)', icon: '💭', snippet: '/think ' },
  { name: '/goal', desc: 'Otonom hedef tanımla (-b veya --background ile arka planda çalıştır)', icon: '🎯', snippet: '/goal ' },
  { name: '/jobs', desc: 'Çalışan veya tamamlanan arka plan görevlerini listele', icon: '⏱️ ', snippet: '/jobs' },
  { name: '/logs', desc: 'Arka plandaki görevin loglarını incele (/logs <job_id>)', icon: '📜', snippet: '/logs ' },
  { name: '/kill', desc: 'Çalışan bir arka plan görevini anında durdur/iptal et (/kill <job_id>)', icon: '🛑', snippet: '/kill ' },
  { name: '/compact', desc: 'Sohbet geçmişini özetleyip bağlam penceresini temizle', icon: '📦', snippet: '/compact' },

  { name: '/tokens', desc: 'Canlı token tüketimini ve bağlam doluluğunu göster', icon: '📊', snippet: '/tokens' },
  { name: '/clear', desc: 'Terminal ekranını temizle', icon: '🧹', snippet: '/clear' },
  { name: '/help', desc: 'Tüm komutların detaylı yardım listesini göster', icon: '❓', snippet: '/help' },
  { name: '/exit', desc: 'Terminalden çıkış yap', icon: '👋', snippet: '/exit' }
]


async function main() {
  console.clear()
  console.log(`${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`)
  console.log(`${c.bold}${c.cyan}║   🤖 DeepSeek Harness — Claude Code Interactive CLI Terminal & Live Palette  ║${c.reset}`)
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`)

  const args = process.argv.slice(2)
  const isQwen = args.includes('qwen-local') || args.includes('--llm-qwen') || process.env.LLM_PROVIDER === 'qwen-local'

  const ctx = new Context()
  ctx.plugin(headlessBundle, { llmPlugin: isQwen ? llmQwen : undefined })
  await ctx.start()


  // Headless Task Execution for SWE-bench & Automated Benchmarks
  const taskArgIndex = args.indexOf('--task')
  const taskText = taskArgIndex !== -1 ? args[taskArgIndex + 1] : (args.length > 0 && !args[0].startsWith('-') ? args.join(' ') : null)

  if (taskText) {
    const workspace = process.env.WORKSPACE_DIR || process.cwd()
    const headlessSession = ctx.session.createSession('SWE Benchmark Task', workspace, undefined, 'cli')
    ctx.approval?.setPolicy('auto') // Auto-approve all tools during automated benchmark

    // Configure Autonomous Software Engineer Persona
    ctx.persona?.setCustomPersona(`You are an autonomous AI Software Engineer solving issues in a GitHub repository.
Working Directory: ${workspace}

Available Tools: 'read', 'edit', 'write', 'read_file', 'edit_file', 'grep_search', 'list_dir', 'git_diff', 'finish_task'.

INSTRUCTIONS:
1. Locate and examine the relevant source code using 'read' (or 'read_file') or 'grep_search'.
2. Directly patch the bug in the repository source files using 'edit' (or 'edit_file') replacing old_string with new_string.
3. Review your git changes using 'git_diff'.
4. Call 'finish_task' with a concise summary when the fix is applied.
NOTE: Do not create reproduction scripts (such as repro.py). Directly locate and fix the bug in the existing repository source files.

STRICT RULE: Do not read/search more than 3 times. As soon as you identify the file and class, apply the fix using 'edit_file' immediately. Do not hesitate.

`) 

    const promptToSend = `TASK / ISSUE DESCRIPTION:
${taskText}`

    const providerArgIndex = args.indexOf('--provider')
    const providerId = providerArgIndex !== -1 ? args[providerArgIndex + 1] : process.env.LLM_PROVIDER
    const modelArgIndex = args.indexOf('--model')
    const modelId = modelArgIndex !== -1 ? args[modelArgIndex + 1] : process.env.LLM_MODEL

    try {
      await ctx.agent.run({
        sessionId: headlessSession.id,
        prompt: promptToSend,
        providerId: providerId || undefined,
        modelId: modelId || undefined,
        autonomous: true,
        enableThinking: true,
        thinkingBudgetTokens: 2048,
        onThought: () => {}, // Background thinking active, silenced from terminal
        onChunk: (c) => process.stdout.write(c),
        onToolStart: (call) => console.log(`\n⚙️ [Araç]: ${call.name} ${JSON.stringify(call.args || {})}`),
        onToolResult: (res) => console.log(`✅ [Tamamlandı]: ${res.name} -> ${typeof res.output === 'string' ? res.output.slice(0, 150) : JSON.stringify(res.output)}`)
      })
      console.log(`\n[Custom-Harness] Görev başarıyla tamamlandı.`)
      process.exit(0)
    } catch (err: any) {
      console.error(`\n[Custom-Harness Hata]:`, err.message)
      process.exit(1)
    }
  }

  let currentMode: 'full' | 'minimal' = 'full'
  let activeGoal: string | null = null
  let isYoloMode = false
  let enableModelThinking = false // Directly controls model API thinking parameter
  let thinkingBudget = 1024
  let currentPreset: any = ctx.agentPresets ? ctx.agentPresets.getActive() : ctx.settings?.getActivePreset?.()

  // Connect approval requests to terminal prompt
  let pendingApprovalResolve: ((outcome: any) => void) | null = null
  ctx.on('approval/asked' as any, (req: any) => {
    if (isYoloMode) {
      ctx.approval.respond(req.id, 'allow_always')
      console.log(`\n${c.green}⚡ [YOLO AUTO-APPROVE]:${c.reset} ${c.bold}${req.toolName}${c.reset} otomatik onaylandı.`)
      return
    }
    console.log(`\n${c.bold}${c.yellow}⚠️  [KULLANICI ONAYI GEREKİYOR]:${c.reset} ${c.yellow}${req.toolName}${c.reset}`)
    console.log(`${c.gray}Argümanlar: ${JSON.stringify(req.args, null, 2)}${c.reset}`)
    process.stdout.write(`${c.bold}İzin veriyor musunuz? [y: İzin Ver, a: Hep İzin Ver, n: Reddet] > ${c.reset}`)
    pendingApprovalResolve = (outcome: any) => {
      ctx.approval.respond(req.id, outcome)
      pendingApprovalResolve = null
    }
  })

  // Always start with a fresh new session on CLI launch
  let currentSession = ctx.session.createSession('CLI Session', undefined, undefined, 'cli')
  console.log(`${c.green}✨ Yeni Oturum Başlatıldı:${c.reset} ${c.gray}${currentSession.id}${c.reset}`)
  const activePresetName = currentPreset ? `${currentPreset.icon || '🎭'} ${currentPreset.name}` : 'Full-Stack Developer'
  console.log(`${c.bold}${c.green}✓ Aktif Ajan Rolü:${c.reset} ${c.bold}${c.yellow}${activePresetName}${c.reset} ${c.gray}(Değiştirmek için: ${c.cyan}/preset${c.gray})${c.reset}`)
  console.log(`${c.gray}Önceki oturumlara geçmek için ${c.cyan}/sessions${c.gray}, yeni oturum için ${c.cyan}/new${c.gray} yazabilirsiniz.${c.reset}\n`)

  // Zero-flicker, zero-ghosting TUI Pane Renderer
  class TerminalPaneRenderer {
    private lastLineCount = 0

    public clear() {
      if (this.lastLineCount > 0) {
        readline.cursorTo(process.stdout, 0)
        for (let i = 0; i < this.lastLineCount; i++) {
          readline.clearLine(process.stdout, 0)
          if (i < this.lastLineCount - 1) {
            process.stdout.write('\x1b[1A')
          }
        }
        readline.cursorTo(process.stdout, 0)
        readline.clearLine(process.stdout, 0)
        this.lastLineCount = 0
      }
    }

    public render(lines: string[]) {
      this.clear()
      const cleanLines = lines.map(l => l.replace(/[\r\n]/g, ''))
      process.stdout.write('\n' + cleanLines.join('\n'))
      this.lastLineCount = cleanLines.length + 1
    }

    public close() {
      this.clear()
    }
  }

  // Interactive Session Manager Pane (Arrow keys to navigate, Enter to switch, 'd' to safely delete)
  const manageSessionsInteractive = async (): Promise<any> => {
    let sessions = ctx.session.listSessions(undefined, true, 'cli')
    if (sessions.length === 0) {
      console.log(`\n${c.gray}Kayıtlı oturum bulunamadı.${c.reset}\n`)
      return currentSession
    }

    let selectedIndex = sessions.findIndex(s => s.id === currentSession.id)
    if (selectedIndex < 0) selectedIndex = 0

    return new Promise((resolve) => {
      let isPromptingDelete = false
      const pane = new TerminalPaneRenderer()

      readline.emitKeypressEvents(process.stdin)
      if (process.stdin.isTTY) process.stdin.setRawMode(true)

      const render = () => {
        const lines: string[] = []
        lines.push(`${c.bold}${c.cyan}╭── 📋 İNTERAKTİF OTURUM YÖNETİCİSİ ──────────────────────────────────────────╮${c.reset}`)
        lines.push(`│  ${c.gray}Klavye:${c.reset} ${c.yellow}↑/↓${c.reset}: Gezin  ·  ${c.green}Enter${c.reset}: Seç  ·  ${c.red}d / Delete${c.reset}: Sil  ·  ${c.cyan}Esc${c.reset}: Çık  │`)
        lines.push(`${c.bold}${c.cyan}├─────────────────────────────────────────────────────────────────────────────┤${c.reset}`)

        sessions.slice(0, 8).forEach((s, idx) => {
          const isSelected = idx === selectedIndex
          const isCurrent = s.id === currentSession.id
          const prefix = isSelected ? `${c.bold}${c.yellow} ❯ ${c.reset}` : '   '
          const badge = isCurrent ? `${c.green}[Aktif]${c.reset} ` : ''
          const timeStr = new Date(s.updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          const titleStr = s.title.slice(0, 24).padEnd(24)
          const idStr = s.id.slice(0, 18)

          const fullLine = `${prefix}💬 ${badge}${isSelected ? c.bold + c.cyan + c.inverse + titleStr + c.reset : c.bold + titleStr + c.reset} ${c.gray}(${timeStr}, ${idStr})${c.reset}`
          lines.push(`│ ${fullLine.padEnd(85)}│`)
        })

        if (isPromptingDelete) {
          const target = sessions[selectedIndex]
          lines.push(`${c.bold}${c.red}├─────────────────────────────────────────────────────────────────────────────┤${c.reset}`)
          lines.push(`│ ${c.bold}${c.red}⚠️  "${target.title}" oturumunu silmek istiyor musunuz? [e: Evet, h: Hayır]   ${c.reset}│`)
        }

        lines.push(`${c.bold}${c.cyan}╰─────────────────────────────────────────────────────────────────────────────╯${c.reset}`)
        pane.render(lines)
      }

      const cleanup = () => {
        pane.close()
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.removeListener('keypress', onKey)
      }

      const onKey = (_str: string, key: readline.Key) => {
        if (!key) return

        if (key.ctrl && key.name === 'c') {
          cleanup()
          console.log('\n')
          process.exit(0)
        }

        if (isPromptingDelete) {
          if (_str === 'e' || _str === 'E' || _str === 'y' || _str === 'Y') {
            const target = sessions[selectedIndex]
            ctx.session.deleteSession(target.id)
            sessions = ctx.session.listSessions(undefined, true, 'cli')
            if (target.id === currentSession.id) {
              currentSession = sessions.length > 0
                ? (ctx.session.getSession(sessions[0].id) || ctx.session.createSession('CLI Session', undefined, undefined, 'cli'))
                : ctx.session.createSession('CLI Session', undefined, undefined, 'cli')
            }
            if (selectedIndex >= sessions.length) selectedIndex = Math.max(0, sessions.length - 1)
            isPromptingDelete = false
            if (sessions.length === 0) {
              cleanup()
              console.log(`\n${c.green}✓ Oturum silindi. Tüm oturumlar temizlendi.${c.reset}\n`)
              resolve(currentSession)
              return
            }
            render()
            return
          } else {
            isPromptingDelete = false
            render()
            return
          }
        }

        if (key.name === 'up') {
          selectedIndex--
          if (selectedIndex < 0) selectedIndex = sessions.length - 1
          render()
          return
        }

        if (key.name === 'down') {
          selectedIndex++
          if (selectedIndex >= sessions.length) selectedIndex = 0
          render()
          return
        }

        // 'd' or delete key to trigger safe deletion prompt
        if (_str === 'd' || _str === 'D' || key.name === 'delete') {
          if (sessions.length > 0) {
            isPromptingDelete = true
            render()
          }
          return
        }

        // Enter to select session
        if (key.name === 'return') {
          cleanup()
          const chosen = sessions[selectedIndex]
          if (chosen) {
            const loaded = ctx.session.getSession(chosen.id)
            if (loaded) currentSession = loaded
            console.log(`\n${c.bold}${c.green}✓ Oturum Seçildi:${c.reset} ${c.bold}${currentSession.title}${c.reset} ${c.gray}(${currentSession.messages?.length || 0} mesaj, ID: ${currentSession.id})${c.reset}\n`)
          }
          resolve(currentSession)
          return
        }

        // Escape or 'q' to close pane
        if (key.name === 'escape' || _str === 'q') {
          cleanup()
          console.log('')
          resolve(currentSession)
          return
        }
      }

      process.stdin.on('keypress', onKey)
      render()
    })
  }

  // Interactive Workspace Directory Browser Pane (Claude Code style)
  const openInteractiveWorkspacePicker = async (): Promise<string> => {
    let currentBrowsingDir = currentSession.workspace || process.cwd()
    let selectedIndex = 0

    return new Promise((resolve) => {
      const pane = new TerminalPaneRenderer()

      readline.emitKeypressEvents(process.stdin)
      if (process.stdin.isTTY) process.stdin.setRawMode(true)

      const getDirectoryItems = () => {
        const items: { label: string; fullPath: string; isDir: boolean; isAction?: boolean }[] = [
          { label: `🎯 [BU DİZİNİ SEÇ]: ${path.basename(currentBrowsingDir) || currentBrowsingDir}`, fullPath: currentBrowsingDir, isDir: true, isAction: true },
          { label: `📁 .. (Üst Dizin: ${path.dirname(currentBrowsingDir)})`, fullPath: path.dirname(currentBrowsingDir), isDir: true }
        ]
        try {
          const entries = fs.readdirSync(currentBrowsingDir, { withFileTypes: true })
          const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name))
          for (const d of dirs) {
            const subPath = path.join(currentBrowsingDir, d.name)
            items.push({ label: `📁 ${d.name}/`, fullPath: subPath, isDir: true })
          }
        } catch (e) {}
        return items
      }

      let items = getDirectoryItems()

      const render = () => {
        items = getDirectoryItems()
        if (selectedIndex >= items.length) selectedIndex = Math.max(0, items.length - 1)

        const lines: string[] = []
        lines.push(`${c.bold}${c.cyan}╭── 📁 İNTERAKTİF ÇALIŞMA DİZİNİ GEZGİNİ ──────────────────────────────────────╮${c.reset}`)
        const curShort = currentBrowsingDir.length > 64 ? '...' + currentBrowsingDir.slice(-61) : currentBrowsingDir.padEnd(64)
        lines.push(`│  ${c.gray}Mevcut:${c.reset} ${c.bold}${c.yellow}${curShort}${c.reset} │`)
        lines.push(`│  ${c.gray}Klavye:${c.reset} ${c.yellow}↑/↓${c.reset}: Gezin  ·  ${c.green}Enter${c.reset}: Klasöre Gir  ·  ${c.green}Space${c.reset}: Seç  ·  ${c.cyan}Esc${c.reset}: Çık       │`)
        lines.push(`${c.bold}${c.cyan}├─────────────────────────────────────────────────────────────────────────────┤${c.reset}`)

        const windowSize = 8
        const startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(windowSize / 2), Math.max(0, items.length - windowSize)))
        const visibleItems = items.slice(startIdx, startIdx + windowSize)

        visibleItems.forEach((item, relativeIdx) => {
          const actualIdx = startIdx + relativeIdx
          const isSelected = actualIdx === selectedIndex
          const prefix = isSelected ? `${c.bold}${c.yellow} ❯ ${c.reset}` : '   '
          const labelRaw = item.label.slice(0, 68).padEnd(68)
          const labelFormatted = isSelected ? `${c.bold}${c.cyan}${c.inverse} ${labelRaw} ${c.reset}` : ` ${c.bold}${labelRaw}${c.reset} `
          lines.push(`│${prefix}${labelFormatted}│`)
        })

        lines.push(`${c.bold}${c.cyan}╰─────────────────────────────────────────────────────────────────────────────╯${c.reset}`)
        pane.render(lines)
      }

      const cleanup = () => {
        pane.close()
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.removeListener('keypress', onKey)
      }

      const onKey = (_str: string, key: readline.Key) => {
        if (!key) return
        if (key.ctrl && key.name === 'c') {
          cleanup()
          process.exit(0)
        }

        if (key.name === 'up') {
          selectedIndex--
          if (selectedIndex < 0) selectedIndex = items.length - 1
          render()
          return
        }

        if (key.name === 'down') {
          selectedIndex++
          if (selectedIndex >= items.length) selectedIndex = 0
          render()
          return
        }

        // Space or Enter on [BU DİZİNİ SEÇ]
        if (_str === ' ' || (key.name === 'return' && items[selectedIndex]?.isAction)) {
          cleanup()
          const chosen = currentBrowsingDir
          try {
            process.chdir(chosen)
            currentSession.workspace = chosen
            ctx.session?.saveSession?.(currentSession)
            ctx.settings?.updateSettings?.({ workspace: chosen })
            if ((ctx as any).fs?.setWorkspaceRoot) (ctx as any).fs.setWorkspaceRoot(chosen)
            console.log(`\n${c.bold}${c.green}✓ Çalışma Dizini Başarıyla Değiştirildi:${c.reset} ${c.bold}${c.cyan}${chosen}${c.reset}\n`)
          } catch (err: any) {
            console.log(`\n${c.red}❌ Hata: ${err.message}${c.reset}\n`)
          }
          resolve(chosen)
          return
        }

        // Enter on folder
        if (key.name === 'return') {
          const item = items[selectedIndex]
          if (item && item.isDir) {
            currentBrowsingDir = item.fullPath
            selectedIndex = 0
            render()
          }
          return
        }

        // Escape or 'q' to close
        if (key.name === 'escape' || _str === 'q') {
          cleanup()
          console.log('')
          resolve(currentSession.workspace || process.cwd())
          return
        }
      }

      process.stdin.on('keypress', onKey)
      render()
    })
  }

  // Interactive Preset Selector Pane
  const openInteractivePresetPicker = async (): Promise<any> => {
    const presets = ctx.agentPresets ? ctx.agentPresets.list() : ctx.settings.getPresets()
    let selectedIndex = 0

    return new Promise((resolve) => {
      const pane = new TerminalPaneRenderer()

      readline.emitKeypressEvents(process.stdin)
      if (process.stdin.isTTY) process.stdin.setRawMode(true)

      const render = () => {
        const lines: string[] = []
        lines.push(`${c.bold}${c.cyan}╭── 🎭 İNTERAKTİF AJAN ROLÜ SEÇİCİ (PRESETS) ────────────────────────────────╮${c.reset}`)
        lines.push(`│  ${c.gray}Klavye:${c.reset} ${c.yellow}↑/↓${c.reset}: Gezin  ·  ${c.green}Enter${c.reset}: Rolü Seç ve Uygula  ·  ${c.cyan}Esc${c.reset}: İptal               │`)
        lines.push(`${c.bold}${c.cyan}├─────────────────────────────────────────────────────────────────────────────┤${c.reset}`)

        presets.forEach((p: any, idx: number) => {
          const isSelected = idx === selectedIndex
          const prefix = isSelected ? `${c.bold}${c.yellow} ❯ ${c.reset}` : '   '
          const nameStr = `${p.icon || '🤖'} ${p.name}`.padEnd(26)
          const descStr = (p.description || '').slice(0, 42).padEnd(42)
          const formatted = isSelected
            ? `${c.bold}${c.cyan}${c.inverse} ${nameStr} ${c.reset} ${c.gray}│${c.reset} ${c.cyan}${descStr}${c.reset}`
            : `${c.bold}${nameStr}${c.reset} ${c.gray}│${c.reset} ${descStr}`
          lines.push(`│ ${prefix}${formatted} │`)
        })

        lines.push(`${c.bold}${c.cyan}╰─────────────────────────────────────────────────────────────────────────────╯${c.reset}`)
        pane.render(lines)
      }

      const cleanup = () => {
        pane.close()
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.removeListener('keypress', onKey)
      }

      const onKey = (_str: string, key: readline.Key) => {
        if (!key) return
        if (key.ctrl && key.name === 'c') {
          cleanup()
          process.exit(0)
        }

        if (key.name === 'up') {
          selectedIndex--
          if (selectedIndex < 0) selectedIndex = presets.length - 1
          render()
          return
        }

        if (key.name === 'down') {
          selectedIndex++
          if (selectedIndex >= presets.length) selectedIndex = 0
          render()
          return
        }

        if (key.name === 'return') {
          cleanup()
          const chosen = presets[selectedIndex]
          if (chosen) {
            currentPreset = chosen
            if (ctx.agentPresets) ctx.agentPresets.select(chosen.id)
            console.log(`\n${c.bold}${c.green}✓ Ajan Rolü Aktifleştirildi:${c.reset} ${chosen.icon || '🎭'} ${c.bold}${chosen.name}${c.reset}\n`)
          }
          resolve(chosen)
          return
        }

        if (key.name === 'escape' || _str === 'q') {
          cleanup()
          console.log('')
          resolve(null)
          return
        }
      }

      process.stdin.on('keypress', onKey)
      render()
    })
  }

  // Interactive Mode Selector Pane
  const openInteractiveModePicker = async (): Promise<string> => {
    const modes = [
      { id: 'full', icon: '🚀', name: 'Full Tool Mode', desc: 'Tam Yetkili: Terminal + Dosya + Todo + Skills + Web + Jobs' },
      { id: 'minimal', icon: '⚡', name: 'Minimal Mode', desc: 'Claude Code 2 Araç: Bash + File String Editor' }
    ]
    let selectedIndex = modes.findIndex(m => m.id === currentMode)
    if (selectedIndex < 0) selectedIndex = 0

    return new Promise((resolve) => {
      const pane = new TerminalPaneRenderer()

      readline.emitKeypressEvents(process.stdin)
      if (process.stdin.isTTY) process.stdin.setRawMode(true)

      const render = () => {
        const lines: string[] = []
        lines.push(`${c.bold}${c.cyan}╭── ⚙️  İNTERAKTİF ÇALIŞMA MOTORU SEÇİCİ (MODES) ──────────────────────────────╮${c.reset}`)
        lines.push(`│  ${c.gray}Klavye:${c.reset} ${c.yellow}↑/↓${c.reset}: Gezin  ·  ${c.green}Enter${c.reset}: Modu Değiştir  ·  ${c.cyan}Esc${c.reset}: İptal                   │`)
        lines.push(`${c.bold}${c.cyan}├─────────────────────────────────────────────────────────────────────────────┤${c.reset}`)

        modes.forEach((m, idx) => {
          const isSelected = idx === selectedIndex
          const prefix = isSelected ? `${c.bold}${c.yellow} ❯ ${c.reset}` : '   '
          const nameStr = `${m.icon} ${m.name}`.padEnd(24)
          const descStr = m.desc.slice(0, 44).padEnd(44)
          const formatted = isSelected
            ? `${c.bold}${c.cyan}${c.inverse} ${nameStr} ${c.reset} ${c.gray}│${c.reset} ${c.cyan}${descStr}${c.reset}`
            : `${c.bold}${nameStr}${c.reset} ${c.gray}│${c.reset} ${descStr}`
          lines.push(`│ ${prefix}${formatted} │`)
        })

        lines.push(`${c.bold}${c.cyan}╰─────────────────────────────────────────────────────────────────────────────╯${c.reset}`)
        pane.render(lines)
      }

      const cleanup = () => {
        pane.close()
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.removeListener('keypress', onKey)
      }

      const onKey = (_str: string, key: readline.Key) => {
        if (!key) return
        if (key.ctrl && key.name === 'c') {
          cleanup()
          process.exit(0)
        }

        if (key.name === 'up') {
          selectedIndex--
          if (selectedIndex < 0) selectedIndex = modes.length - 1
          render()
          return
        }

        if (key.name === 'down') {
          selectedIndex++
          if (selectedIndex >= modes.length) selectedIndex = 0
          render()
          return
        }

        if (key.name === 'return') {
          cleanup()
          const chosen = modes[selectedIndex]
          if (chosen) {
            currentMode = chosen.id as any
            console.log(`\n${c.bold}${c.green}✓ Çalışma Modu Ayarlandı:${c.reset} ${chosen.icon} ${c.bold}${chosen.name}${c.reset}\n`)
          }
          resolve(currentMode)
          return
        }

        if (key.name === 'escape' || _str === 'q') {
          cleanup()
          console.log('')
          resolve(currentMode)
          return
        }
      }

      process.stdin.on('keypress', onKey)
      render()
    })
  }

  // Interactive Model & Provider Selector Pane
  const openInteractiveModelPicker = async (): Promise<any> => {
    const settings = ctx.settings ? ctx.settings.getSettings() : null
    const providersList: { id: string; name: string; baseURL: string; modelId: string; modelName: string }[] = []

    if (settings && settings.providers) {
      for (const [pId, pCfg] of Object.entries(settings.providers as Record<string, any>)) {
        for (const m of pCfg.models || []) {
          providersList.push({
            id: pId,
            name: pCfg.name || pId,
            baseURL: pCfg.baseURL || '',
            modelId: m.id,
            modelName: m.name || m.id
          })
        }
      }
    }

    if (providersList.length === 0) {
      console.log(`\n${c.gray}Yapılandırılmış LLM sağlayıcısı bulunamadı.${c.reset}\n`)
      return
    }

    let selectedIndex = 0

    return new Promise((resolve) => {
      const pane = new TerminalPaneRenderer()

      readline.emitKeypressEvents(process.stdin)
      if (process.stdin.isTTY) process.stdin.setRawMode(true)

      const render = () => {
        const lines: string[] = []
        lines.push(`${c.bold}${c.cyan}╭── 🤖 İNTERAKTİF MODEL VE SAĞLAYICI SEÇİCİ ─────────────────────────────────╮${c.reset}`)
        lines.push(`│  ${c.gray}Klavye:${c.reset} ${c.yellow}↑/↓${c.reset}: Gezin  ·  ${c.green}Enter${c.reset}: Modeli Aktif Yap  ·  ${c.cyan}Esc${c.reset}: İptal              │`)
        lines.push(`${c.bold}${c.cyan}├─────────────────────────────────────────────────────────────────────────────┤${c.reset}`)

        providersList.forEach((item, idx) => {
          const isSelected = idx === selectedIndex
          const prefix = isSelected ? `${c.bold}${c.yellow} ❯ ${c.reset}` : '   '
          const nameStr = `🤖 ${item.modelName}`.slice(0, 28).padEnd(28)
          const urlStr = `${item.name} (${item.baseURL})`.slice(0, 38).padEnd(38)
          const formatted = isSelected
            ? `${c.bold}${c.cyan}${c.inverse} ${nameStr} ${c.reset} ${c.gray}│${c.reset} ${c.cyan}${urlStr}${c.reset}`
            : `${c.bold}${nameStr}${c.reset} ${c.gray}│${c.reset} ${urlStr}`
          lines.push(`│ ${prefix}${formatted} │`)
        })

        lines.push(`${c.bold}${c.cyan}╰─────────────────────────────────────────────────────────────────────────────╯${c.reset}`)
        pane.render(lines)
      }

      const cleanup = () => {
        pane.close()
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.removeListener('keypress', onKey)
      }

      const onKey = (_str: string, key: readline.Key) => {
        if (!key) return
        if (key.ctrl && key.name === 'c') {
          cleanup()
          process.exit(0)
        }

        if (key.name === 'up') {
          selectedIndex--
          if (selectedIndex < 0) selectedIndex = providersList.length - 1
          render()
          return
        }

        if (key.name === 'down') {
          selectedIndex++
          if (selectedIndex >= providersList.length) selectedIndex = 0
          render()
          return
        }

        if (key.name === 'return') {
          cleanup()
          const chosen = providersList[selectedIndex]
          if (chosen) {
            ctx.settings?.updateSettings?.({
              defaultProvider: chosen.id,
              defaultModel: chosen.modelId
            })
            console.log(`\n${c.bold}${c.green}✓ Aktif Model Değiştirildi:${c.reset} 🤖 ${c.bold}${c.cyan}${chosen.modelName}${c.reset} ${c.gray}(${chosen.baseURL})${c.reset}\n`)
          }
          resolve(chosen)
          return
        }

        if (key.name === 'escape' || _str === 'q') {
          cleanup()
          console.log('')
          resolve(null)
          return
        }
      }

      process.stdin.on('keypress', onKey)
      render()
    })
  }

  // Interactive Live Prompt with instant `/` detection, multi-line wrapping support, and arrow navigation
  const readInputInteractive = (promptLabel: string): Promise<string> => {
    return new Promise<string>((resolve) => {
      let buffer = ''
      let cursorIndex = 0
      let selectedMenuIndex = 0
      let lastRenderedDropdownLines = 0
      let prevInputRowCount = 1

      readline.emitKeypressEvents(process.stdin)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true)
      }

      const getFilteredCommands = () => {
        if (!buffer.startsWith('/') || buffer.includes(' ')) return []
        const query = buffer.toLowerCase()
        return SLASH_COMMANDS.filter(cmd => cmd.name.toLowerCase().startsWith(query) || buffer === '/')
      }

      const clearDropdown = () => {
        if (lastRenderedDropdownLines > 0) {
          const cols = process.stdout.columns || 80
          const promptLen = promptLabel.replace(/\x1b\[[0-9;]*m/g, '').length
          const totalLen = promptLen + buffer.length
          const inputRows = Math.max(1, Math.ceil(totalLen / cols))
          const visualCursorPos = promptLen + cursorIndex
          const currentCursorRow = Math.floor(visualCursorPos / cols)

          const downRows = (inputRows - 1) - currentCursorRow
          if (downRows > 0) readline.moveCursor(process.stdout, 0, downRows)

          for (let i = 0; i < lastRenderedDropdownLines; i++) {
            process.stdout.write('\n\x1b[2K')
          }
          process.stdout.write(`\x1b[${lastRenderedDropdownLines}A`)

          if (downRows > 0) readline.moveCursor(process.stdout, 0, -downRows)
          readline.cursorTo(process.stdout, visualCursorPos % cols)
          lastRenderedDropdownLines = 0
        }
      }

      const redraw = () => {
        clearDropdown()

        const cols = process.stdout.columns || 80
        const promptLen = promptLabel.replace(/\x1b\[[0-9;]*m/g, '').length

        // Move to top row of previous input
        if (prevInputRowCount > 1) {
          readline.moveCursor(process.stdout, 0, -(prevInputRowCount - 1))
        }
        readline.cursorTo(process.stdout, 0)

        // Clear all previous input rows
        for (let i = 0; i < prevInputRowCount; i++) {
          readline.clearLine(process.stdout, 0)
          if (i < prevInputRowCount - 1) {
            process.stdout.write('\x1b[1B')
          }
        }

        // Return cursor to top row column 0
        if (prevInputRowCount > 1) {
          readline.moveCursor(process.stdout, 0, -(prevInputRowCount - 1))
        }
        readline.cursorTo(process.stdout, 0)

        // Write full prompt and buffer
        process.stdout.write(`${promptLabel}${buffer}`)

        const totalLen = promptLen + buffer.length
        const currentInputRowCount = Math.max(1, Math.ceil(totalLen / cols))
        prevInputRowCount = currentInputRowCount

        // Position cursor at cursorIndex
        const visualCursorPos = promptLen + cursorIndex
        const targetRow = Math.floor(visualCursorPos / cols)
        const targetCol = visualCursorPos % cols
        const deltaFromBottom = (currentInputRowCount - 1) - targetRow

        if (deltaFromBottom > 0) {
          readline.moveCursor(process.stdout, 0, -deltaFromBottom)
        }
        readline.cursorTo(process.stdout, targetCol)

        // Dropdown menu (only active while typing command name without space)
        if (buffer.startsWith('/') && !buffer.includes(' ')) {
          const filtered = getFilteredCommands()
          if (filtered.length > 0) {
            if (selectedMenuIndex >= filtered.length) selectedMenuIndex = 0
            if (selectedMenuIndex < 0) selectedMenuIndex = filtered.length - 1

            const menuLines: string[] = []
            menuLines.push(`${c.bold}${c.cyan}╭── ⚡ CLAUDE CODE KOMUT MENÜSÜ (↑/↓ ile Seç, Enter ile Çalıştır) ─────────╮${c.reset}`)

            filtered.forEach((cmd, idx) => {
              const isSelected = idx === selectedMenuIndex
              const prefix = isSelected ? `${c.bold}${c.yellow} ❯ ${c.reset}` : '   '
              const nameStr = isSelected ? `${c.bold}${c.cyan}${c.inverse}${cmd.name.padEnd(12)}${c.reset}` : `${c.bold}${c.cyan}${cmd.name.padEnd(12)}${c.reset}`
              const descStr = `${c.gray}│${c.reset} ${cmd.desc}`
              menuLines.push(`│${prefix}${cmd.icon} ${nameStr} ${descStr}`)
            })

            menuLines.push(`${c.bold}${c.cyan}╰──────────────────────────────────────────────────────────────────────────╯${c.reset}`)

            if (deltaFromBottom > 0) {
              readline.moveCursor(process.stdout, 0, deltaFromBottom)
            }

            process.stdout.write('\n' + menuLines.join('\n'))
            lastRenderedDropdownLines = menuLines.length + 1

            process.stdout.write(`\x1b[${lastRenderedDropdownLines}A`)
            if (deltaFromBottom > 0) {
              readline.moveCursor(process.stdout, 0, -deltaFromBottom)
            }
            readline.cursorTo(process.stdout, targetCol)
          }
        }
      }

      const onKeypress = (_str: string, key: readline.Key) => {
        if (!key) return

        if (key.ctrl && key.name === 'c') {
          clearDropdown()
          if (process.stdin.isTTY) process.stdin.setRawMode(false)
          process.stdin.removeListener('keypress', onKeypress)
          console.log('\n')
          process.exit(0)
        }

        const filtered = getFilteredCommands()
        const isMenuOpen = buffer.startsWith('/') && filtered.length > 0

        if (isMenuOpen && key.name === 'up') {
          selectedMenuIndex--
          redraw()
          return
        }

        if (isMenuOpen && key.name === 'down') {
          selectedMenuIndex++
          redraw()
          return
        }

        if (key.name === 'tab') {
          if (isMenuOpen && filtered[selectedMenuIndex]) {
            const chosen = filtered[selectedMenuIndex]
            buffer = chosen.snippet || chosen.name
            cursorIndex = buffer.length
            selectedMenuIndex = 0
            redraw()
            return
          }
        }

        if (key.name === 'return') {
          clearDropdown()
          if (process.stdin.isTTY) process.stdin.setRawMode(false)
          process.stdin.removeListener('keypress', onKeypress)

          const cols = process.stdout.columns || 80
          const promptLen = promptLabel.replace(/\x1b\[[0-9;]*m/g, '').length
          const totalLen = promptLen + buffer.length
          const inputRowCount = Math.max(1, Math.ceil(totalLen / cols))
          const visualCursorPos = promptLen + cursorIndex
          const currentCursorRow = Math.floor(visualCursorPos / cols)
          const downRows = (inputRowCount - 1) - currentCursorRow
          if (downRows > 0) {
            readline.moveCursor(process.stdout, 0, downRows)
          }

          process.stdout.write('\n')

          if (isMenuOpen && (buffer === '/' || !buffer.includes(' '))) {
            const chosen = filtered[selectedMenuIndex]
            if (chosen && chosen.snippet && chosen.snippet.endsWith(' ')) {
              buffer = chosen.snippet
              resolve(buffer.trim())
              return
            } else if (chosen) {
              resolve(chosen.name)
              return
            }
          }

          resolve(buffer.trim())
          return
        }

        if (key.name === 'backspace') {
          if (cursorIndex > 0) {
            buffer = buffer.slice(0, cursorIndex - 1) + buffer.slice(cursorIndex)
            cursorIndex--
            selectedMenuIndex = 0
          }
          redraw()
          return
        }

        if (key.name === 'escape') {
          clearDropdown()
          buffer = ''
          cursorIndex = 0
          redraw()
          return
        }

        if (key.name === 'left') {
          if (cursorIndex > 0) cursorIndex--
          redraw()
          return
        }

        if (key.name === 'right') {
          if (cursorIndex < buffer.length) cursorIndex++
          redraw()
          return
        }

        if (_str && _str.length === 1 && !key.ctrl && !key.meta) {
          buffer = buffer.slice(0, cursorIndex) + _str + buffer.slice(cursorIndex)
          cursorIndex++
          selectedMenuIndex = 0
          redraw()
          return
        }
      }

      process.stdin.on('keypress', onKeypress)
      redraw()
    })
  }

  const promptUser = async () => {
    const yoloBadge = isYoloMode ? `${c.bold}${c.yellow}[YOLO]${c.reset} ` : ''
    const goalBadge = activeGoal ? `${c.bold}${c.green}[GOAL]${c.reset} ` : ''
    const presetLabel = currentPreset ? `${currentPreset.icon || '🎭'} ${currentPreset.name}` : 'Full-Stack Developer'
    const promptLabel = `${yoloBadge}${goalBadge}${c.bold}${c.cyan}dsh (${currentMode} · ${c.yellow}${presetLabel}${c.cyan}) > ${c.reset}`

    const input = await readInputInteractive(promptLabel)

    if (pendingApprovalResolve) {
      const lower = input.toLowerCase()
      if (lower === 'y' || lower === 'yes' || lower === 'evet') {
        pendingApprovalResolve('allow_once')
      } else if (lower === 'a' || lower === 'always') {
        pendingApprovalResolve('allow_always')
      } else {
        pendingApprovalResolve('deny')
      }
      promptUser()
      return
    }

    if (!input) {
      promptUser()
      return
    }

    // Handle Slash Commands
    if (input.startsWith('/')) {
      const [cmd, ...args] = input.split(' ')
      const argStr = args.join(' ').trim()

      if (cmd === '/help') {
        console.log(`\n${c.bold}${c.cyan}╭── ⚡ CLAUDE CODE KOMUT REHBERİ ───────────────────────────────────────────╮${c.reset}`)
        for (const item of SLASH_COMMANDS) {
          console.log(`│  ${item.icon} ${c.bold}${c.cyan}${item.name.padEnd(10)}${c.reset} ${c.gray}│${c.reset} ${item.desc}`)
        }
        console.log(`${c.bold}${c.cyan}╰──────────────────────────────────────────────────────────────────────────╯${c.reset}\n`)
        promptUser()
        return
      }

      if (cmd === '/clear') {
        console.clear()
        promptUser()
        return
      }

      if (cmd === '/exit' || cmd === '/quit') {
        console.log(`${c.green}Görüşmek üzere! 👋${c.reset}`)
        process.exit(0)
      }

      if (cmd === '/workspace' || cmd === '/cd') {
        if (!argStr) {
          await openInteractiveWorkspacePicker()
        } else {
          const resolvedPath = path.resolve(process.cwd(), argStr.replace(/^~/, os.homedir()))
          try {
            if (!fs.existsSync(resolvedPath)) {
              console.log(`\n${c.red}❌ Hata: '${resolvedPath}' dizini bulunamadı.${c.reset}\n`)
            } else if (!fs.statSync(resolvedPath).isDirectory()) {
              console.log(`\n${c.red}❌ Hata: '${resolvedPath}' bir klasör/dizin değil.${c.reset}\n`)
            } else {
              process.chdir(resolvedPath)
              currentSession.workspace = resolvedPath
              ctx.session?.saveSession?.(currentSession)
              ctx.settings?.updateSettings?.({ workspace: resolvedPath })
              if ((ctx as any).fs?.setWorkspaceRoot) {
                (ctx as any).fs.setWorkspaceRoot(resolvedPath)
              }
              console.log(`\n${c.green}✓ Çalışma Dizini Başarıyla Değiştirildi:${c.reset} ${c.bold}${c.cyan}${resolvedPath}${c.reset}\n`)
            }
          } catch (err: any) {
            console.log(`\n${c.red}❌ Dizin değiştirme hatası: ${err.message}${c.reset}\n`)
          }
        }
        promptUser()
        return
      }

      if (cmd === '/new') {
        currentSession = ctx.session.createSession('CLI Session', undefined, undefined, 'cli')
        console.log(`\n${c.green}✨ Yeni temiz oturum başlatıldı.${c.reset} ${c.gray}(ID: ${currentSession.id})${c.reset}\n`)
        promptUser()
        return
      }

      if (cmd === '/sessions') {
        currentSession = await manageSessionsInteractive()
        promptUser()
        return
      }

      if (cmd === '/yolo' || cmd === '/auto') {
        isYoloMode = !isYoloMode
        if (isYoloMode) {
          ctx.approval?.setPolicy('auto')
          console.log(`\n${c.bold}${c.green}⚡ [YOLO MODU AKTİF]:${c.reset} Tüm komut ve araç izinleri onay sormadan otomatik verilecek.\n`)
        } else {
          ctx.approval?.setPolicy('ask_dangerous')
          console.log(`\n${c.bold}${c.yellow}🛡️ [GÜVENLİ MOD AKTİF]:${c.reset} Tehlikeli komutlar için kullanıcı onayı istenecek.\n`)
        }
        promptUser()
        return
      }

      if (cmd === '/think' || cmd === '/thought') {
        if (argStr === 'off' || argStr === 'false' || argStr === '0') {
          enableModelThinking = false
          console.log(`\n${c.yellow}✓ Model Düşünme Modu (Reasoning):${c.reset} ${c.bold}KAPALI (Modele doğrudan düşünce kapalı parametresi gönderiliyor, anında yanıt üretilecek)${c.reset}\n`)
        } else if (argStr === 'on' || argStr === 'true') {
          enableModelThinking = true
          thinkingBudget = 1024
          console.log(`\n${c.green}✓ Model Düşünme Modu (Reasoning):${c.reset} ${c.bold}AÇIK (1024 token bütçesiyle kısıtlı)${c.reset}\n`)
        } else if (/^\d+$/.test(argStr)) {
          enableModelThinking = true
          thinkingBudget = parseInt(argStr, 10)
          console.log(`\n${c.green}✓ Model Düşünme Modu (Reasoning):${c.reset} ${c.bold}AÇIK (${thinkingBudget} token bütçesiyle kısıtlı)${c.reset}\n`)
        } else {
          enableModelThinking = !enableModelThinking
          console.log(`\n${enableModelThinking ? c.green : c.yellow}✓ Model Düşünme Modu (Reasoning):${c.reset} ${c.bold}${enableModelThinking ? `AÇIK (${thinkingBudget} token ile kısıtlı)` : 'KAPALI (Doğrudan Yanıt)'}${c.reset}\n`)
        }
        promptUser()
        return
      }

      if (cmd === '/tokens') {
        const m = ctx.tokenMeter.measureSession(currentSession.id)
        console.log(`\n${c.bold}📊 Bağlam ve Token Kullanımı:${c.reset}`)
        console.log(`  • Sistem İstemi: ${c.cyan}${m.systemPromptTokens || 0} tokens${c.reset}`)
        console.log(`  • Araç Şemaları: ${c.cyan}${m.toolsTokens || 0} tokens${c.reset}`)
        console.log(`  • Mesaj Geçmişi: ${c.cyan}${m.historyTokens || 0} tokens${c.reset}`)
        console.log(`  • Toplam: ${c.bold}${m.totalTokens || 0} / ${m.contextWindow || 24576} tokens (${m.percentage || 0}%)${c.reset}\n`)
        promptUser()
        return
      }

      if (cmd === '/compact') {
        console.log(`\n${c.magenta}📦 Geçmiş sıkıştırılıyor...${c.reset}`)
        const s = ctx.session.getSession(currentSession.id)
        if (s && s.messages) {
          const res = ctx.compactor.compact(s.messages, 2)
          if (res.compacted) {
            s.messages = res.messages
            console.log(`${c.green}✓ Bağlam başarıyla sıkıştırıldı (Eski mesajlar özetlendi).${c.reset}\n`)
          } else {
            console.log(`${c.gray}Bağlam henüz sıkıştırma eşiğine ulaşmamış (${s.messages.length} mesaj).${c.reset}\n`)
          }
        }
        promptUser()
        return
      }

      if (cmd === '/mode') {
        if (!argStr) {
          await openInteractiveModePicker()
        } else if (argStr === 'minimal' || argStr === 'full') {
          currentMode = argStr
          console.log(`\n${c.green}✓ Çalışma Modu Değiştirildi:${c.reset} ${c.bold}${currentMode}${c.reset}\n`)
        } else {
          await openInteractiveModePicker()
        }
        promptUser()
        return
      }

      if (cmd === '/preset') {
        if (!argStr) {
          await openInteractivePresetPicker()
        } else {
          const presets = ctx.agentPresets ? ctx.agentPresets.list() : ctx.settings.getPresets()
          const matched = presets.find((p: any) => p.id === argStr || p.name.toLowerCase().includes(argStr.toLowerCase()))
          if (matched) {
            currentPreset = matched
            if (ctx.agentPresets) ctx.agentPresets.select(matched.id)
            console.log(`\n${c.green}✓ Ajan Rolü Seçildi:${c.reset} ${c.bold}${matched.name}${c.reset}\n`)
          } else {
            console.log(`\n${c.red}Preset bulunamadı: ${argStr}${c.reset}\n`)
          }
        }
        promptUser()
        return
      }

      if (cmd === '/model' || cmd === '/provider') {
        await openInteractiveModelPicker()
        promptUser()
        return
      }

      if (cmd === '/jobs') {
        const jobsList = ctx.jobs?.list ? ctx.jobs.list() : []
        if (jobsList.length === 0) {
          console.log(`\n${c.gray}Şu an aktif veya kayıtlı bir arka plan görevi bulunmuyor.${c.reset}\n`)
        } else {
          console.log(`\n${c.bold}${c.cyan}⏱️  ARKA PLAN GÖREVLERİ (Background Jobs):${c.reset}`)
          console.log(`${c.gray}───────────────────────────────────────────────────────────────────${c.reset}`)
          jobsList.forEach((j: any) => {
            const statusColor = j.status === 'running' ? `${c.bold}${c.yellow}RUNNING ⏳` : j.status === 'completed' ? `${c.bold}${c.green}COMPLETED ✓` : `${c.red}${j.status}`
            console.log(`• ${c.bold}${j.id}${c.reset} | ${statusColor}${c.reset} | ${c.cyan}${j.name}${c.reset}`)
            console.log(`  ${c.gray}Komut/Hedef: ${j.command || j.name}${c.reset}`)
          })
          console.log(`${c.gray}───────────────────────────────────────────────────────────────────${c.reset}`)
          console.log(`${c.gray}Logları incelemek için: ${c.cyan}/logs <job_id>${c.reset}\n`)
        }
        promptUser()
        return
      }

      if (cmd === '/logs') {
        const targetId = argStr.trim()
        if (!targetId) {
          const jobsList = ctx.jobs?.list ? ctx.jobs.list() : []
          if (jobsList.length > 0) {
            const lastJob = jobsList[jobsList.length - 1]
            console.log(`\n${c.bold}📜 Son Görev Logları (${lastJob.id} - ${lastJob.name}):${c.reset}\n`)
            console.log(lastJob.logs || '(Henüz log kaydı yok)')
          } else {
            console.log(`\n${c.gray}Kayıtlı arka plan görevi yok. Kullanım: /logs <job_id>${c.reset}\n`)
          }
        } else {
          const job = ctx.jobs?.get ? ctx.jobs.get(targetId) : null
          if (!job) {
            console.log(`\n${c.red}Job bulunamadı: ${targetId}${c.reset}\n`)
          } else {
            console.log(`\n${c.bold}📜 Görev Logları (${job.id} - ${job.name} | ${job.status}):${c.reset}\n`)
            console.log(job.logs || '(Henüz log kaydı yok)')
          }
        }
        console.log('\n')
        promptUser()
        return
      }

      if (cmd === '/kill' || cmd === '/stop') {
        const targetId = argStr.trim()
        if (!targetId) {
          console.log(`\n${c.gray}Durdurmak istediğiniz iş ID'sini belirtin: ${c.cyan}/kill <job_id>${c.reset}\n`)
        } else {
          if (ctx.jobs?.kill) {
            await ctx.jobs.kill(targetId)
          }
          console.log(`\n${c.bold}${c.green}✓ Görev Başarıyla Durduruldu / İptal Edildi:${c.reset} ${c.yellow}${targetId}${c.reset}\n`)
        }
        promptUser()
        return
      }

      if (cmd === '/goal') {
        if (!argStr || argStr === 'status') {
          if (activeGoal) {
            console.log(`\n${c.bold}🎯 Aktif Ön Plan Hedefi:${c.reset} ${c.yellow}${activeGoal}${c.reset}\n`)
          } else {
            console.log(`\n${c.gray}Şu an aktif bir ön plan hedefi yok. Başlatmak için: ${c.cyan}/goal <hedefiniz>${c.reset}`)
            console.log(`${c.gray}Arka planda başlatmak için: ${c.cyan}/goal -b <hedefiniz>${c.reset}\n`)
          }
          promptUser()
          return
        }

        if (argStr === 'clear') {
          activeGoal = null
          console.log(`\n${c.green}✓ Hedef temizlendi.${c.reset}\n`)
          promptUser()
          return
        }

        const isBackground = argStr.startsWith('-b ') || argStr.startsWith('--background ') || argStr.startsWith('-bg ')
        const cleanGoal = argStr.replace(/^(-b|--background|-bg)\s+/, '').replace(/^["']|["']$/g, '').trim()

        if (isBackground) {
          const jobId = `job_goal_${Date.now().toString(36)}`
          const bgSession = ctx.session.createSession(`Background Goal: ${cleanGoal.slice(0, 30)}`, undefined, undefined, 'cli')
          
          console.log(`\n${c.bold}${c.green}🚀 [ARKA PLAN GÖREVİ BAŞLATILDI]:${c.reset} ${c.bold}${c.cyan}${cleanGoal}${c.reset}`)
          console.log(`  • ${c.gray}Job ID:${c.reset} ${c.bold}${jobId}${c.reset}`)
          console.log(`  • ${c.gray}Durum:${c.reset} ${c.yellow}RUNNING ⏳ (Arka planda otonom çalışıyor)${c.reset}`)
          console.log(`  • ${c.gray}Logları izlemek için:${c.reset} ${c.cyan}/logs ${jobId}${c.reset} veya ${c.cyan}/jobs${c.reset}`)
          console.log(`  • ${c.gray}Durdurmak için:${c.reset} ${c.cyan}/kill ${jobId}${c.reset}`)
          console.log(`  • ${c.green}✓ Terminaliniz serbesttir. Komut girmeye devam edebilirsiniz.${c.reset}\n`)

          // Create job snapshot in registry if available
          const jobEntry: any = {
            id: jobId,
            name: `Autonomous Goal: ${cleanGoal.slice(0, 40)}`,
            command: cleanGoal,
            status: 'running',
            startedAt: Date.now(),
            logs: `[Background Goal Started]: ${cleanGoal}\n\n`
          }
          if (ctx.jobs?.start) {
            (ctx.jobs as any).jobs?.set?.(jobId, { snapshot: jobEntry })
          }

          // Run in background without blocking CLI prompt
          const bgPrompt = `[AUTONOMOUS BACKGROUND GOAL]\nOBJECTIVE: "${cleanGoal}"\n\n[INSTRUCTIONS]: You are running as a background autonomous engineer. Inspect the workspace, make changes, run tests, and fix all issues until the objective is 100% complete. When finished, call finish_task.`

          ctx.agent.run({
            sessionId: bgSession.id,
            presetId: currentPreset?.id || undefined,
            prompt: bgPrompt,
            autonomous: true,
            enableThinking: false,
            onChunk: (chunk: string) => {
              jobEntry.logs += chunk
            }
          }).then((res: any) => {
            jobEntry.status = 'completed'
            jobEntry.completedAt = Date.now()
            jobEntry.logs += `\n\n[COMPLETED]: Goal successfully accomplished.`
            process.stdout.write(`\n\n${c.bold}${c.green}🔔 [BİLDİRİM - ARKA PLAN GÖREVİ TAMAMLANDI]:${c.reset} ${c.cyan}${jobId}${c.reset}\n${c.bold}Hedef:${c.reset} ${cleanGoal}\n${c.gray}Detaylı çıktı için:${c.reset} ${c.cyan}/logs ${jobId}${c.reset}\n\n`)
          }).catch((err: any) => {
            jobEntry.status = 'failed'
            jobEntry.logs += `\n\n[FAILED]: ${err.message}`
            process.stdout.write(`\n\n${c.bold}${c.red}⚠️ [BİLDİRİM - ARKA PLAN GÖREVİ HATA ALDI]:${c.reset} ${jobId}: ${err.message}\n\n`)
          })

          promptUser()
          return
        }


        activeGoal = argStr
        console.log(`\n${c.bold}${c.green}🚀 [GOAL BAŞLATILDI]:${c.reset} ${c.bold}${activeGoal}${c.reset}`)
        console.log(`${c.gray}Ajan hedefi tamamlayana kadar otonom adımlar atıyor...${c.reset}\n`)
      }
    }


    // Execute Agent Run
    try {
      const isAutonomous = Boolean(activeGoal)
      const promptToSend = activeGoal
        ? `[AKTİF HEDEF: ${activeGoal}]\n${input}\n\n[TALİMAT]: Bu hedefi tamamlamak için gerekli araçları otonom olarak art arda çalıştır. Görevi tamamen bitirip doğrulayana kadar durma. Her şey bittiğinde 'finish_task' çağırarak görevi tamamla.`
        : input
      let inThought = false

      console.log(`\n${c.gray}─── [Ajan Başlatıldı] ───${c.reset}`)

      await ctx.agent.run({
        sessionId: currentSession.id,
        presetId: currentPreset?.id || undefined,
        prompt: promptToSend,
        autonomous: isAutonomous,
        enableThinking: enableModelThinking,
        thinkingBudgetTokens: thinkingBudget,
        onThought: (t) => {
          if (!inThought) {
            process.stdout.write(`${c.dim}${c.magenta}💭 Düşünce: `)
            inThought = true
          }
          process.stdout.write(`${c.dim}${t}${c.reset}`)
        },
        onChunk: (chunk) => {
          if (inThought) {
            process.stdout.write(`\n\n${c.bold}${c.cyan}🤖 Yanıt:${c.reset}\n`)
            inThought = false
          }
          process.stdout.write(chunk)
        },
        onToolStart: (call) => {
          console.log(`\n${c.bold}${c.blue}⚙️  [Araç Çalıştırılıyor]:${c.reset} ${c.cyan}${call.name}${c.reset}`)
          if (call.args && Object.keys(call.args).length > 0) {
            console.log(`${c.gray}${JSON.stringify(call.args, null, 2)}${c.reset}`)
          }
        },
        onToolResult: (res) => {
          console.log(`${c.green}✅ [Araç Tamamlandı]:${c.reset} ${c.cyan}${res.name}${c.reset}`)
          if (res.name === 'finish_task') {
            console.log(`\n${c.bold}${c.green}🎯 [HEDEF TAMAMLANDI]:${c.reset} ${c.yellow}${activeGoal}${c.reset}\n`)
            activeGoal = null
          }
        }
      })

      console.log(`\n${c.gray}─────────────────────────${c.reset}\n`)
    } catch (err: any) {
      console.error(`\n${c.red}[Hata]: ${err.message}${c.reset}\n`)
    }

    promptUser()
  }

  promptUser()
}

main().catch((err) => {
  console.error('Fatal CLI error:', err)
  process.exit(1)
})
