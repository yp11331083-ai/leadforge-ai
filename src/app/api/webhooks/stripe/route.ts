import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import Stripe from 'stripe'

/**
 * Stripe Webhook 接收端
 *
 * 設定方式：
 * 1. 至 Stripe Dashboard → Developers → Webhooks
 * 2. URL: https://your-domain.com/api/webhooks/stripe
 * 3. 訂閱事件：
 *    - customer.subscription.created
 *    - customer.subscription.updated
 *    - customer.subscription.deleted
 *    - invoice.payment_succeeded
 *    - invoice.payment_failed
 *
 * 用量計費流程：
 * - 客戶每次發信，後台建立 UsageEvent（stripeUsageRecorded = false）
 * - 定期 cron job（或手動觸發）將未上報的 usage 報到 Stripe
 * - Stripe 月底依總用量自動扣款
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    // 從 webhook signature 找出對應的 tenant（每個 tenant 有自己的 stripeWebhookSecret）
    // 嘗試所有 tenants 的 webhook secret 來驗證
    const tenants = await db.tenant.findMany({
      where: {
        emailConfig: { stripeWebhookSecret: { not: null } },
      },
      include: { emailConfig: true },
    })

    let stripeEvent: Stripe.Event | null = null
    let matchedTenantId: string | null = null

    for (const tenant of tenants) {
      const secret = tenant.emailConfig?.stripeWebhookSecret
      if (!secret) continue

      try {
        const config = await db.emailConfig.findUnique({ where: { tenantId: tenant.id } })
        const stripeKey = config?.stripeSecretKey
        if (!stripeKey) continue

        const stripe = new Stripe(stripeKey)
        stripeEvent = stripe.webhooks.constructEvent(body, signature, secret)
        matchedTenantId = tenant.id
        break
      } catch {
        // 此 secret 不對，繼續試下一個
        continue
      }
    }

    if (!stripeEvent || !matchedTenantId) {
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    const eventType = stripeEvent.type
    const data = stripeEvent.data.object as any

    console.log(`Stripe webhook: ${eventType} for tenant ${matchedTenantId}`)

    // 處理訂閱事件
    if (eventType === 'customer.subscription.created' || eventType === 'customer.subscription.updated') {
      const subscription = data as Stripe.Subscription
      const customerId = subscription.customer as string

      // 更新 tenant 的 stripe 資訊
      await db.tenant.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          stripeSubscriptionId: subscription.id,
          status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'suspended',
          plan: determinePlan(subscription),
        },
      })
    }

    if (eventType === 'customer.subscription.deleted') {
      const subscription = data as Stripe.Subscription
      await db.tenant.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'cancelled', plan: 'cancelled' },
      })
    }

    if (eventType === 'invoice.payment_succeeded') {
      const invoice = data as Stripe.Invoice
      console.log(`Payment succeeded for customer ${invoice.customer}: $${invoice.amount_paid / 100}`)
      // 可以在這裡發送 email 通知客戶
    }

    if (eventType === 'invoice.payment_failed') {
      const invoice = data as Stripe.Invoice
      console.warn(`Payment failed for customer ${invoice.customer}`)
      // 可以在這裡通知客戶付款失敗
    }

    return NextResponse.json({ received: true, type: eventType })
  } catch (error: any) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function determinePlan(subscription: Stripe.Subscription): string {
  const priceId = subscription.items.data[0]?.price?.id
  // 從 priceId 判斷方案（需依實際 Stripe 設定）
  if (priceId?.includes('enterprise')) return 'enterprise'
  if (priceId?.includes('pro')) return 'pro'
  if (priceId?.includes('starter')) return 'starter'
  return 'pro'
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Stripe Webhook',
    status: 'active',
    events: [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
    ],
  })
}
