import { describe, it, expect, vi } from 'vitest'
import { Context } from '@custom-harness/core-context'
import * as tools from '@custom-harness/core-tools'
import * as settings from '@custom-harness/settings'
import * as session from '@custom-harness/session'
import * as schedule from '../src/index.js'

describe('@custom-harness/schedule', () => {
  it('calculates next cron occurrence correctly', () => {
    const refDate = new Date()
    const next9am = schedule.getNextCronOccurrence('0 9 * * *', refDate)
    const nextDate = new Date(next9am)
    expect(nextDate.getHours()).toBe(9)
    expect(nextDate.getMinutes()).toBe(0)
    expect(nextDate.getTime()).toBeGreaterThan(refDate.getTime())
  })

  it('creates, triggers and manages schedules via service', async () => {
    const ctx = new Context()
    ctx.plugin(tools)
    ctx.plugin(settings)
    ctx.plugin(session)
    ctx.plugin(schedule)

    await ctx.start()

    const service = (ctx as any).schedule as schedule.ScheduleService
    expect(service).toBeDefined()

    // 1. Create schedule with after_seconds: 1
    const record = service.create({
      prompt: 'COMPANY_ABC finans verilerini denetle',
      after_seconds: 1,
      preset: 'novatrend-cfo',
      workspace: '/home/huseyina/code_mode/COMPANY_ABC'
    })

    expect(record.id).toBeDefined()
    expect(record.status).toBe('active')
    expect(record.type).toBe('after')

    // 2. Wait for trigger
    await new Promise(r => setTimeout(r, 2000))
    await service.checkDueSchedules()

    const retrieved = service.get(record.id)
    expect(retrieved?.status).toBe('triggered')
    expect(retrieved?.triggerCount).toBe(1)

    // 3. List schedules
    const list = service.list()
    expect(list.length).toBeGreaterThan(0)

    // 4. Delete schedule
    const deleted = service.delete(record.id)
    expect(deleted).toBe(true)
    expect(service.get(record.id)).toBeUndefined()

    service.stop()
  })

  it('spawns dedicated isolated sessions for distinct agent roles (CFO, Kalite, Tedarik) without colliding', async () => {
    const ctx = new Context()
    ctx.plugin(tools)
    ctx.plugin(settings)
    ctx.plugin(session)
    ctx.plugin(schedule)

    const runs: any[] = []
    ctx.set('agent', {
      run: vi.fn(async (opts: any) => {
        runs.push(opts)
        return 'OK'
      })
    } as any)

    await ctx.start()

    const service = (ctx as any).schedule as schedule.ScheduleService
    const sessionService = (ctx as any).session

    // Initial user session
    const initialUserSession = sessionService.createSession('Kullanıcı Aktif Sohbeti')
    sessionService.setActiveSession(initialUserSession.id)

    // Schedule 3 simultaneous tasks for 3 distinct roles
    const cfoTask = service.create({
      prompt: 'COMPANY_ABC bütçe aşımlarını (%15+ limit) denetle',
      after_seconds: 1,
      preset: 'novatrend-cfo',
      workspace: '/home/huseyina/code_mode/COMPANY_ABC'
    })

    const kaliteTask = service.create({
      prompt: 'COMPANY_ABC müşteri iade oranlarını denetle',
      after_seconds: 1,
      preset: 'novatrend-kalite',
      workspace: '/home/huseyina/code_mode/COMPANY_ABC'
    })

    const tedarikTask = service.create({
      prompt: 'COMPANY_ABC depo stoklarını ve sipariş taslaklarını denetle',
      after_seconds: 1,
      preset: 'novatrend-tedarik',
      workspace: '/home/huseyina/code_mode/COMPANY_ABC'
    })

    // Wait for triggers
    await new Promise(r => setTimeout(r, 1500))
    await service.checkDueSchedules()

    // Verify all 3 tasks were dispatched
    expect(runs.length).toBe(3)

    const cfoRun = runs.find(r => r.preset === 'novatrend-cfo')
    const kaliteRun = runs.find(r => r.preset === 'novatrend-kalite')
    const tedarikRun = runs.find(r => r.preset === 'novatrend-tedarik')

    expect(cfoRun).toBeDefined()
    expect(kaliteRun).toBeDefined()
    expect(tedarikRun).toBeDefined()

    // 1. Verify that all 3 runs have DISTINCT dedicated session IDs
    expect(cfoRun.sessionId).not.toBe(initialUserSession.id)
    expect(kaliteRun.sessionId).not.toBe(initialUserSession.id)
    expect(tedarikRun.sessionId).not.toBe(initialUserSession.id)

    const sessionIds = new Set([cfoRun.sessionId, kaliteRun.sessionId, tedarikRun.sessionId])
    expect(sessionIds.size).toBe(3)

    // 2. Verify each dedicated session was created with appropriate title & preset prefix
    const cfoSession = sessionService.getSession(cfoRun.sessionId)
    const kaliteSession = sessionService.getSession(kaliteRun.sessionId)
    const tedarikSession = sessionService.getSession(tedarikRun.sessionId)

    expect(cfoSession?.title).toContain('[novatrend-cfo]')
    expect(kaliteSession?.title).toContain('[novatrend-kalite]')
    expect(tedarikSession?.title).toContain('[novatrend-tedarik]')

    // 3. Verify that user's active session was NOT hijacked
    expect(sessionService.getActiveSession()?.id).toBe(initialUserSession.id)

    service.stop()
  })

  it('reuses existing session when reuseSession: true is explicitly requested', async () => {
    const ctx = new Context()
    ctx.plugin(tools)
    ctx.plugin(settings)
    ctx.plugin(session)
    ctx.plugin(schedule)

    const runs: any[] = []
    ctx.set('agent', {
      run: vi.fn(async (opts: any) => {
        runs.push(opts)
        return 'OK'
      })
    } as any)

    await ctx.start()

    const service = (ctx as any).schedule as schedule.ScheduleService
    const sessionService = (ctx as any).session

    const existingSession = sessionService.createSession('Ortak Sohbet')

    service.create({
      prompt: '10 saniye sonra bu sohbette hatırlat',
      after_seconds: 1,
      sessionId: existingSession.id,
      reuseSession: true
    })

    await new Promise(r => setTimeout(r, 1500))
    await service.checkDueSchedules()

    expect(runs.length).toBe(1)
    expect(runs[0].sessionId).toBe(existingSession.id)

    service.stop()
  })

  it('schedule_create tool defaults to dedicated session and supports reuse_session: true', async () => {
    const ctx = new Context()
    ctx.plugin(tools)
    ctx.plugin(settings)
    ctx.plugin(session)
    ctx.plugin(schedule)

    await ctx.start()

    const service = (ctx as any).schedule as schedule.ScheduleService
    const tool = ctx.tools.get('schedule_create')
    expect(tool).toBeDefined()

    // Case A: Default behavior (reuse_session not provided -> dedicated session)
    await tool!.execute({
      prompt: 'Varsayılan izole görev',
      after_seconds: 60,
      preset: 'novatrend-cfo'
    }, { sessionId: 'current_user_session_123' } as any)

    const list1 = service.list()
    const taskA = list1.find(t => t.prompt === 'Varsayılan izole görev')
    expect(taskA).toBeDefined()
    expect(taskA?.reuseSession).toBe(false)
    expect(taskA?.sessionId).toBeUndefined()

    // Case B: Explicit reuse_session: true
    await tool!.execute({
      prompt: 'Aynı sohbette çalışacak görev',
      after_seconds: 60,
      reuse_session: true
    }, { sessionId: 'current_user_session_123' } as any)

    const list2 = service.list()
    const taskB = list2.find(t => t.prompt === 'Aynı sohbette çalışacak görev')
    expect(taskB).toBeDefined()
    expect(taskB?.reuseSession).toBe(true)
    expect(taskB?.sessionId).toBe('current_user_session_123')

    service.stop()
  })
})
