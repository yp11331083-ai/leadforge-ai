import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import Stripe from 'stripe'
import { PLAN_CREDITS } from '@/lib/credit-pricing'
import { addCredits } from '@/lib/credits'

/**
 * Stripe Webhook Receiver
 *
 * Setup:
 * 1. Stripe Dashboard → Developers → Webhooks
 * 2. URL: https://your-domain.com/api/webhooks/stripe
 * 3. Subscribe to:
 *    - checkout.session.completed
 *    - customer.subscription.created
 *    - customer.subscription.updated
 *    - customer.subscription.deleted
 *    - invoice.payment_succeeded
 *    - invoice.payment_failed
 *
 * How it works:
 * - When a user subscribes via /api/stripe/checkout, Stripe sends
 *   `checkout.session.completed` + `customer.subscription.created` here.
 * - We update the tenant's plan + grant the monthly credit allowance.
 * - On renewal (`invoice.payment_succeeded`), we grant the credits again.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripeSecretKey || !webhookSecret) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    const stripe = new Stripe(stripeSecretKey)
    let stripeEvent: Stripe.Event

    try {
      stripeEvent = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 })
    }

    const eventType = stripeEvent.type
    const data = stripeEvent.data.object as any

    console.log(`Stripe webhook: ${eventType}`)

    // === checkout.session.completed ===
    // Fires when user completes the Stripe Checkout page.
    // Handles both subscription upgrades AND one-time credit pack purchases.
    if (eventType === 'checkout.session.completed') {
      const session = data as Stripe.Checkout.Session
      const tenantId = session.metadata?.tenantId
      const type = session.metadata?.type
      const customerId = session.customer as string

      if (!tenantId) {
        console.warn('Missing tenantId in checkout.session.completed:', session.metadata)
        return NextResponse.json({ received: true, warning: 'missing tenantId' })
      }

      const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
      if (!tenant) {
        console.warn(`Tenant ${tenantId} not found`)
        return NextResponse.json({ received: true, warning: 'tenant not found' })
      }

      if (type === 'credit_pack') {
        // One-time credit pack purchase — grant credits immediately
        const credits = parseInt(session.metadata?.credits ?? '0', 10)
        if (credits > 0) {
          await addCredits(
            tenantId,
            credits,
            'ADD_ON_PURCHASE',
            `Credit pack purchase: ${credits} credits (Stripe session ${session.id})`,
            session.id
          )
          console.log(`✓ Tenant ${tenantId} bought ${credits} credit pack`)
        }
      } else if (type === 'subscription') {
        // Subscription upgrade — update plan + RESET credits to new plan's allowance
        // (NOT add to existing balance — that would let users accumulate by upgrading
        // multiple times. Each subscription change starts a fresh billing cycle.)
        const planId = session.metadata?.planId
        if (!planId) {
          console.warn('Missing planId in subscription checkout metadata')
          return NextResponse.json({ received: true, warning: 'missing planId' })
        }

        const planInfo = PLAN_CREDITS[planId]
        if (!planInfo) {
          console.warn(`Unknown planId: ${planId}`)
          return NextResponse.json({ received: true, warning: 'unknown plan' })
        }

        await db.tenant.update({
          where: { id: tenantId },
          data: {
            plan: planId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: session.subscription as string,
            status: 'active',
            monthlyCreditAllowance: planInfo.credits,
            creditBalance: planInfo.credits,  // RESET to full allowance (fresh cycle)
            billingCycleResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })

        // Log the credit reset (no addCredits call — we set balance directly above)
        await db.creditLog.create({
          data: {
            tenantId,
            type: 'CREDIT_RESET',
            amount: planInfo.credits,
            balanceAfter: planInfo.credits,
            description: `Subscription activated: ${planId} plan (reset to ${planInfo.credits} credits)`,
            stripePaymentId: session.id,
          },
        })

        console.log(`✓ Tenant ${tenantId} upgraded to ${planId}, balance reset to ${planInfo.credits} credits`)
      }
    }

    // === customer.subscription.updated ===
    // Fires on upgrade/downgrade via Customer Portal
    if (eventType === 'customer.subscription.updated') {
      const subscription = data as Stripe.Subscription
      const customerId = subscription.customer as string
      const tenant = await db.tenant.findFirst({ where: { stripeCustomerId: customerId } })

      if (tenant) {
        const newPlanId = determinePlanFromPrice(subscription.items.data[0]?.price?.id)
        if (newPlanId) {
          const planInfo = PLAN_CREDITS[newPlanId]
          await db.tenant.update({
            where: { id: tenant.id },
            data: {
              plan: newPlanId,
              stripeSubscriptionId: subscription.id,
              status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'suspended',
              ...(planInfo ? {
                monthlyCreditAllowance: planInfo.credits,
                // Reset balance on plan change — starts fresh billing cycle
                creditBalance: planInfo.credits,
              } : {}),
            },
          })
          console.log(`✓ Tenant ${tenant.id} subscription updated to ${newPlanId}, balance reset`)
        }
      }
    }

    // === customer.subscription.deleted ===
    if (eventType === 'customer.subscription.deleted') {
      const subscription = data as Stripe.Subscription
      await db.tenant.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'cancelled', plan: 'freemium', monthlyCreditAllowance: 30 },
      })
      console.log(`Subscription ${subscription.id} cancelled — tenant downgraded to freemium`)
    }

    // === invoice.payment_succeeded ===
    // Fires on every successful payment (initial + monthly renewals)
    if (eventType === 'invoice.payment_succeeded') {
      const invoice = data as Stripe.Invoice
      const customerId = invoice.customer as string

      // Only grant credits on RENEWAL (not the first invoice — that's handled by checkout.session.completed)
      if (invoice.billing_reason === 'subscription_cycle') {
        const tenant = await db.tenant.findFirst({ where: { stripeCustomerId: customerId } })
        if (tenant && tenant.plan !== 'freemium') {
          const planInfo = PLAN_CREDITS[tenant.plan]
          if (planInfo) {
            // On renewal, RESET balance to full monthly allowance
            // (don't add to existing — that would let unused credits accumulate)
            await db.tenant.update({
              where: { id: tenant.id },
              data: {
                creditBalance: planInfo.credits,
                billingCycleResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            })
            await db.creditLog.create({
              data: {
                tenantId: tenant.id,
                type: 'CREDIT_RESET',
                amount: planInfo.credits,
                balanceAfter: planInfo.credits,
                description: `Monthly renewal: ${tenant.plan} plan (reset to ${planInfo.credits} credits)`,
                stripePaymentId: invoice.id,
              },
            })
            console.log(`✓ Tenant ${tenant.id} renewed: balance reset to ${planInfo.credits} credits`)
          }
        }
      }
    }

    if (eventType === 'invoice.payment_failed') {
      const invoice = data as Stripe.Invoice
      console.warn(`Payment failed for customer ${invoice.customer}`)
    }

    return NextResponse.json({ received: true, type: eventType })
  } catch (error: any) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Map a Stripe price ID back to a planId using the env vars we set.
 */
function determinePlanFromPrice(priceId?: string): string | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter'
  if (priceId === process.env.STRIPE_PRICE_GROWTH) return 'growth'
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return 'agency'
  return null
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Stripe Webhook',
    status: 'active',
    events: [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
    ],
  })
}
