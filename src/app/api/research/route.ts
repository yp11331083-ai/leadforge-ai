import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, leadFilter } from '@/lib/auth/session'
import { fetchWebsiteContent, htmlToText, researchCompany, researchCompanyDeep } from '@/lib/ai/agent'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const { leadId, website, company, extraContext, mode = 'basic' } = body

    if (!website && !leadId) {
      return NextResponse.json({ error: 'website or leadId is required' }, { status: 400 })
    }

    let targetWebsite = website as string
    let targetCompany = company as string

    if (leadId) {
      const lead = await db.lead.findFirst({
        where: { id: leadId, ...leadFilter(user) },
      })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      targetWebsite = lead.website ?? website
      targetCompany = lead.company ?? company
      if (!targetWebsite) {
        return NextResponse.json({ error: 'Lead has no website' }, { status: 400 })
      }
      await db.lead.update({ where: { id: leadId }, data: { status: 'researching' } })
    }

    const websiteData = await fetchWebsiteContent(targetWebsite)
    if (!websiteData) {
      if (leadId) await db.lead.update({ where: { id: leadId }, data: { status: 'new' } })
      return NextResponse.json({ error: 'Failed to fetch website' }, { status: 502 })
    }

    const websiteText = htmlToText(websiteData.html)

    if (mode === 'deep') {
      const deepResult = await researchCompanyDeep({
        company: targetCompany,
        website: targetWebsite,
        websiteContent: websiteText,
        extraContext,
      })

      const basicResult = await researchCompany({
        company: targetCompany,
        website: targetWebsite,
        websiteContent: websiteText,
        extraContext,
      })

      const basicData = basicResult.success ? basicResult.data : null

      if (leadId) {
        await db.lead.update({
          where: { id: leadId },
          data: {
            status: 'researched',
            painPoints: basicData ? JSON.stringify({
              business_summary: basicData.business_summary,
              pain_points: basicData.pain_points,
              buying_signals: basicData.buying_signals,
              outreach_angle: basicData.outreach_angle,
            }) : null,
            hiringSignals: basicData ? JSON.stringify(basicData.hiring_signals) : null,
            deepResearch: deepResult.success ? JSON.stringify(deepResult.data) : null,
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
        mode: 'deep',
        research: basicData,
        deepResearch: deepResult.data,
        sources: deepResult.sources,
        score: calculateDeepScore(deepResult.data, basicData),
      })
    }

    const research = await researchCompany({
      company: targetCompany,
      website: targetWebsite,
      websiteContent: websiteText,
      extraContext,
    })

    if (!research.success) {
      if (leadId) await db.lead.update({ where: { id: leadId }, data: { status: 'new' } })
      return NextResponse.json({ error: 'AI research parsing failed' }, { status: 500 })
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
      mode: 'basic',
      research: data,
      score: calculateScore(data),
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('POST /api/research error:', error)
    return NextResponse.json({ error: 'Research failed' }, { status: 500 })
  }
}

function calculateScore(data: any): number {
  let score = 30
  if (data.pain_points?.length) score += data.pain_points.length * 8
  if (data.hiring_signals?.length) score += data.hiring_signals.length * 10
  if (data.buying_signals?.length) score += data.buying_signals.length * 12
  return Math.min(100, score)
}

function calculateDeepScore(deep: any, basic: any): number {
  let score = basic ? calculateScore(basic) : 30
  if (deep?.growth_signals?.length) score += deep.growth_signals.length * 5
  if (deep?.open_roles) {
    const totalRoles = Object.values(deep.open_roles).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
    score += Math.min(20, totalRoles * 2)
  }
  if (deep?.recent_news?.length) score += deep.recent_news.length * 4
  return Math.min(100, score)
}
