import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Cal.com Webhook 接收端
 *
 * 設定方式：
 * 1. 至 Cal.com 後台 → Settings → Webhooks
 * 2. URL: https://your-domain.com/api/webhooks/calcom
 * 3. 訂閱事件：booking.created, booking.cancelled
 *
 * 當潛在客戶透過信中連結成功預約會議時，Cal.com 會傳送 booking.created 事件
 * 我們會：
 * - 從 attendee email 找出對應的 lead
 * - 寫入 Meeting 記錄
 * - 「約到會議」KPI 自動 +1
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rawBody = JSON.stringify(body)

    // Cal.com webhook payload 結構
    // {
    //   "triggerEvent": "booking.created" | "booking.cancelled",
    //   "payload": {
    //     "uid": "booking_abc123",
    //     "eventTypeId": 123,
    //     "startTime": "2024-01-20T10:00:00Z",
    //     "endTime": "2024-01-20T10:30:00Z",
    //     "attendees": [{ "email": "prospect@example.com", "name": "John Doe" }],
    //     ...
    //   }
    // }

    const triggerEvent = body.triggerEvent || body.type
    const payload = body.payload || body

    if (!triggerEvent) {
      return NextResponse.json({ error: 'Missing triggerEvent' }, { status: 400 })
    }

    const bookingId = payload.uid || payload.id || payload.bookingId
    const attendeeEmail = payload.attendees?.[0]?.email || payload.attendee?.email
    const attendeeName = payload.attendees?.[0]?.name || payload.attendee?.name
    const eventTypeId = payload.eventTypeId?.toString()
    const startTime = payload.startTime ? new Date(payload.startTime) : new Date()
    const endTime = payload.endTime ? new Date(payload.endTime) : new Date(startTime.getTime() + 30 * 60 * 1000)

    if (!attendeeEmail) {
      return NextResponse.json({ error: 'Missing attendee email' }, { status: 400 })
    }

    // 找出對應的 lead
    const lead = await db.lead.findFirst({
      where: { email: attendeeEmail },
    })

    if (triggerEvent === 'booking.created' || triggerEvent === 'BOOKING_CREATED') {
      // 檢查是否已存在（避免重複）
      const existing = await db.meeting.findFirst({
        where: { externalId: bookingId },
      })

      if (existing) {
        return NextResponse.json({ received: true, note: 'Meeting already exists' })
      }

      // 取得 lead 的 tenantId（如果有 lead）
      const tenantId = lead?.tenantId ?? await getTenantIdFromEmail(attendeeEmail)

      if (!tenantId) {
        return NextResponse.json({
          received: true,
          note: 'Lead not found, cannot determine tenant',
        })
      }

      // 建立 meeting
      await db.meeting.create({
        data: {
          tenantId,
          leadId: lead?.id ?? null,
          source: 'calcom',
          externalId: bookingId,
          attendeeEmail,
          attendeeName,
          eventTypeId,
          startTime,
          endTime,
          status: 'scheduled',
          rawPayload: rawBody,
        },
      })

      // 如果有對應的 lead，更新 status 為 replied（如果還不是）
      if (lead && !['replied', 'sent'].includes(lead.status)) {
        await db.lead.update({
          where: { id: lead.id },
          data: { status: 'replied' },
        })
      }

      return NextResponse.json({
        received: true,
        event: 'booking.created',
        leadId: lead?.id,
        meetingScheduledAt: startTime,
      })

    } else if (triggerEvent === 'booking.cancelled' || triggerEvent === 'BOOKING_CANCELLED') {
      // 取消會議
      const meeting = await db.meeting.findFirst({
        where: { externalId: bookingId },
      })

      if (meeting) {
        await db.meeting.update({
          where: { id: meeting.id },
          data: { status: 'cancelled' },
        })
        return NextResponse.json({ received: true, event: 'booking.cancelled' })
      }

      return NextResponse.json({ received: true, note: 'Meeting not found' })
    }

    return NextResponse.json({ received: true, event: triggerEvent })
  } catch (error: any) {
    console.error('Cal.com webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function getTenantIdFromEmail(email: string): Promise<string | null> {
  // 簡單 fallback：找第一個 tenant
  const tenant = await db.tenant.findFirst({ where: { status: 'active' } })
  return tenant?.id ?? null
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Cal.com Webhook',
    status: 'active',
    events: ['booking.created', 'booking.cancelled'],
  })
}
