import { getServerSession } from 'next-auth'
import { authOptions } from './auth-options'
import { db } from '@/lib/db'
import type { Role } from './auth-options'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  tenantId: string
  tenantName: string
  tenantSlug: string
  tenantPlan: string
}

export async function getSession(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as unknown as SessionUser
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) {
    throw new Error('FORBIDDEN')
  }
  return user
}

/**
 * 檢查使用者能否存取某個 view
 */
export function canAccessView(role: Role, view: 'admin' | 'sales' | 'analytics' | 'billing'): boolean {
  const access: Record<Role, string[]> = {
    admin: ['admin', 'sales', 'analytics', 'billing'],
    sales_manager: ['sales', 'analytics'],
    sdr: ['sales'],
  }
  return access[role].includes(view)
}

/**
 * 取得使用者的 tenant 過濾條件（強制 tenant_id 隔離）
 * 所有查詢都必須加上這個 where
 */
export function tenantFilter(user: SessionUser) {
  return { tenantId: user.tenantId }
}

/**
 * SDR 只能看到分配給自己的 leads
 * Manager / Admin 可以看全部
 */
export function leadFilter(user: SessionUser) {
  if (user.role === 'sdr') {
    return {
      tenantId: user.tenantId,
      assigneeId: user.id,
    }
  }
  return { tenantId: user.tenantId }
}

/**
 * 產生 webhook signature（HMAC SHA256）
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const crypto = await import('crypto')
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    return expected === signature
  } catch {
    return false
  }
}
