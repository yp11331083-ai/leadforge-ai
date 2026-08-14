import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { PLAN_CREDITS, CREDIT_PACKS } from '@/lib/credit-pricing'
import Stripe from 'stripe'

/**
 * POST /api/stripe/checkout
 * Body: { planId: 'starter' | 'growth' | 'agency' | 'pack_100' | 'pack_500' | 'pack_2000' }
 *
 * Creates a Stripe Checkout Session for either:
 *  - A monthly subscription (plan upgrade): starter / growth / agency
 *  - A one-time credit pack purchase: pack_100 / pack_500 / pack_2000
 *
 * Returns the URL to redirect the user to.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const { planId } = await req.json()

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    // Determine if this is a subscription or one-time pack
    const isSubscription = ['starter', 'growth', 'agency'].includes(planId)
    const isCreditPack = planId.startsWith('pack_')

    if (!isSubscription && !isCreditPack) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 })
    }

    const stripe = new Stripe(stripeSecretKey)

    // Find or create Stripe customer
    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } })
    let customerId = tenant?.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant?.name ?? user.email,
        metadata: {
          tenantId: user.tenantId,
          tenantSlug: tenant?.slug ?? '',
        },
      })
      customerId = customer.id
      await db.tenant.update({
        where: { id: user.tenantId },
        data: { stripeCustomerId: customerId },
      })
    }

    const baseUrl = process.env.NEXTAUTH_URL ||
      (req.headers.get('origin') ?? 'http://localhost:3000')

    if (isSubscription) {
      // Subscription checkout
      const priceIdMap: Record<string, string | undefined> = {
        starter: process.env.STRIPE_PRICE_STARTER,
        growth: process.env.STRIPE_PRICE_GROWTH,
        agency: process.env.STRIPE_PRICE_AGENCY,
      }
      const priceId = priceIdMap[planId]
      if (!priceId) {
        return NextResponse.json({ error: `Stripe price for ${planId} plan not configured` }, { status: 500 })
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/?checkout=success&plan=${planId}`,
        cancel_url: `${baseUrl}/?checkout=cancelled`,
        metadata: { tenantId: user.tenantId, planId, type: 'subscription' },
        subscription_data: {
          metadata: { tenantId: user.tenantId, planId },
        },
      })

      return NextResponse.json({ url: session.url, sessionId: session.id })
    } else {
      // One-time credit pack checkout
      const pack = CREDIT_PACKS.find((p) => p.id === planId)
      if (!pack) {
        return NextResponse.json({ error: `Unknown credit pack: ${planId}` }, { status: 400 })
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: pack.price * 100,
            product_data: {
              name: `${pack.name} — ${pack.credits} AI Credits`,
              metadata: { pack_id: pack.id, credits: String(pack.credits) },
            },
          },
          quantity: 1,
        }],
        success_url: `${baseUrl}/?checkout=success&pack=${planId}`,
        cancel_url: `${baseUrl}/?checkout=cancelled`,
        metadata: {
          tenantId: user.tenantId,
          packId: pack.id,
          credits: String(pack.credits),
          type: 'credit_pack',
        },
        payment_intent_data: {
          metadata: {
            tenantId: user.tenantId,
            packId: pack.id,
            credits: String(pack.credits),
            type: 'credit_pack',
          },
        },
      })

      return NextResponse.json({ url: session.url, sessionId: session.id })
    }
  } catch (error: any) {
    console.error('POST /api/stripe/checkout error:', error)
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
    }
    return NextResponse.json(
      { error: error.message ?? 'Checkout failed' },
      { status: 500 }
    )
  }
}
