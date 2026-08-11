import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateColdEmail } from '@/lib/ai/agent'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      leadId,
      senderName,
      senderCompany,
      senderProduct,
      tone = 'professional',
      language = 'zh-TW',
    } = body

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }
    if (!senderName || !senderCompany || !senderProduct) {
      return NextResponse.json(
        { error: 'senderName, senderCompany, senderProduct are required' },
        { status: 400 }
      )
    }

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // 解析研究結果
    let research: {
      business_summary?: string
      pain_points?: string[]
      buying_signals?: string[]
      outreach_angle?: string
    } = {}
    let hiringSignals: string[] = []

    if (lead.painPoints) {
      try {
        research = JSON.parse(lead.painPoints)
      } catch {
        /* keep default */
      }
    }
    if (lead.hiringSignals) {
      try {
        hiringSignals = JSON.parse(lead.hiringSignals)
      } catch {
        /* keep default */
      }
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
      return NextResponse.json(
        { error: 'Email generation failed', raw: result.raw },
        { status: 500 }
      )
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

    return NextResponse.json({
      success: true,
      leadId,
      email: emailData,
    })
  } catch (error) {
    console.error('POST /api/generate-email error:', error)
    return NextResponse.json({ error: 'Email generation failed' }, { status: 500 })
  }
}
