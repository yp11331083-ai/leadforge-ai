import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, tenantFilter } from '@/lib/auth/session'
import Stripe from 'stripe'

/**
 * GET /api/usage
 * 回傳 tenant 的真實 analytics 數據（從 EmailEvent + Meeting + UsageEvent 計算）
 */
export async function GET() {
  try {
    const user = await requireUser()
    const tenantId = user.tenantId

    // 撈所有 email events（Manager 看全部，SDR 只看自己）
    const eventFilter = user.role === 'sdr'
      ? { tenantId, lead: { assigneeId: user.id } }
      : { tenantId }

    const emailEvents = await db.emailEvent.findMany({
      where: eventFilter,
      include: { lead: { select: { id: true, company: true, assigneeId: true } } },
      orderBy: { eventTime: 'desc' },
    })

    // 計算各種事件數量
    const stats = {
      sent: emailEvents.filter((e) => e.eventType === 'sent').length,
      delivered: emailEvents.filter((e) => e.eventType === 'delivered').length,
      opened: emailEvents.filter((e) => e.eventType === 'opened').length,
      replied: emailEvents.filter((e) => e.eventType === 'replied').length,
      bounced: emailEvents.filter((e) => e.eventType === 'bounced').length,
      clicked: emailEvents.filter((e) => e.eventType === 'clicked').length,
    }

    // 不重複開信人數（同一個 lead 算一次）
    const uniqueOpenedLeads = new Set(
      emailEvents.filter((e) => e.eventType === 'opened').map((e) => e.leadId)
    ).size

    const meetings = await db.meeting.findMany({
      where: eventFilter,
      include: { lead: { select: { company: true, contactName: true } } },
    })

    // 開信率 = 開信人數 / 已發送
    const openRate = stats.sent > 0 ? Math.round((uniqueOpenedLeads / stats.sent) * 100) : 0
    // 回覆率 = 回覆數 / 已發送
    const replyRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0
    // 會議轉換率 = 會議數 / 已發送
    const meetingRate = stats.sent > 0 ? Math.round((meetings.length / stats.sent) * 100) : 0

    // 本週趨勢（從 7 天前到現在）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentEvents = emailEvents.filter((e) => e.eventTime >= sevenDaysAgo)

    const trend7d = Array.from({ length: 7 }).map((_, i) => {
      const dayStart = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      const dayEvents = recentEvents.filter(
        (e) => e.eventTime >= dayStart && e.eventTime < dayEnd
      )
      return {
        day: ['週一', '週二', '週三', '週四', '週五', '週六', '週日'][(dayStart.getDay() + 6) % 7],
        sent: dayEvents.filter((e) => e.eventType === 'sent').length,
        opened: dayEvents.filter((e) => e.eventType === 'opened').length,
        replied: dayEvents.filter((e) => e.eventType === 'replied').length,
      }
    })

    // 最近事件時間軸
    const recentActivity = emailEvents.slice(0, 20).map((e) => ({
      leadId: e.leadId,
      company: e.lead?.company,
      eventType: e.eventType,
      time: e.eventTime,
    }))

    // 即將到來的會議
    const upcomingMeetings = meetings
      .filter((m) => m.startTime > new Date() && m.status === 'scheduled')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        leadId: m.leadId,
        company: m.lead?.company,
        attendeeName: m.attendeeName,
        attendeeEmail: m.attendeeEmail,
        startTime: m.startTime,
        endTime: m.endTime,
      }))

    return NextResponse.json({
      stats: {
        ...stats,
        uniqueOpenedLeads,
        meetings: meetings.length,
        upcomingMeetings: upcomingMeetings.length,
        openRate,
        replyRate,
        meetingRate,
      },
      trend7d,
      recentActivity,
      upcomingMeetings,
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('GET /api/usage error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/usage
 * 手動觸發：把未上報的 usage 報到 Stripe
 */
export async function POST() {
  try {
    const user = await requireUser()
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '只有 admin 可以觸發' }, { status: 403 })
    }

    const config = await db.emailConfig.findUnique({ where: { tenantId: user.tenantId } })
    if (!config?.stripeSecretKey || !config?.stripeMeteredPriceId) {
      return NextResponse.json({ error: '尚未設定 Stripe Secret Key 或 Price ID' }, { status: 400 })
    }

    // 找出所有未上報的 email_sent usage events
    const unrecorded = await db.usageEvent.findMany({
      where: {
        tenantId: user.tenantId,
        type: 'email_sent',
        stripeUsageRecorded: false,
      },
    })

    if (unrecorded.length === 0) {
      return NextResponse.json({ success: true, recorded: 0, message: '沒有待上報的用量' })
    }

    const stripe = new Stripe(config.stripeSecretKey)
    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } })

    if (!tenant?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Tenant 沒有 Stripe subscription' }, { status: 400 })
    }

    // 取得 subscription 的 metered item
    const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId)
    const meteredItem = subscription.items.data.find(
      (item) => item.price?.id === config.stripeMeteredPriceId && item.price?.recurring?.usage_type === 'metered'
    )

    if (!meteredItem) {
      return NextResponse.json({ error: '找不到 metered subscription item' }, { status: 400 })
    }

    // 建立一筆 usage record（用現在的 timestamp）
    await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
      quantity: unrecorded.length,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    })

    // 標記所有已上報
    await db.usageEvent.updateMany({
      where: { id: { in: unrecorded.map((u) => u.id) } },
      data: { stripeUsageRecorded: true, recordedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      recorded: unrecorded.length,
      message: `已上報 ${unrecorded.length} 筆用量到 Stripe`,
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('POST /api/usage error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
