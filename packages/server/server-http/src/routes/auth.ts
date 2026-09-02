import { Router } from 'express'
import type { Context } from '@custom-harness/core-context'
import { requireAdmin } from '../middleware/auth.js'

export function createAuthRouter(ctx: Context): Router {
  const router = Router()
  const getAuthService = () => (ctx as any).auth

  // 1. Login
  router.post('/login', async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      const result = await auth.login(req.body)
      if (!result.success) return res.status(401).json({ error: result.error || 'Geçersiz kimlik bilgileri' })
      res.json(result)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. Register
  router.post('/register', async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      const result = await auth.register(req.body)
      if (!result.success) return res.status(400).json({ error: result.error || 'Kayıt başarısız' })
      res.json(result)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 3. Logout
  router.post('/logout', (req, res) => {
    res.json({ success: true })
  })

  // 4. Me
  router.get('/me', (req, res) => {
    res.json({ user: req.user })
  })

  // 5. List Users
  router.get('/users', async (req, res) => {
    try {
      const auth = getAuthService()
      const users = auth ? await auth.listUsers() : []
      res.json({ users })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 6. Switch Tenant
  router.post('/switch', async (req, res) => {
    try {
      const { userId } = req.body
      if (!userId) return res.status(400).json({ error: 'userId zorunludur' })
      const auth = getAuthService()
      const user = auth ? await auth.getUser(userId) : null
      if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' })
      const token = auth ? auth.createToken(user) : ''
      res.json({ user, token })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 7. Create User (Admin Only)
  router.post('/users', requireAdmin(ctx), async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      const user = await auth.createUser(req.body)
      res.json({ success: true, user })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 8. Update User Role (Admin Only)
  router.put('/users/:id/role', requireAdmin(ctx), async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      const { role } = req.body
      const user = await auth.updateUserRole(req.params.id, role)
      res.json({ success: true, user })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 9. Delete User (Admin Only)
  router.delete('/users/:id', requireAdmin(ctx), async (req, res) => {
    try {
      const auth = getAuthService()
      if (!auth) return res.status(503).json({ error: 'Auth servisi aktif değil' })
      await auth.deleteUser(req.params.id)
      res.json({ success: true })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  return router
}
