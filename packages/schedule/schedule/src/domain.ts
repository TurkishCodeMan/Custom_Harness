import type { ScheduleCreateOptions, ScheduleRecord, ScheduleType } from './types.js'

export function allocateScheduleId(): string {
  const rand = Math.random().toString(36).substring(2, 7)
  return `sch-${Date.now().toString(36)}-${rand}`
}

/**
 * Calculates the next occurrence timestamp for a simple 5-field cron expression:
 * (minute hour dayOfMonth month dayOfWeek)
 */
export function getNextCronOccurrence(cron: string, fromDate = new Date()): number {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`Geçersiz cron ifadesi: "${cron}". 5 alan bekleniyor: dakika saat ay-günü ay hafta-günü (örn: '0 9 * * *')`)
  }

  const [minRule, hourRule, domRule, monthRule, dowRule] = parts

  function matchField(val: number, rule: string, min: number, max: number): boolean {
    if (rule === '*') return true
    // Steps: e.g. */5 or 0-30/5
    if (rule.includes('/')) {
      const [rangePart, stepPart] = rule.split('/')
      const step = parseInt(stepPart, 10)
      if (isNaN(step) || step <= 0) return false
      const start = rangePart === '*' ? min : parseInt(rangePart, 10)
      return (val - start) % step === 0 && val >= start && val <= max
    }
    // Ranges: e.g. 1-5
    if (rule.includes('-')) {
      const [startStr, endStr] = rule.split('-')
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      return val >= start && val <= end
    }
    // Lists: e.g. 1,3,5
    if (rule.includes(',')) {
      const list = rule.split(',').map(s => parseInt(s, 10))
      return list.includes(val)
    }
    return parseInt(rule, 10) === val
  }

  // Iterate minute by minute up to 366 days
  const candidate = new Date(fromDate.getTime())
  // Start from next minute
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)

  const maxChecks = 60 * 24 * 366 // Up to 1 year
  for (let i = 0; i < maxChecks; i++) {
    const min = candidate.getMinutes()
    const hour = candidate.getHours()
    const dom = candidate.getDate()
    const month = candidate.getMonth() + 1 // 1-12
    const dow = candidate.getDay() // 0-6 (Sun-Sat)

    if (
      matchField(min, minRule, 0, 59) &&
      matchField(hour, hourRule, 0, 23) &&
      matchField(dom, domRule, 1, 31) &&
      matchField(month, monthRule, 1, 12) &&
      matchField(dow, dowRule, 0, 6)
    ) {
      return candidate.getTime()
    }

    candidate.setMinutes(candidate.getMinutes() + 1)
  }

  throw new Error(`Cron ifadesi için uygun bir sonraki zaman bulunamadı: "${cron}"`)
}

/**
 * Validates options and calculates initial targetTime
 */
export function buildScheduleRecord(opts: ScheduleCreateOptions): ScheduleRecord {
  const prompt = (opts.prompt || '').trim()
  if (!prompt) {
    throw new Error('Görev talimatı (prompt) boş olamaz.')
  }

  let type: ScheduleType = 'after'
  let targetTime = 0
  const now = Date.now()

  if (opts.cron) {
    type = 'cron'
    targetTime = getNextCronOccurrence(opts.cron, new Date(now))
  } else if (opts.at) {
    type = 'at'
    const parsed = new Date(opts.at).getTime()
    if (isNaN(parsed)) {
      throw new Error(`Geçersiz 'at' tarih/saat formatı: "${opts.at}". ISO 8601 bekleniyor.`)
    }
    if (parsed <= now) {
      throw new Error(`'at' zamanı gelecekte bir tarih olmalıdır. Verilen: "${opts.at}"`)
    }
    targetTime = parsed
  } else if (opts.every_seconds !== undefined) {
    type = 'every'
    const sec = Number(opts.every_seconds)
    if (isNaN(sec) || sec <= 0) {
      throw new Error(`'every_seconds' pozitif bir sayı olmalıdır. Verilen: ${opts.every_seconds}`)
    }
    targetTime = now + sec * 1000
  } else if (opts.after_seconds !== undefined) {
    type = 'after'
    const sec = Number(opts.after_seconds)
    if (isNaN(sec) || sec <= 0) {
      throw new Error(`'after_seconds' pozitif bir sayı olmalıdır. Verilen: ${opts.after_seconds}`)
    }
    targetTime = now + sec * 1000
  } else {
    throw new Error("Plan oluşturmak için 'after_seconds', 'at', 'every_seconds' veya 'cron' parametrelerinden en az biri belirtilmelidir.")
  }

  return {
    id: allocateScheduleId(),
    prompt,
    type,
    targetTime,
    afterSeconds: opts.after_seconds,
    atIso: opts.at,
    everySeconds: opts.every_seconds,
    cronExpression: opts.cron,
    preset: opts.preset,
    workspace: opts.workspace,
    sessionId: opts.sessionId,
    userId: opts.userId,
    status: 'active',
    createdAt: now,
    triggerCount: 0,
    reuseSession: opts.reuseSession === true
  }
}

export function renderScheduleReminderFraming(record: ScheduleRecord): string {
  return `[SCHEDULE REMINDER / ZAMANLANMIŞ GÖREV TETİKLENDİ]
Aşağıdaki görev zamanlanmış bir kural tarafından proaktif olarak tetiklendi:
- Görev ID: ${record.id}
- Zamanlama Türü: ${record.type.toUpperCase()}${record.cronExpression ? ` (${record.cronExpression})` : ''}
- Hedef Rol / Koltuk: ${record.preset || 'Genel Asistan'}
- Çalışma Alanı: ${record.workspace || 'Aktif Dizin'}
- Tetiklenme Zamanı: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (TSİ)

### GÖREV TALİMATI:
${record.prompt}

[TALİMAT]: Bu görevi ilgili koltuğun uzmanlık kurallarına göre derhal yürüt. Gerekli araçları kullanarak analizini tamamla ve sonucunu raporla.`
}
