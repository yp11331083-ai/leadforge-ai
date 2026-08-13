import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

/**
 * GET /api/credits/balance
 * Returns current credit balance + recent transactions
 */
export async function GET() {
  try {
    const user = await requireUser()
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        creditBalance: true,
        monthlyCreditAllowance: true,
        billingCycleResetDate: true,
        plan: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Get recent credit logs
    const recentLogs = await db.creditLog.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      balance: tenant.creditBalance,
      monthlyAllowance: tenant.monthlyCreditAllowance,
      resetDate: tenant.billingCycleResetDate,
      plan: tenant.plan,
      recentTransactions: recentLogs,
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
