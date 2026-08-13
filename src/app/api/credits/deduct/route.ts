import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { deductCredits, hasCredits } from '@/lib/credits'

/**
 * POST /api/credits/deduct
 * Deduct credits for an action (email send, enrichment, research)
 *
 * Body: { amount: number, description: string, leadId?: string }
 * Returns: 200 with new balance, or 402 if insufficient credits
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const { amount, description, leadId } = await req.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Check if tenant has enough credits
    const hasEnough = await hasCredits(user.tenantId, amount)
    if (!hasEnough) {
      const tenant = await db.tenant.findUnique({
        where: { id: user.tenantId },
        select: { creditBalance: true, plan: true },
      })
      return NextResponse.json({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        currentBalance: tenant?.creditBalance ?? 0,
        required: amount,
        plan: tenant?.plan ?? 'freemium',
        upgradeUrl: '/billing',
      }, { status: 402 })
    }

    // Deduct atomically
    const result = await deductCredits(user.tenantId, amount, description, leadId)

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      balanceAfter: result.balanceAfter,
      deducted: amount,
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
