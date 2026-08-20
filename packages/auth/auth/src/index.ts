import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { User, UserRole, TenantContext } from '@custom-harness/core-types'
import type { CreateUserDto, UpdateUserDto, AuthOverviewStats } from './types.js'

export * from './types.js'

export abstract class AuthService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'auth')
  }

  /**
   * Authenticates user by username/password or token/API key.
   */
  public abstract authenticate(credentials: { username?: string; password?: string; token?: string; userId?: string }): Promise<User | null>

  /**
   * Login user with username & password, returns JWT token.
   */
  public abstract login(dto: import('./types.js').LoginDto): Promise<import('./types.js').AuthResult>

  /**
   * Register a new user and return JWT token.
   */
  public abstract register(dto: import('./types.js').RegisterDto): Promise<import('./types.js').AuthResult>

  /**
   * Creates a signed JWT token for a given user.
   */
  public abstract createToken(user: User): string

  /**
   * Verifies and decodes a signed JWT token.
   */
  public abstract verifyToken(token: string): import('./types.js').JwtPayload | null

  /**
   * Retrieves a user by their unique ID or username.
   */
  public abstract getUser(idOrUsername: string): Promise<User | null>

  /**
   * Lists all registered users.
   */
  public abstract listUsers(): Promise<User[]>

  /**
   * Creates a new user with tenant directory allocation.
   */
  public abstract createUser(dto: CreateUserDto): Promise<User>

  /**
   * Updates an existing user.
   */
  public abstract updateUser(userId: string, dto: UpdateUserDto): Promise<User>

  /**
   * Deletes a user and optionally cleans up their tenant resources.
   */
  public abstract deleteUser(userId: string, cleanupStorage?: boolean): Promise<boolean>

  /**
   * Returns the tenant context paths and isolation namespaces for a given user.
   */
  public abstract getTenantContext(userId: string): TenantContext

  /**
   * Checks whether a user has permission to perform an action on a resource.
   */
  public abstract hasPermission(user: User | string, action: string, targetUserId?: string): boolean

  /**
   * Returns system-wide multi-tenancy overview statistics for administrators.
   */
  public abstract getOverviewStats(): Promise<AuthOverviewStats>
}

export const name = 'auth'

export function apply(ctx: Context) {
  // Service definition seam
}

export default AuthService
