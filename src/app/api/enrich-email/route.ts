import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, leadFilter } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { enrichEmail } from '@/lib/ai/agent'
import { deductCredits, hasCredits, addCredits } from '@/lib/credits'
import { CREDIT_COSTS } from '@/lib/credit-pricing'

/** Refund credits if email enrichment fails. */
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
    const { leadId } = await req.json()
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

    // === Credit check ===
    const creditCost = CREDIT_COSTS.EMAIL_ENRICHMENT
    const hasBalance = await hasCredits(user.tenantId, creditCost)
    if (!hasBalance) {
      return NextResponse.json({
        error: `AI 點數不足。Email 查找需要 ${creditCost} 點。請至計費頁面加購或升級方案。`,
        creditsRequired: creditCost,
      }, { status: 402 })
    }

    const lead = await db.lead.findFirst({ where: { id: leadId, ...leadFilter(user) } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.website) return NextResponse.json({ error: '此名單缺少網址' }, { status: 400 })

    // === Deduct credits upfront ===
    const creditResult = await deductCredits(
      user.tenantId,
      creditCost,
      `Email Enrich: ${lead.company}`
    )
    if (!creditResult.success) {
      return NextResponse.json({ error: 'AI 點數扣除失敗' }, { status: 500 })
    }
    const creditsBefore = creditResult.balanceAfter + creditCost

    const config = await db.emailConfig.findUnique({ where: { tenantId: user.tenantId } })

    let existingKeyPeople: any
    if (lead.deepResearch) {
      try {
        const deep = JSON.parse(lead.deepResearch)
        if (deep.key_people?.length > 0) existingKeyPeople = deep.key_people
      } catch {}
    }

    const result = await enrichEmail({
      companyName: lead.company,
      website: lead.website,
      hunterApiKey: config?.hunterApiKey ?? undefined,
      existingKeyPeople,
    })

    if (!result.success || !result.result) {
      // Refund credits — enrichment failed
      await refundCredits(user.tenantId, creditCost, `Enrich fail: ${lead.company}`)
      console.error(`[enrich] FAILED tenant=${user.tenantId} lead=${leadId} company=${lead.company} website=${lead.website} reason=${result.error ?? 'unknown'}`)
      return NextResponse.json({
        error: result.error ?? 'Email enrichment 失敗',
        creditsRefunded: creditCost,
        creditsRemaining: creditsBefore,
      }, { status: 500 })
    }

    await db.lead.update({
      where: { id: leadId },
      data: { enrichedEmails: JSON.stringify(result.result) },
    })

    // 只有「已驗證」的 email 才自動填入 lead 欄位：
    // 官網挖到的（website）或 SMTP 實測確認存在的（smtp_check='verified'）。
    // 純格式猜測、或實測會退信的，留給用戶自己決定。
    const firstVerified = result.result.decisionMakers.find((d) => d.email && (d.verified || d.smtp_check === 'verified'))
    if (firstVerified && !lead.email) {
      await db.lead.update({
        where: { id: leadId },
        data: { email: firstVerified.email, contactName: firstVerified.name, title: firstVerified.title },
      })
    }

    return NextResponse.json({
      success: true,
      leadId,
      ...result.result,
      creditsUsed: creditCost,
      creditsRemaining: creditResult.balanceAfter,
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('POST /api/enrich-email error:', error)
    return NextResponse.json({ error: error.message ?? 'Enrich failed' }, { status: 500 })
  }
}
