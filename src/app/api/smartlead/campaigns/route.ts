import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, leadFilter } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await requireUser()
    const config = await db.emailConfig.findUnique({ where: { tenantId: user.tenantId } })
    if (!config?.smartleadApiKey) {
      return NextResponse.json({ error: 'Smartlead API Key 尚未設定' }, { status: 400 })
    }

    const res = await fetch(`https://server.smartlead.ai/api/v1/campaigns?api_key=${config.smartleadApiKey}`)
    if (!res.ok) {
      return NextResponse.json({ error: `Smartlead API 失敗: ${res.status}` }, { status: 502 })
    }

    const data = (await res.json()) as any[]
    const campaigns = data.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      leadsCount: c.leads_count,
      sequenceSteps: c.sequence_step_count,
      createdAt: c.created_at,
    }))

    return NextResponse.json({ campaigns })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const { leadId, campaignId } = await req.json()
    if (!leadId || !campaignId) return NextResponse.json({ error: 'leadId and campaignId required' }, { status: 400 })

    const lead = await db.lead.findFirst({ where: { id: leadId, ...leadFilter(user) } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.email) return NextResponse.json({ error: '缺少 email' }, { status: 400 })

    const config = await db.emailConfig.findUnique({ where: { tenantId: user.tenantId } })
    if (!config?.smartleadApiKey) return NextResponse.json({ error: 'Smartlead 未設定' }, { status: 400 })

    const payload = {
      api_key: config.smartleadApiKey,
      email: lead.email,
      first_name: lead.contactName?.split(' ')[0] ?? '',
      last_name: lead.contactName?.split(' ').slice(1).join(' ') ?? '',
      company_name: lead.company,
      industry: lead.industry ?? '',
      location: lead.location ?? '',
      custom_variables: {
        company: lead.company,
        contact_name: lead.contactName ?? '',
        title: lead.title ?? '',
        source: 'LeadOutrovo',
      },
      sequence: [{ subject: lead.emailSubject, email_body: lead.emailBody }],
    }

    const res = await fetch(`https://server.smartlead.ai/api/v1/campaigns/${campaignId}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Smartlead 推送失敗: ${res.status}` }, { status: 502 })
    }

    // 記錄事件 + 用量
    await db.lead.update({ where: { id: leadId }, data: { status: 'sent' } })
    await db.emailEvent.create({
      data: {
        tenantId: user.tenantId,
        leadId,
        eventType: 'sent',
        rawPayload: JSON.stringify({ campaignId, to: lead.email }),
      },
    })
    await db.usageEvent.create({
      data: { tenantId: user.tenantId, type: 'email_sent', leadId },
    })

    return NextResponse.json({ success: true, campaignId, leadEmail: lead.email })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message ?? 'Push failed' }, { status: 500 })
  }
}
