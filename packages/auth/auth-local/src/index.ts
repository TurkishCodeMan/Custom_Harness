import { AuthService, type CreateUserDto, type UpdateUserDto, type AuthOverviewStats, type LoginDto, type RegisterDto, type JwtPayload, type AuthResult } from '@custom-harness/auth'
import type { Context } from '@custom-harness/core-context'
import type { User, UserRole, TenantContext } from '@custom-harness/core-types'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

const DSH_DIR = path.join(os.homedir(), '.dsh')
const USERS_FILE = path.join(DSH_DIR, 'users.json')
const TENANTS_DIR = path.join(DSH_DIR, 'tenants')
const JWT_SECRET = process.env.JWT_SECRET || 'artificax_enterprise_jwt_secret_key_2026_dsh'

const base64UrlEncode = (str: string): string => {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

const base64UrlDecode = (str: string): string => {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return Buffer.from(str, 'base64').toString('utf8')
}

const DEFAULT_USERS: User[] = [
  {
    id: 'user_admin',
    username: 'admin',
    name: 'Sistem Yöneticisi',
    email: 'admin@artificax.ai',
    role: 'admin',
    createdAt: 1700000000000,
    lastActiveAt: Date.now(),
    avatar: '🛡️'
  },
  {
    id: 'user_dev',
    username: 'developer',
    name: 'Yazılım Geliştirici',
    email: 'dev@artificax.ai',
    role: 'user',
    createdAt: 1700000001000,
    lastActiveAt: Date.now(),
    avatar: '💻'
  },
  {
    id: 'user_analyst',
    username: 'analyst',
    name: 'Veri & İş Analisti',
    email: 'analyst@artificax.ai',
    role: 'user',
    createdAt: 1700000002000,
    lastActiveAt: Date.now(),
    avatar: '📊'
  }
]

export class LocalAuthService extends AuthService {
  private users: Map<string, User> = new Map()

  constructor(ctx: Context) {
    super(ctx)
    this.initStorage()
  }

  private initStorage() {
    try {
      if (!fs.existsSync(DSH_DIR)) {
        fs.mkdirSync(DSH_DIR, { recursive: true })
      }
      if (!fs.existsSync(TENANTS_DIR)) {
        fs.mkdirSync(TENANTS_DIR, { recursive: true })
      }

      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf8')
        const list = JSON.parse(raw) as User[]
        if (Array.isArray(list) && list.length > 0) {
          for (const u of list) {
            this.users.set(u.id, u)
          }
        }
      }

      // Seed defaults if empty or missing admin
      if (this.users.size === 0) {
        for (const u of DEFAULT_USERS) {
          this.users.set(u.id, u)
          this.ensureTenantDirs(u.id)
        }
        this.saveUsers()
      } else {
        // Ensure at least one admin exists
        const hasAdmin = Array.from(this.users.values()).some(u => u.role === 'admin')
        if (!hasAdmin) {
          this.users.set(DEFAULT_USERS[0].id, DEFAULT_USERS[0])
          this.saveUsers()
        }
        // Ensure all tenant dirs exist
        for (const u of this.users.values()) {
          this.ensureTenantDirs(u.id)
        }
      }
    } catch (err) {
      console.error('[LocalAuthService] Failed to init users storage:', err)
      for (const u of DEFAULT_USERS) {
        this.users.set(u.id, u)
      }
    }
  }

  private saveUsers() {
    try {
      const list = Array.from(this.users.values())
      fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf8')
    } catch (err) {
      console.error('[LocalAuthService] Failed to save users:', err)
    }
  }

  public createToken(user: User): string {
    const header = { alg: 'HS256', typ: 'JWT' }
    const now = Math.floor(Date.now() / 1000)
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      iat: now,
      exp: now + 7 * 24 * 60 * 60 // 7 days
    }

    const encodedHeader = base64UrlEncode(JSON.stringify(header))
    const encodedPayload = base64UrlEncode(JSON.stringify(payload))
    const data = `${encodedHeader}.${encodedPayload}`
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')
    return `${data}.${signature}`
  }

  public verifyToken(token: string): JwtPayload | null {
    if (!token) return null
    try {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim()
      const parts = cleanToken.split('.')
      if (parts.length !== 3) return null

      const [encodedHeader, encodedPayload, signature] = parts
      const data = `${encodedHeader}.${encodedPayload}`
      const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')

      if (signature !== expectedSig) return null

      const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        return null // Token expired
      }

      return payload
    } catch (err) {
      return null
    }
  }

  public async login(dto: LoginDto): Promise<AuthResult> {
    const uname = dto.username?.trim().toLowerCase()
    if (!uname) return { success: false, error: 'Kullanıcı adı girilmelidir' }

    const user = Array.from(this.users.values()).find(
      u => u.username.toLowerCase() === uname || u.id.toLowerCase() === uname
    )

    if (!user) {
      return { success: false, error: 'Kullanıcı bulunamadı' }
    }

    user.lastActiveAt = Date.now()
    this.saveUsers()
    const token = this.createToken(user)
    return { success: true, user, token }
  }

  public async register(dto: RegisterDto): Promise<AuthResult> {
    try {
      const user = await this.createUser({
        username: dto.username,
        name: dto.name || dto.username,
        email: dto.email,
        role: dto.role || 'user',
        avatar: dto.avatar
      })
      const token = this.createToken(user)
      return { success: true, user, token }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  public ensureTenantDirs(userId: string): TenantContext {
    const tenantRoot = path.join(TENANTS_DIR, userId)
    const workspaceDir = path.join(tenantRoot, 'workspace')
    const uploadsDir = path.join(tenantRoot, 'uploads')
    const sessionsDir = path.join(tenantRoot, 'sessions')

    if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true })
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true })

    const user = this.users.get(userId) || {
      id: userId,
      username: userId,
      name: userId,
      role: 'user' as UserRole,
      createdAt: Date.now()
    }

    return {
      userId,
      user,
      workspaceDir,
      uploadsDir,
      sessionsDir,
      ragNamespace: `tenant_${userId}`
    }
  }

  public async authenticate(credentials: {
    username?: string
    password?: string
    token?: string
    userId?: string
  }): Promise<User | null> {
    if (credentials.token) {
      const payload = this.verifyToken(credentials.token)
      if (payload?.userId) {
        const user = this.users.get(payload.userId)
        if (user) {
          user.lastActiveAt = Date.now()
          this.saveUsers()
          return user
        }
      }
    }

    if (credentials.userId) {
      const user = this.users.get(credentials.userId)
      if (user) {
        user.lastActiveAt = Date.now()
        this.saveUsers()
        return user
      }
    }

    if (credentials.username) {
      const uname = credentials.username.trim().toLowerCase()
      const user = Array.from(this.users.values()).find(
        u => u.username.toLowerCase() === uname || u.id === uname
      )
      if (user) {
        user.lastActiveAt = Date.now()
        this.saveUsers()
        return user
      }
    }

    // Default fallback to admin for seamless local use if none provided
    const admin = Array.from(this.users.values()).find(u => u.role === 'admin') || DEFAULT_USERS[0]
    return admin
  }

  public async getUser(idOrUsername: string): Promise<User | null> {
    if (!idOrUsername) return null
    if (this.users.has(idOrUsername)) {
      return this.users.get(idOrUsername)!
    }
    const uname = idOrUsername.trim().toLowerCase()
    return Array.from(this.users.values()).find(
      u => u.username.toLowerCase() === uname || u.id.toLowerCase() === uname
    ) || null
  }

  public async listUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => (a.role === 'admin' ? -1 : 1))
  }

  public async createUser(dto: CreateUserDto): Promise<User> {
    const username = dto.username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    if (!username) throw new Error('Geçerli bir kullanıcı adı girilmelidir.')

    const exists = Array.from(this.users.values()).some(u => u.username.toLowerCase() === username)
    if (exists) {
      throw new Error(`'${username}' kullanıcı adı zaten mevcut.`)
    }

    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newUser: User = {
      id,
      username,
      name: dto.name || username,
      email: dto.email || `${username}@artificax.ai`,
      role: dto.role || 'user',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      avatar: dto.avatar || (dto.role === 'admin' ? '🛡️' : '👤')
    }

    this.users.set(id, newUser)
    this.ensureTenantDirs(id)
    this.saveUsers()
    return newUser
  }

  public async updateUser(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = this.users.get(userId)
    if (!user) throw new Error(`Kullanıcı bulunamadı: ${userId}`)

    if (dto.name) user.name = dto.name
    if (dto.email) user.email = dto.email
    if (dto.role) user.role = dto.role
    if (dto.avatar) user.avatar = dto.avatar
    user.lastActiveAt = Date.now()

    this.users.set(userId, user)
    this.saveUsers()
    return user
  }

  public async deleteUser(userId: string, cleanupStorage = false): Promise<boolean> {
    const user = this.users.get(userId)
    if (!user) return false

    // Protect primary admin from deletion
    if (user.username === 'admin' || user.id === 'user_admin') {
      throw new Error('Ana yönetici hesabı silinemez.')
    }

    this.users.delete(userId)
    this.saveUsers()

    if (cleanupStorage) {
      try {
        const tenantRoot = path.join(TENANTS_DIR, userId)
        if (fs.existsSync(tenantRoot)) {
          fs.rmSync(tenantRoot, { recursive: true, force: true })
        }
      } catch (err) {
        console.warn(`[LocalAuthService] Failed to cleanup tenant storage for ${userId}:`, err)
      }
    }

    return true
  }

  public getTenantContext(userId: string): TenantContext {
    return this.ensureTenantDirs(userId)
  }

  public hasPermission(userOrId: User | string, action: string, targetUserId?: string): boolean {
    const user = typeof userOrId === 'string' ? this.users.get(userOrId) : userOrId
    if (!user) return false

    // Admins have universal access across all tenants and resources
    if (user.role === 'admin') return true

    // Standard users can only access their own resources
    if (!targetUserId || targetUserId === user.id || targetUserId === user.username) {
      return true
    }

    return false
  }

  public async getOverviewStats(): Promise<AuthOverviewStats> {
    const users = Array.from(this.users.values())
    const adminCount = users.filter(u => u.role === 'admin').length
    const userCount = users.filter(u => u.role === 'user').length

    let totalSessions = 0
    let totalUploads = 0
    let totalStorageBytes = 0

    // Measure tenant storage & sessions
    if (fs.existsSync(TENANTS_DIR)) {
      try {
        const tenants = fs.readdirSync(TENANTS_DIR)
        for (const t of tenants) {
          const tPath = path.join(TENANTS_DIR, t)
          const sessPath = path.join(tPath, 'sessions')
          const upPath = path.join(tPath, 'uploads')

          if (fs.existsSync(sessPath)) {
            const sFiles = fs.readdirSync(sessPath).filter(f => f.endsWith('.json'))
            totalSessions += sFiles.length
          }

          if (fs.existsSync(upPath)) {
            const walkUploads = (dir: string) => {
              const entries = fs.readdirSync(dir, { withFileTypes: true })
              for (const e of entries) {
                const full = path.join(dir, e.name)
                if (e.isDirectory()) {
                  walkUploads(full)
                } else {
                  totalUploads++
                  try {
                    const st = fs.statSync(full)
                    totalStorageBytes += st.size
                  } catch {}
                }
              }
            }
            walkUploads(upPath)
          }
        }
      } catch (err) {
        console.warn('[LocalAuthService] Error reading tenant stats:', err)
      }
    }

    // Also count global ~/.dsh/sessions
    const globalSessDir = path.join(DSH_DIR, 'sessions')
    if (fs.existsSync(globalSessDir)) {
      try {
        totalSessions += fs.readdirSync(globalSessDir).filter(f => f.endsWith('.json')).length
      } catch {}
    }

    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const activeUsers24h = users.filter(u => (u.lastActiveAt || 0) >= dayAgo).length

    return {
      totalUsers: users.length,
      adminCount,
      userCount,
      totalSessions,
      totalUploads,
      totalStorageBytes,
      activeUsers24h: Math.max(1, activeUsers24h)
    }
  }
}

export const name = 'auth-local'

export function apply(ctx: Context) {
  ctx.set('auth', new LocalAuthService(ctx))
}

export default LocalAuthService
