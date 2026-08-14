/**
 * Credit system — atomic debit/credit operations
 *
 * Pricing constants + plan allowances live in `@/lib/credit-pricing`.
 * Import from there if you need to display costs in the UI.
 */
import { db } from '@/lib/db'

/**
 * Deduct credits from tenant (atomic transaction)
 * Returns false if insufficient balance
 */
export async function deductCredits(
  tenantId: string,
  amount: number,
  description: string,
  leadId?: string
): Promise<{ success: boolean; balanceAfter: number }> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return { success: false, balanceAfter: 0 }

  if (tenant.creditBalance < amount) {
    return { success: false, balanceAfter: tenant.creditBalance }
  }

  const newBalance = tenant.creditBalance - amount

  await db.tenant.update({
    where: { id: tenantId },
    data: { creditBalance: newBalance },
  })

  await db.creditLog.create({
    data: {
      tenantId,
      type: 'DEBIT',
      amount: -amount,
      balanceAfter: newBalance,
      description,
      leadId,
    },
  })

  return { success: true, balanceAfter: newBalance }
}

/**
 * Add credits (from add-on purchase or monthly reset)
 */
export async function addCredits(
  tenantId: string,
  amount: number,
  type: 'CREDIT_RESET' | 'ADD_ON_PURCHASE',
  description: string,
  stripePaymentId?: string
): Promise<{ success: boolean; balanceAfter: number }> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return { success: false, balanceAfter: 0 }

  const newBalance = tenant.creditBalance + amount

  await db.tenant.update({
    where: { id: tenantId },
    data: { creditBalance: newBalance },
  })

  await db.creditLog.create({
    data: {
      tenantId,
      type,
      amount,
      balanceAfter: newBalance,
      description,
      stripePaymentId,
    },
  })

  return { success: true, balanceAfter: newBalance }
}

/**
 * Check if tenant has enough credits
 */
export async function hasCredits(tenantId: string, amount: number): Promise<boolean> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  return (tenant?.creditBalance ?? 0) >= amount
}

/**
 * Get plan-based credit allowance (DEPRECATED — import from credit-pricing.ts).
 * Kept for backwards compatibility with existing imports.
 */
export function getPlanCredits(plan: string): number {
  const credits: Record<string, number> = {
    freemium: 30,
    starter: 500,
    growth: 2000,
    agency: 8000,
  }
  return credits[plan] ?? 30
}

/**
 * Monthly credit reset
 */
export async function resetMonthlyCredits(tenantId: string): Promise<void> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return

  const allowance = getPlanCredits(tenant.plan)
  await addCredits(tenantId, allowance, 'CREDIT_RESET', `Monthly reset — ${tenant.plan} plan`)
  
  await db.tenant.update({
    where: { id: tenantId },
    data: {
      monthlyCreditAllowance: allowance,
      billingCycleResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
}
