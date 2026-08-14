import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import Stripe from 'stripe'

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so the user can manage their
 * subscription (upgrade/downgrade/cancel, update card, view invoices).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } })
    if (!tenant?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      )
    }

    const stripe = new Stripe(stripeSecretKey)
    const baseUrl = process.env.NEXTAUTH_URL ||
      (req.headers.get('origin') ?? 'http://localhost:3000')

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${baseUrl}/`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('POST /api/stripe/portal error:', error)
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
    }
    return NextResponse.json(
      { error: error.message ?? 'Portal failed' },
      { status: 500 }
    )
  }
}
