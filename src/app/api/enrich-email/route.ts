import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enrichEmail } from '@/lib/ai/agent'

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json()
    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.website) {
      return NextResponse.json(
        { error: '此名單缺少網址，無法萃取網域' },
        { status: 400 }
      )
    }

    const config = await db.emailConfig.findUnique({ where: { id: 'singleton' } })
    const apolloApiKey = config?.apolloApiKey ?? undefined

    // 從深度研究結果萃取 key_people（如果有）
    let existingKeyPeople: Array<{ name: string; title: string; linkedin?: string }> | undefined
    if (lead.deepResearch) {
      try {
        const deep = JSON.parse(lead.deepResearch) as {
          key_people?: Array<{ name: string; title: string; linkedin?: string }>
        }
        if (deep.key_people && deep.key_people.length > 0) {
          existingKeyPeople = deep.key_people
        }
      } catch {
        /* ignore */
      }
    }

    const result = await enrichEmail({
      companyName: lead.company,
      website: lead.website,
      apolloApiKey,
      existingKeyPeople,
    })

    if (!result.success || !result.result) {
      return NextResponse.json(
        { error: result.error ?? 'Email enrichment 失敗' },
        { status: 500 }
      )
    }

    // 儲存到 DB
    await db.lead.update({
      where: { id: leadId },
      data: {
        enrichedEmails: JSON.stringify(result.result),
      },
    })

    // 如果第一個決策者有 email 且 lead.email 是空的，自動填入
    if (result.result.decisionMakers[0]?.email && !lead.email) {
      await db.lead.update({
        where: { id: leadId },
        data: {
          email: result.result.decisionMakers[0].email,
          contactName: result.result.decisionMakers[0].name,
          title: result.result.decisionMakers[0].title,
        },
      })
    }

    return NextResponse.json({
      success: true,
      leadId,
      ...result.result,
    })
  } catch (error) {
    console.error('POST /api/enrich-email error:', error)
    const msg = error instanceof Error ? error.message : 'Enrich failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
