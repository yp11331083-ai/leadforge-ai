import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { autoProspect } from '@/lib/ai/agent'

// Vercel Hobby caps at 60s, Pro allows up to 300s.
// Set 300 — Vercel will silently clamp on Hobby.
export const maxDuration = 300

/**
 * Synchronous auto-prospect.
 *
 * NOTE: This route runs the entire auto-prospect pipeline in a single HTTP
 * request and returns the final result. It does NOT use a background job +
 * polling pattern because that pattern is fundamentally broken on Vercel
 * serverless (in-memory state is not shared across instances, and the
 * function is killed once the response is returned).
 *
 * If you need real-time progress UI, switch to Server-Sent Events (SSE).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    await loadProviderConfig()
    const body = await req.json()
    const { targetCount = 10, saveToDb = false } = body

    const serviceOffering = await db.serviceOffering.findUnique({
      where: { tenantId: user.tenantId },
    })

    const serviceName = body.serviceName || serviceOffering?.serviceName || ''
    const description = body.description || serviceOffering?.description || ''

    if (!serviceName.trim() || !description.trim()) {
      return NextResponse.json(
        { error: 'serviceName 和 description 為必填（請至「寄件人」分頁設定服務介紹）' },
        { status: 400 }
      )
    }

    const result = await autoProspect({
      serviceName,
      description,
      targetIndustries: body.targetIndustries || serviceOffering?.targetIndustries || undefined,
      targetCompanySize: body.targetCompanySize || serviceOffering?.targetCompanySize || undefined,
      targetLocation: body.targetLocation || serviceOffering?.targetLocation || undefined,
      keyBenefits: body.keyBenefits || serviceOffering?.keyBenefits || undefined,
      idealCustomerSignals: body.idealCustomerSignals || serviceOffering?.idealCustomerSignals || undefined,
      targetCount,
    })

    if (!result.success || !result.result) {
      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          error: result.error ?? '自動開發失敗',
        },
        { status: 500 }
      )
    }

    let addedToLeads = 0
    if (saveToDb && result.result.candidates.length > 0) {
      const leadsData = result.result.candidates.map((c: any) => ({
        tenantId: user.tenantId,
        assigneeId: user.role === 'sdr' ? user.id : null,
        company: c.company,
        website: c.website,
        industry: c.industry ?? null,
        status: 'new' as const,
        tags: `AI自動開發,fit:${c.fit_score}`,
        researchRaw: JSON.stringify({ ai_prospect_evaluation: c }),
      }))
      const created = await db.lead.createMany({ data: leadsData })
      addedToLeads = created.count
    }

    return NextResponse.json({
      success: true,
      status: 'completed',
      result: result.result,
      addedToLeads,
      detail: `找到 ${result.result.candidates.length} 家潛在客戶${addedToLeads ? `，已加入 ${addedToLeads} 家` : ''}`,
    })
  } catch (error: any) {
    console.error('POST /api/auto-prospect error:', error)
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const msg = error?.message ?? 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        status: 'failed',
        error: msg,
      },
      { status: 500 }
    )
  }
}
