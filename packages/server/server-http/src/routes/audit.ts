import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'

export function createAuditRouter(ctx: Context): Router {
  const router = Router()

  const getAuditService = () => {
    return (ctx as any).auditLog || (ctx as any).get?.('auditLog') || null
  }

  // 1. GET /api/audit/logs - Query audit trail
  router.get('/audit/logs', (req, res) => {
    try {
      const auditService = getAuditService()
      if (!auditService) {
        return res.status(503).json({ error: 'AuditLog servisi aktif değil', logs: [] })
      }

      const { positionId, actionType, traceId, sessionId, from, to, limit } = req.query

      const logs = auditService.query({
        positionId: positionId as string,
        actionType: actionType as string,
        traceId: traceId as string,
        sessionId: sessionId as string,
        from: from ? Number(from) : undefined,
        to: to ? Number(to) : undefined,
        limit: limit ? Number(limit) : 100
      })

      res.json({ success: true, logs })
    } catch (e: any) {
      res.status(500).json({ error: e.message, logs: [] })
    }
  })

  // 2. GET /api/audit/logs/export - Export audit logs as CSV
  router.get('/audit/logs/export', (req, res) => {
    try {
      const auditService = getAuditService()
      if (!auditService) {
        return res.status(503).json({ error: 'AuditLog servisi aktif değil' })
      }

      const { positionId, actionType, traceId, sessionId, from, to } = req.query

      const csv = auditService.exportCsv({
        positionId: positionId as string,
        actionType: actionType as string,
        traceId: traceId as string,
        sessionId: sessionId as string,
        from: from ? Number(from) : undefined,
        to: to ? Number(to) : undefined,
        limit: 5000
      })

      const filename = `audit_export_${new Date().toISOString().slice(0, 10)}.csv`
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(csv)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 3. POST /api/audit/logs - Insert an audit entry
  router.post('/audit/logs', (req, res) => {
    try {
      const auditService = getAuditService()
      if (!auditService) {
        return res.status(503).json({ error: 'AuditLog servisi aktif değil' })
      }

      const { positionId, positionTitle, sessionId, traceId, actionType, summary, details } = req.body
      if (!actionType || !summary) {
        return res.status(400).json({ error: 'actionType ve summary alanları zorunludur' })
      }

      const entry = auditService.write({
        positionId,
        positionTitle,
        sessionId,
        traceId,
        actionType,
        summary,
        details
      })

      res.json({ success: true, entry })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
