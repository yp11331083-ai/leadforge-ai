import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// 取得所有 Lead，支援 status 篩選
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') where.status = status
    if (search) {
      where.OR = [
        { company: { contains: search } },
        { contactName: { contains: search } },
        { email: { contains: search } },
        { industry: { contains: search } },
      ]
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // 統計指標
    const total = await db.lead.count()
    const byStatus = await db.lead.groupBy({ by: ['status'], _count: true })

    const stats = {
      total,
      new: byStatus.find((s) => s.status === 'new')?._count ?? 0,
      researched: byStatus.find((s) => s.status === 'researched')?._count ?? 0,
      ready: byStatus.find((s) => s.status === 'ready')?._count ?? 0,
      sent: byStatus.find((s) => s.status === 'sent')?._count ?? 0,
      replied: byStatus.find((s) => s.status === 'replied')?._count ?? 0,
    }

    return NextResponse.json({ leads, stats })
  } catch (error) {
    console.error('GET /api/leads error:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

// 新增 Lead
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 支援批次匯入
    if (Array.isArray(body)) {
      const created = await db.lead.createMany({
        data: body.map((item) => ({
          company: item.company,
          contactName: item.contactName ?? null,
          title: item.title ?? null,
          email: item.email ?? null,
          linkedinUrl: item.linkedinUrl ?? null,
          website: item.website ?? null,
          industry: item.industry ?? null,
          companySize: item.companySize ?? null,
          location: item.location ?? null,
          status: item.status ?? 'new',
        })),
      })
      return NextResponse.json({ count: created.count })
    }

    const lead = await db.lead.create({
      data: {
        company: body.company,
        contactName: body.contactName ?? null,
        title: body.title ?? null,
        email: body.email ?? null,
        linkedinUrl: body.linkedinUrl ?? null,
        website: body.website ?? null,
        industry: body.industry ?? null,
        companySize: body.companySize ?? null,
        location: body.location ?? null,
        status: body.status ?? 'new',
      },
    })
    return NextResponse.json(lead)
  } catch (error) {
    console.error('POST /api/leads error:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
