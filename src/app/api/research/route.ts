import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchWebsiteContent, htmlToText, researchCompany } from '@/lib/ai/agent'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, website, company, extraContext } = body

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

    // 步驟 1：抓取網站內容
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

    // 步驟 2：AI 研究分析
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

    // 步驟 3：儲存研究結果到 lead
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
