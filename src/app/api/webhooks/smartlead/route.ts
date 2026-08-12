import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Smartlead Webhook 接收端
 *
 * 設定方式：
 * 1. 至 Smartlead 後台 → Webhooks
 * 2. URL: https://your-domain.com/api/webhooks/smartlead
 * 3. 勾選事件：Email Sent, Email Opened, Email Replied, Email Bounced
 *
 * Smartlead 會傳送 JSON 訊號到這個 endpoint
 * 我們會：
 * - 找出對應的 lead（用 email 或 campaign lead ID）
 * - 寫入 EmailEvent
 * - 更新 lead.status（replied → 標記為已回覆）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rawBody = JSON.stringify(body)

    // Smartlead webhook payload 結構（簡化）：
    // {
    //   "event_type": "email_opened" | "email_replied" | "email_sent" | "email_bounced",
    //   "campaign_id": 123,
    //   "lead_id": 456,
    //   "lead_email": "prospect@example.com",
    //   "timestamp": "2024-01-15T10:30:00Z",
    //   ...
    // }

    const eventType = body.event_type || body.event || body.type
    const leadEmail = body.lead_email || body.email || body.to
    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date()
    const smartleadLeadId = body.lead_id?.toString()

    if (!eventType || !leadEmail) {
      return NextResponse.json({ error: 'Missing event_type or lead_email' }, { status: 400 })
    }

    // 將 Smartlead event type 標準化
    const normalizedType = normalizeEventType(eventType)

    // 透過 email 找出對應的 lead
    const lead = await db.lead.findFirst({
      where: { email: leadEmail },
    })

    if (!lead) {
      // 找不到 lead，仍然回 200（避免 Smartlead 一直 retry）
      return NextResponse.json({
        received: true,
        event: normalizedType,
        note: 'Lead not found in database (可能是 Smartlead 自己的 lead)',
      })
    }

    // 寫入 EmailEvent
    await db.emailEvent.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        eventType: normalizedType,
        eventTime: timestamp,
        rawPayload: rawBody,
      },
    })

    // 根據事件更新 lead.status
    if (normalizedType === 'replied') {
      await db.lead.update({
        where: { id: lead.id },
        data: { status: 'replied' },
      })
    } else if (normalizedType === 'bounced') {
      // 退信不變更 status，但記錄
      console.warn(`Email bounced for ${leadEmail}: ${body.reason ?? 'unknown'}`)
    }

    return NextResponse.json({
      received: true,
      event: normalizedType,
      leadId: lead.id,
      company: lead.company,
    })
  } catch (error: any) {
    console.error('Smartlead webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function normalizeEventType(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('sent')) return 'sent'
  if (t.includes('deliver')) return 'delivered'
  if (t.includes('open')) return 'opened'
  if (t.includes('reply') || t.includes('response')) return 'replied'
  if (t.includes('bounce')) return 'bounced'
  if (t.includes('click')) return 'clicked'
  return t
}

// GET 用於驗證 webhook 設定
export async function GET() {
  return NextResponse.json({
    endpoint: 'Smartlead Webhook',
    status: 'active',
    events: ['sent', 'delivered', 'opened', 'replied', 'bounced', 'clicked'],
  })
}
