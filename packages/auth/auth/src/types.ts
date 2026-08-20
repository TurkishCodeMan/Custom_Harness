import type { User, UserRole, TenantContext } from '@custom-harness/core-types'

export type { User, UserRole, TenantContext }

export interface CreateUserDto {
  username: string
  name: string
  email?: string
  role?: UserRole
  password?: string
  avatar?: string
}

export interface UpdateUserDto {
  name?: string
  email?: string
  role?: UserRole
  password?: string
  avatar?: string
}

export interface LoginDto {
  username: string
  password?: string
}

export interface RegisterDto {
  username: string
  name: string
  email?: string
  password?: string
  role?: UserRole
  avatar?: string
}

export interface JwtPayload {
  userId: string
  username: string
  role: UserRole
  name: string
  exp: number
  iat: number
}

export interface AuthResult {
  success: boolean
  user?: User
  token?: string
  error?: string
}

export interface AuthOverviewStats {
  totalUsers: number
  adminCount: number
  userCount: number
  totalSessions: number
  totalUploads: number
  totalStorageBytes: number
  activeUsers24h: number
}
