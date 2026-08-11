import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// 推送 Lead 到 Smartlead 指定 campaign
export async function POST(req: NextRequest) {
  try {
    const { leadId, campaignId } = await req.json()
    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    if (!lead.email) {
      return NextResponse.json(
        { error: '此名單缺少 email，無法推送至 Smartlead' },
        { status: 400 }
      )
    }
    if (!lead.emailSubject || !lead.emailBody) {
      return NextResponse.json(
        { error: '尚未生成郵件內容，請先點擊「AI 生成郵件」' },
        { status: 400 }
      )
    }

    const config = await db.emailConfig.findUnique({ where: { id: 'singleton' } })
    if (!config?.smartleadApiKey) {
      return NextResponse.json(
        { error: 'Smartlead API Key 尚未設定' },
        { status: 400 }
      )
    }

    // Smartlead API: POST /api/v1/campaigns/{campaign_id}/leads
    // 文件：https://docs.smartlead.ai/reference/add-lead-to-campaign
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
        icebreaker: lead.icebreaker ?? '',
        pain_points: lead.painPoints ?? '',
        source: 'LeadForge AI',
      },
      // 自訂序章（使用我們 AI 生成的內容）
      sequence: [
        {
          subject: lead.emailSubject,
          email_body: lead.emailBody,
        },
      ],
    }

    const res = await fetch(
      `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/leads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Smartlead 推送失敗: ${res.status} ${text.slice(0, 300)}` },
        { status: 502 }
      )
    }

    const data = await res.json()

    // 標記狀態
    await db.lead.update({
      where: { id: leadId },
      data: { status: 'sent' },
    })

    return NextResponse.json({
      success: true,
      smartleadResponse: data,
      campaignId,
      leadEmail: lead.email,
    })
  } catch (error) {
    console.error('POST /api/smartlead/push error:', error)
    const msg = error instanceof Error ? error.message : 'Push failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
