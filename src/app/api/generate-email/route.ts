import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, leadFilter } from '@/lib/auth/session'
import { generateColdEmail } from '@/lib/ai/agent'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const { leadId, senderName, senderCompany, senderProduct, tone = 'professional', language = 'zh-TW' } = body

    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

    const lead = await db.lead.findFirst({ where: { id: leadId, ...leadFilter(user) } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    let research: any = {}
    let hiringSignals: string[] = []
    if (lead.painPoints) {
      try { research = JSON.parse(lead.painPoints) } catch {}
    }
    if (lead.hiringSignals) {
      try { hiringSignals = JSON.parse(lead.hiringSignals) } catch {}
    }

    await db.lead.update({ where: { id: leadId }, data: { status: 'drafting' } })

    const result = await generateColdEmail({
      company: lead.company,
      contactName: lead.contactName ?? undefined,
      title: lead.title ?? undefined,
      industry: lead.industry ?? undefined,
      painPoints: research.pain_points,
      hiringSignals,
      buyingSignals: research.buying_signals,
      outreachAngle: research.outreach_angle,
      businessSummary: research.business_summary,
      senderName,
      senderCompany,
      senderProduct,
      tone,
      language,
    })

    if (!result.success) {
      await db.lead.update({ where: { id: leadId }, data: { status: 'researched' } })
      return NextResponse.json({ error: 'Email generation failed' }, { status: 500 })
    }

    const emailData = result.data
    await db.lead.update({
      where: { id: leadId },
      data: {
        status: 'ready',
        emailSubject: emailData.subject,
        emailBody: emailData.body,
        icebreaker: emailData.icebreaker,
      },
    })

    return NextResponse.json({ success: true, leadId, email: emailData })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('POST /api/generate-email error:', error)
    return NextResponse.json({ error: 'Email generation failed' }, { status: 500 })
  }
}
