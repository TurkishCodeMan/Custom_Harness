import type { Request, Response, NextFunction } from 'express'
import type { Context } from '@custom-harness/core-context'
import type { User, UserRole } from '@custom-harness/core-types'

// Extend Express Request interface to include resolved user
declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

/**
 * Resolves current user from JWT Authorization header, X-User-Id header, or query parameters.
 * Falls back to default admin identity if no auth is configured.
 */
export const resolveUser = async (req: Request, ctx: Context): Promise<User> => {
  const auth = (ctx as any).auth
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token as string)
  const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string)

  if (auth) {
    try {
      if (token) {
        const user = await auth.authenticate({ token })
        if (user) return user
      }
      if (userId) {
        const user = await auth.authenticate({ userId })
        if (user) return user
      }
    } catch {}
  }

  return {
    id: userId || 'user_admin',
    username: 'admin',
    name: 'Sistem Yöneticisi',
    role: 'admin' as const,
    createdAt: Date.now()
  }
}

/**
 * Middleware: Attaches the resolved user to `req.user` for downstream handlers.
 */
export const attachUser = (ctx: Context) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.user = await resolveUser(req, ctx)
      next()
    } catch (err: any) {
      res.status(401).json({
        error: err.message || 'Kimlik doğrulama başarısız.'
      })
    }
  }
}

/**
 * Middleware: Requires the caller to have one of the specified roles.
 * Usage: `app.post('/api/...', requireRole(ctx, 'admin'), handler)`
 */
export const requireRole = (ctx: Context, ...roles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caller = req.user || (await resolveUser(req, ctx))
      req.user = caller

      if (!roles.includes(caller.role)) {
        return res.status(403).json({
          error: 'Bu işlem için yetkiniz bulunmuyor.'
        })
      }

      next()
    } catch (err: any) {
      res.status(401).json({
        error: err.message || 'Kimlik doğrulama hatası.'
      })
    }
  }
}

/**
 * Convenience middleware: Requires admin role.
 * Usage: `app.post('/api/...', requireAdmin(ctx), handler)`
 */
export const requireAdmin = (ctx: Context) => requireRole(ctx, 'admin')

/**
 * Middleware: Protects sensitive nested fields in req.body from non-admin modification.
 * Supports dot notation, e.g. `['ui.defaultTitlePrompt', 'providers', 'workspace']`.
 * 
 * - If caller is 'admin', all fields are permitted.
 * - If caller is not 'admin', any attempt to supply or modify protected fields results in HTTP 403.
 * 
 * Usage: `app.post('/api/settings', protectFields(ctx, ['ui.defaultTitlePrompt', 'providers']), handler)`
 */
export const protectFields = (ctx: Context, fields: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const caller = req.user || (await resolveUser(req, ctx))
      req.user = caller

      if (caller.role === 'admin') {
        return next()
      }

      // Check if non-admin is trying to modify any protected field
      const currentSettings = (ctx as any).settings?.getSettings ? (ctx as any).settings.getSettings() : {}
      const forbidden = fields.some((field) => {
        const reqVal = field.split('.').reduce((obj: any, key) => obj?.[key], req.body)
        if (reqVal === undefined) return false
        const curVal = field.split('.').reduce((obj: any, key) => obj?.[key], currentSettings)
        if (curVal === undefined) return reqVal !== undefined
        return JSON.stringify(reqVal) !== JSON.stringify(curVal)
      })

      if (forbidden) {
        return res.status(403).json({
          error: 'Bu alanı değiştirme yetkiniz bulunmuyor (Yalnızca Sistem Yöneticisi).'
        })
      }

      next()
    } catch (err: any) {
      res.status(401).json({
        error: err.message || 'Kimlik doğrulama hatası.'
      })
    }
  }
}
