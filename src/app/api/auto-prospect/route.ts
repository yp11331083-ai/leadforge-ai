import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoProspect, type ProspectCandidate } from '@/lib/ai/agent'

export const maxDuration = 300 // Vercel serverless 5 分鐘

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      serviceName,
      description,
      targetIndustries,
      targetCompanySize,
      targetLocation,
      keyBenefits,
      idealCustomerSignals,
      targetCount = 10,
      saveToDb = false,
    } = body

    if (!serviceName?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'serviceName 和 description 為必填' },
        { status: 400 }
      )
    }

    const result = await autoProspect({
      serviceName,
      description,
      targetIndustries,
      targetCompanySize,
      targetLocation,
      keyBenefits,
      idealCustomerSignals,
      targetCount,
    })

    if (!result.success || !result.result) {
      return NextResponse.json(
        { error: result.error ?? '自動開發失敗' },
        { status: 500 }
      )
    }

    // 若要求「全部加入名單」
    let addedCount = 0
    if (saveToDb && result.result.candidates.length > 0) {
      const leadsData = result.result.candidates.map((c: ProspectCandidate) => ({
        company: c.company,
        website: c.website,
        industry: c.industry ?? null,
        status: 'new',
        tags: `AI自動開發,fit:${c.fit_score}`,
        // 把 AI 評估結果存進 researchRaw，後續可手動觸發研究
        researchRaw: JSON.stringify({
          ai_prospect_evaluation: {
            fit_score: c.fit_score,
            why_they_need_it: c.why_they_need_it,
            suggested_angle: c.suggested_angle,
            key_signals: c.key_signals,
            confidence: c.confidence,
          },
        }),
      }))
      const created = await db.lead.createMany({ data: leadsData })
      addedCount = created.count
    }

    return NextResponse.json({
      success: true,
      ...result.result,
      addedToLeads: addedCount,
    })
  } catch (error) {
    console.error('POST /api/auto-prospect error:', error)
    const msg = error instanceof Error ? error.message : 'Auto-prospect failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
