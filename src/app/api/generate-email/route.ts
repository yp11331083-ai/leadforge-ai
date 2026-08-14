import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, leadFilter } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { generateColdEmail } from '@/lib/ai/agent'
import { deductCredits, hasCredits, addCredits } from '@/lib/credits'
import { CREDIT_COSTS } from '@/lib/credit-pricing'

/** Refund credits if email generation fails. */
async function refundCredits(tenantId: string, amount: number, reason: string): Promise<void> {
  try {
    await addCredits(tenantId, amount, 'CREDIT_RESET', `[REFUND] ${reason}`)
  } catch (e) {
    console.error('refundCredits failed:', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    await loadProviderConfig()
    const body = await req.json()
    const { leadId, senderName, senderCompany, senderProduct, tone = 'professional', language = 'zh-TW' } = body

    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

    // === Credit check ===
    const creditCost = CREDIT_COSTS.EMAIL_GENERATION
    const hasBalance = await hasCredits(user.tenantId, creditCost)
    if (!hasBalance) {
      return NextResponse.json({
        error: `AI 點數不足。生成 Email 需要 ${creditCost} 點。請至計費頁面加購或升級方案。`,
        creditsRequired: creditCost,
      }, { status: 402 })
    }

    const lead = await db.lead.findFirst({ where: { id: leadId, ...leadFilter(user) } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // === Deduct credits upfront ===
    const creditResult = await deductCredits(
      user.tenantId,
      creditCost,
      `AI Email Gen: ${lead.company}`
    )
    if (!creditResult.success) {
      return NextResponse.json({ error: 'AI 點數扣除失敗' }, { status: 500 })
    }
    const creditsBefore = creditResult.balanceAfter + creditCost

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
      // Refund credits — email generation failed
      await refundCredits(user.tenantId, creditCost, `Email gen fail: ${lead.company}`)
      await db.lead.update({ where: { id: leadId }, data: { status: 'researched' } })
      return NextResponse.json({
        error: 'Email generation failed',
        creditsRefunded: creditCost,
        creditsRemaining: creditsBefore,
      }, { status: 500 })
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
      creditsUsed: creditCost,
      creditsRemaining: creditResult.balanceAfter,
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('POST /api/generate-email error:', error)
    return NextResponse.json({ error: 'Email generation failed' }, { status: 500 })
  }
}
