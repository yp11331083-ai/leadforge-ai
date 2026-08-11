import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  fetchWebsiteContent,
  htmlToText,
  researchCompany,
  researchCompanyDeep,
} from '@/lib/ai/agent'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, website, company, extraContext, mode = 'basic' } = body

    if (!website && !leadId) {
      return NextResponse.json({ error: 'website or leadId is required' }, { status: 400 })
    }

    // 如果有 leadId，先標記為 researching 並取得網站
    let targetWebsite = website as string
    let targetCompany = company as string

    if (leadId) {
      const lead = await db.lead.findUnique({ where: { id: leadId } })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      targetWebsite = lead.website ?? website
      targetCompany = lead.company ?? company
      if (!targetWebsite) {
        return NextResponse.json({ error: 'Lead has no website' }, { status: 400 })
      }
      await db.lead.update({ where: { id: leadId }, data: { status: 'researching' } })
    }

    // 步驟 1：抓取官網內容（所有模式都需要）
    const websiteData = await fetchWebsiteContent(targetWebsite)
    if (!websiteData) {
      if (leadId) {
        await db.lead.update({ where: { id: leadId }, data: { status: 'new' } })
      }
      return NextResponse.json(
        { error: 'Failed to fetch website content' },
        { status: 502 }
      )
    }

    const websiteText = htmlToText(websiteData.html)

    // 步驟 2：依模式執行研究
    if (mode === 'deep') {
      // ===== 深度研究：多源整合 =====
      const deepResult = await researchCompanyDeep({
        company: targetCompany,
        website: targetWebsite,
        websiteContent: websiteText,
        extraContext,
      })

      // 同時也執行基本研究（取得痛點、切入點）
      const basicResult = await researchCompany({
        company: targetCompany,
        website: targetWebsite,
        websiteContent: websiteText,
        extraContext,
      })

      if (!deepResult.success) {
        if (leadId) {
          await db.lead.update({
            where: { id: leadId },
            data: {
              status: 'researched',
              researchRaw: deepResult.raw,
              researchSources: JSON.stringify(deepResult.sources),
              researchMode: 'deep',
            },
          })
        }
        return NextResponse.json(
          {
            error: 'Deep research parsing failed',
            sources: deepResult.sources,
            raw: deepResult.raw,
          },
          { status: 500 }
        )
      }

      // 同時儲存基本研究 + 深度研究
      const basicData = basicResult.success ? basicResult.data : null

      if (leadId) {
        await db.lead.update({
          where: { id: leadId },
          data: {
            status: 'researched',
            painPoints: basicData
              ? JSON.stringify({
                  business_summary: basicData.business_summary,
                  pain_points: basicData.pain_points,
                  buying_signals: basicData.buying_signals,
                  outreach_angle: basicData.outreach_angle,
                })
              : null,
            hiringSignals: basicData
              ? JSON.stringify(basicData.hiring_signals)
              : null,
            deepResearch: JSON.stringify(deepResult.data),
            researchSources: JSON.stringify(deepResult.sources),
            researchMode: 'deep',
            researchRaw: deepResult.raw,
            score: calculateDeepScore(deepResult.data, basicData),
          },
        })
      }

      return NextResponse.json({
        success: true,
        leadId,
        company: targetCompany,
        website: targetWebsite,
        websiteTitle: websiteData.title,
        mode: 'deep',
        research: basicData,
        deepResearch: deepResult.data,
        sources: deepResult.sources,
        score: calculateDeepScore(deepResult.data, basicData),
      })
    }

    // ===== 基本研究（既有邏輯） =====
    const research = await researchCompany({
      company: targetCompany,
      website: targetWebsite,
      websiteContent: websiteText,
      extraContext,
    })

    if (!research.success) {
      if (leadId) {
        await db.lead.update({
          where: { id: leadId },
          data: {
            status: 'new',
            researchRaw: research.raw,
          },
        })
      }
      return NextResponse.json(
        { error: 'AI research parsing failed', raw: research.raw },
        { status: 500 }
      )
    }

    const data = research.data

    if (leadId) {
      await db.lead.update({
        where: { id: leadId },
        data: {
          status: 'researched',
          painPoints: JSON.stringify({
            business_summary: data.business_summary,
            pain_points: data.pain_points,
            buying_signals: data.buying_signals,
            outreach_angle: data.outreach_angle,
          }),
          hiringSignals: JSON.stringify(data.hiring_signals),
          researchRaw: research.raw,
          researchMode: 'basic',
          score: calculateScore(data),
        },
      })
    }

    return NextResponse.json({
      success: true,
      leadId,
      company: targetCompany,
      website: targetWebsite,
      websiteTitle: websiteData.title,
      mode: 'basic',
      research: data,
      score: calculateScore(data),
    })
  } catch (error) {
    console.error('POST /api/research error:', error)
    return NextResponse.json({ error: 'Research failed' }, { status: 500 })
  }
}

function calculateScore(data: {
  pain_points?: unknown[]
  hiring_signals?: unknown[]
  buying_signals?: unknown[]
}): number {
  let score = 30
  if (data.pain_points?.length) score += data.pain_points.length * 8
  if (data.hiring_signals?.length) score += data.hiring_signals.length * 10
  if (data.buying_signals?.length) score += data.buying_signals.length * 12
  return Math.min(100, score)
}

function calculateDeepScore(
  deep: { growth_signals?: unknown[]; open_roles?: Record<string, unknown[]>; recent_news?: unknown[] } | null,
  basic: { pain_points?: unknown[]; hiring_signals?: unknown[]; buying_signals?: unknown[] } | null
): number {
  let score = basic ? calculateScore(basic) : 30
  if (deep?.growth_signals?.length) score += deep.growth_signals.length * 5
  if (deep?.open_roles) {
    const totalRoles = Object.values(deep.open_roles).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
      0
    )
    score += Math.min(20, totalRoles * 2)
  }
  if (deep?.recent_news?.length) score += deep.recent_news.length * 4
  return Math.min(100, score)
}
