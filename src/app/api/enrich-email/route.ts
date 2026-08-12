import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, leadFilter } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { enrichEmail } from '@/lib/ai/agent'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    await loadProviderConfig()
    const { leadId } = await req.json()
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

    const lead = await db.lead.findFirst({ where: { id: leadId, ...leadFilter(user) } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.website) return NextResponse.json({ error: '此名單缺少網址' }, { status: 400 })

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
      apolloApiKey: config?.apolloApiKey ?? undefined,
      existingKeyPeople,
    })

    if (!result.success || !result.result) {
      return NextResponse.json({ error: result.error ?? 'Email enrichment 失敗' }, { status: 500 })
    }

    await db.lead.update({
      where: { id: leadId },
      data: { enrichedEmails: JSON.stringify(result.result) },
    })

    if (result.result.decisionMakers[0]?.email && !lead.email) {
      const dm = result.result.decisionMakers[0]
      await db.lead.update({
        where: { id: leadId },
        data: { email: dm.email, contactName: dm.name, title: dm.title },
      })
    }

    return NextResponse.json({ success: true, leadId, ...result.result })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('POST /api/enrich-email error:', error)
    return NextResponse.json({ error: error.message ?? 'Enrich failed' }, { status: 500 })
  }
}
